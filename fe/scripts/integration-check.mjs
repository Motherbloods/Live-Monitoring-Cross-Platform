import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

const { hashPassword } = await import('../../server/src/utils/password.js')

const port = 4010
const dbFile = path.join(os.tmpdir(), `lm-integration-${Date.now()}.json`)
globalThis.__API_URL__ = `http://localhost:${port}`
const storage = new Map()
globalThis.localStorage = { getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) }

const PASSWORD = 'kata-sandi-uji-123'
const jar = new Map()
const realFetch = globalThis.fetch
globalThis.fetch = async (url, options = {}) => {
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const response = await realFetch(url, { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } })
  for (const line of response.headers.getSetCookie?.() || []) {
    const [pair, ...attrs] = line.split(';')
    const [name, value] = pair.split('=')
    if (attrs.some((a) => a.trim().toLowerCase() === 'max-age=0') || !value) jar.delete(name)
    else jar.set(name, value)
  }
  return response
}

const server = spawn('node', ['src/index.js'], { cwd: path.resolve('..', 'server'), env: { ...process.env, PORT: String(port), DB_FILE: dbFile, TIKTOK_CHECKER: 'dummy', ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: await hashPassword(PASSWORD) }, stdio: 'ignore' })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
for (let i = 0; i < 30; i += 1) {
  try {
    if ((await fetch(`${globalThis.__API_URL__}/api/health`)).ok) break
  } catch {}
  await sleep(200)
}

const { useAppStore } = await import('../src/store/appStore.js')
const { getDisplayStatus } = await import('../src/utils/effectiveConfig.js')
const results = []
const test = async (name, fn) => {
  try {
    await fn()
    results.push([true, name])
  } catch (error) {
    results.push([false, `${name}: ${error.message}`])
  }
}
const S = () => useAppStore.getState()
const form = (patch) => ({ platformId: 'twitch', profileUrl: '', username: 'uji_integrasi', displayName: 'Uji Integrasi', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: '', autoRecording: null, notifyEnabled: null, notifyOnStart: null, notifyOnEnd: null, notes: '', ...patch })

await test('tanpa login, sesi dinyatakan anonim dan data tidak dimuat', async () => {
  assert.equal(S().auth, 'checking')
  await S().checkSession()
  assert.equal(S().auth, 'anonymous')
  await S().hydrate()
  assert.equal(S().accounts.length, 0)
  assert.equal(S().auth, 'anonymous')
})

await test('kata sandi salah ditolak dan sesi tetap anonim', async () => {
  const result = await S().login('admin', 'salah-salah-1')
  assert.equal(result.ok, false)
  assert.equal(S().auth, 'anonymous')
})

await test('login benar membuat sesi dan cookie tersimpan', async () => {
  const result = await S().login('admin', PASSWORD)
  assert.equal(result.ok, true)
  assert.equal(S().auth, 'authenticated')
  assert.equal(S().user.username, 'admin')
  assert.ok(jar.has('lm_session'))
})

await test('hydrate memuat akun, runtime, platform, dan konfigurasi dari server', async () => {
  await S().hydrate()
  assert.equal(S().connection, 'online')
  assert.equal(S().accounts.length, 10)
  assert.equal(Object.keys(S().runtime).length, 10)
  assert.equal(Object.keys(S().platformRuntime).length, 5)
  assert.equal(S().config.platforms.tiktok.checkIntervalSeconds, 30)
})

await test('akun baru muncul dengan status unknown', async () => {
  assert.notEqual(await S().addAccount(form({}), 'uji_integrasi'), false)
  const a = S().accounts.find((x) => x.username === 'uji_integrasi')
  assert.ok(a)
  assert.equal(getDisplayStatus(a, S().runtime, S().platformRuntime, S().config), 'unknown')
})

await test('akun duplikat ditolak server dan data tidak bertambah', async () => {
  const before = S().accounts.length
  assert.equal(await S().addAccount(form({}), 'uji_integrasi'), false)
  assert.equal(S().accounts.length, before)
})

await test('monitoring akun dimatikan tercermin sebagai disabled', async () => {
  const a = S().accounts.find((x) => x.username === 'uji_integrasi')
  await S().setAccountMonitoring(a.id, false)
  const now = S().accounts.find((x) => x.id === a.id)
  assert.equal(getDisplayStatus(now, S().runtime, S().platformRuntime, S().config), 'disabled')
})

await test('interval nol ditolak sebelum dan sesudah sampai server', async () => {
  const bad = JSON.parse(JSON.stringify(S().config))
  bad.global.defaultCheckIntervalSeconds = 0
  assert.equal(await S().commitConfig(bad, 'uji'), false)
  assert.equal(S().config.global.defaultCheckIntervalSeconds, 60)
})

await test('simpan konfigurasi mengubah server dan tetap setelah hydrate ulang', async () => {
  assert.equal(await S().saveConfigSection((c) => ({ ...c, global: { ...c.global, defaultCheckIntervalSeconds: 90 } }), 'Interval diubah'), true)
  await S().hydrate()
  assert.equal(S().config.global.defaultCheckIntervalSeconds, 90)
  assert.equal(S().draft.global.defaultCheckIntervalSeconds, 90)
})

await test('draft yang belum disimpan tidak tertimpa polling', async () => {
  S().setDraftGlobal({ appName: 'Draft Belum Disimpan' })
  await S().hydrate()
  assert.equal(S().draft.global.appName, 'Draft Belum Disimpan')
  assert.notEqual(S().config.global.appName, 'Draft Belum Disimpan')
  S().discardDraft()
})

await test('menonaktifkan service hanya memengaruhi platform itu dan check ditolak', async () => {
  const tiktok = JSON.stringify(S().config.platforms.tiktok)
  assert.notEqual(await S().setServiceEnabled('instagram', false), false)
  assert.equal(S().config.platforms.instagram.serviceEnabled, false)
  assert.equal(JSON.stringify(S().config.platforms.tiktok), tiktok)
  const before = JSON.stringify(S().runtime)
  await S().checkPlatform('instagram')
  assert.equal(JSON.stringify(S().runtime), before)
})

await test('check all memeriksa seluruh akun yang memenuhi syarat', async () => {
  const summary = await S().checkAllEnabled()
  assert.ok(summary && summary.total > 0)
  assert.equal(summary.succeeded + summary.failed, summary.total)
})

await test('jeda global monitoring tersimpan di server', async () => {
  await S().toggleGlobalMonitoring()
  assert.equal(S().config.global.globalMonitoringEnabled, false)
  await S().toggleGlobalMonitoring()
  assert.equal(S().config.global.globalMonitoringEnabled, true)
})

await test('hapus akun menjaga riwayat live', async () => {
  const historyBefore = S().history.length
  const a = S().accounts.find((x) => x.username === 'uji_integrasi')
  assert.notEqual(await S().deleteAccount(a.id), false)
  assert.equal(S().accounts.some((x) => x.id === a.id), false)
  assert.ok(S().history.length >= historyBefore)
})

await test('log dan aktivitas berasal dari server', () => {
  assert.ok(S().logs.length > 0)
  assert.ok(S().activities.length > 0)
})

await test('logout menghapus data dari memori dan menolak akses berikutnya', async () => {
  const oldCookie = jar.get('lm_session')
  await S().logout()
  assert.equal(S().auth, 'anonymous')
  assert.equal(S().accounts.length, 0)
  assert.equal(jar.has('lm_session'), false)
  jar.set('lm_session', oldCookie)
  const response = await fetch(`${globalThis.__API_URL__}/api/accounts`)
  assert.equal(response.status, 401)
  jar.delete('lm_session')
  assert.equal((await S().login('admin', PASSWORD)).ok, true)
  await S().hydrate()
})

await test('sesi yang kedaluwarsa di server memicu kembali ke anonim', async () => {
  jar.set('lm_session', 'token-palsu')
  await S().hydrate()
  assert.equal(S().auth, 'anonymous')
  jar.delete('lm_session')
  assert.equal((await S().login('admin', PASSWORD)).ok, true)
  await S().hydrate()
})

await test('server mati membuat koneksi offline tanpa menghapus data terakhir', async () => {
  const count = S().accounts.length
  server.kill('SIGKILL')
  await sleep(400)
  await S().hydrate()
  assert.equal(S().connection, 'offline')
  assert.equal(S().accounts.length, count)
})

const failed = results.filter(([ok]) => !ok)
results.forEach(([ok, name]) => console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${name}`))
console.log(`\n${results.length - failed.length} lulus, ${failed.length} gagal`)
fs.rmSync(dbFile, { force: true })
process.exit(failed.length ? 1 : 0)
