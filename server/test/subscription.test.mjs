import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-sub-'))
process.env.DB_FILE = path.join(dir, 'db.json')
process.env.SEED_DEMO = 'false'
process.env.ADMIN_USERNAME = 'admin'

const { hashPassword } = await import('../src/utils/password.js')
process.env.ADMIN_PASSWORD_HASH = await hashPassword('kata-sandi-uji-123')

const { loadState, getState } = await import('../src/store/db.js')
const sub = await import('../src/services/subscription.js')
const { createApp } = await import('../src/app.js')

loadState()
const state = () => getState()
const buyer = (n) => ({ chatId: 1000 + n, name: `Pembeli ${n}`, username: `pembeli${n}` })
const code = (opts = {}) => sub.createCodes({ label: 'uji', ...opts })[0]
const reset = () => {
  const s = state()
  s.codes = []
  s.subscribers = []
  s.accounts = []
  s.runtime = {}
  s.subscriptionSettings = { allowedPlatforms: ['tiktok', 'bigo'], defaultMaxAccounts: 3, defaultDurationDays: 30, platformCaps: { tiktok: 50, bigo: 30 }, changesPerWeek: 3, blocklist: [], contactText: 'x' }
}
const fresh = (n = 1, opts = {}) => {
  reset()
  return sub.redeemCode(code(opts).code, buyer(n)).subscriber
}
const code_of = (fn) => {
  try {
    fn()
  } catch (error) {
    return error.code
  }
  return null
}

test('kode dinormalkan: huruf kecil, tanpa strip, spasi, dengan atau tanpa LM', () => {
  assert.equal(sub.normalizeCode('lm-7k4q-x9pd-2mwa'), 'LM-7K4Q-X9PD-2MWA')
  assert.equal(sub.normalizeCode('7K4QX9PD2MWA'), 'LM-7K4Q-X9PD-2MWA')
  assert.equal(sub.normalizeCode('  LM 7K4Q X9PD 2MWA '), 'LM-7K4Q-X9PD-2MWA')
  assert.equal(sub.normalizeCode('LM-7K4Q-X9PD'), null)
  assert.equal(sub.normalizeCode('LM-0000-1111-OOOO'), null)
  assert.equal(sub.normalizeCode(null), null)
})

test('kode dibuat acak, unik, dan hanya hash yang tersimpan', () => {
  reset()
  const made = sub.createCodes({ label: 'Budi', maxAccounts: 5, durationDays: 14, count: 20 })
  assert.equal(made.length, 20)
  assert.equal(new Set(made.map((c) => c.code)).size, 20)
  assert.match(made[0].code, /^LM-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/)
  assert.equal(made[0].maxAccounts, 5)
  assert.equal(made[0].durationDays, 14)
  const stored = JSON.stringify(state().codes)
  for (const c of made) assert.equal(stored.includes(c.code), false)
  assert.equal(JSON.stringify(sub.overview()).includes(made[0].code), false)
  assert.equal(code_of(() => sub.createCodes({ count: 51 })), 'VALIDATION_ERROR')
  assert.equal(code_of(() => sub.createCodes({ maxAccounts: 0 })), 'VALIDATION_ERROR')
})

test('menukar kode: pelanggan dibuat, kode hanya sekali pakai, kode batal atau asing ditolak seragam', () => {
  reset()
  const c = code({ maxAccounts: 2, durationDays: 10 })
  const { subscriber, renewed } = sub.redeemCode(c.code.toLowerCase(), buyer(1))
  assert.equal(renewed, false)
  assert.equal(subscriber.maxAccounts, 2)
  assert.ok(Math.abs(new Date(subscriber.expiresAt) - (Date.now() + 10 * 86400000)) < 5000)
  const again = (() => { try { sub.redeemCode(c.code, buyer(2)) } catch (e) { return e } return null })()
  assert.equal(again.code, 'INVALID_CODE')
  const revoked = code()
  sub.revokeCode(revoked.id)
  const r1 = (() => { try { sub.redeemCode(revoked.code, buyer(3)) } catch (e) { return e } })()
  const r2 = (() => { try { sub.redeemCode('LM-AAAA-BBBB-CCCC', buyer(3)) } catch (e) { return e } })()
  assert.equal(r1.message, again.message)
  assert.equal(r2.message, again.message)
  assert.equal(state().subscribers.length, 1)
})

test('perpanjangan: menambah hari dari tanggal habis, jatah memakai yang terbesar; setelah habis dimulai dari sekarang', () => {
  const s = fresh(1, { maxAccounts: 5, durationDays: 30 })
  const before = new Date(s.expiresAt).getTime()
  const { renewed } = sub.redeemCode(code({ maxAccounts: 2, durationDays: 10 }).code, buyer(1))
  assert.equal(renewed, true)
  assert.equal(new Date(s.expiresAt).getTime() - before, 10 * 86400000)
  assert.equal(s.maxAccounts, 5)
  s.expiresAt = new Date(Date.now() - 1000).toISOString()
  sub.redeemCode(code({ maxAccounts: 2, durationDays: 10 }).code, buyer(1))
  assert.equal(s.maxAccounts, 2)
  assert.ok(Math.abs(new Date(s.expiresAt) - (Date.now() + 10 * 86400000)) < 5000)
})

test('pelanggan yang dihentikan admin tidak bisa memakai kode, dan kodenya tetap utuh', () => {
  const s = fresh(1)
  sub.updateSubscriber(s.id, { status: 'revoked' })
  const c = code()
  assert.equal(code_of(() => sub.redeemCode(c.code, buyer(1))), 'SUBSCRIBER_REVOKED')
  assert.equal(state().codes.find((x) => x.id === c.id).status, 'unused')
})

test('memilih akun: akun baru dibuat, aturan platform, username, jatah, duplikat, dan daftar blokir', () => {
  const s = fresh(1, { maxAccounts: 2 })
  const { account } = sub.addSelection(s.id, 'tiktok', 'Nadia.Putri')
  assert.equal(account.origin, 'subscription')
  assert.equal(account.monitoringEnabled, true)
  assert.equal(account.profileUrl, 'https://www.tiktok.com/@Nadia.Putri')
  assert.equal(state().runtime[account.id].lastStatus, 'unknown')
  assert.equal(code_of(() => sub.addSelection(s.id, 'youtube', 'WarungTekno')), 'PLATFORM_NOT_ALLOWED')
  assert.equal(code_of(() => sub.addSelection(s.id, 'tiktok', 'a b/../')), 'VALIDATION_ERROR')
  assert.equal(code_of(() => sub.addSelection(s.id, 'tiktok', 'nadia.putri')), 'ALREADY_SELECTED')
  state().subscriptionSettings.blocklist = ['bigo:dilarang']
  assert.equal(code_of(() => sub.addSelection(s.id, 'bigo', 'Dilarang')), 'BLOCKED')
  sub.addSelection(s.id, 'bigo', 'airah05')
  assert.equal(code_of(() => sub.addSelection(s.id, 'bigo', 'cinnamon')), 'NO_SLOTS')
})

test('akun milik admin dipakai ulang tanpa duplikat dan statusnya tidak diubah', () => {
  const s = fresh(1)
  state().accounts.push({ id: 'acc_admin', platformId: 'tiktok', username: 'sudah_ada', displayName: 'Sudah Ada', profileUrl: 'x', monitoringEnabled: true })
  state().runtime.acc_admin = { lastStatus: 'live' }
  const { account } = sub.addSelection(s.id, 'tiktok', 'SUDAH_ADA')
  assert.equal(account.id, 'acc_admin')
  assert.equal(state().accounts.filter((a) => a.username.toLowerCase() === 'sudah_ada').length, 1)
  assert.equal(account.origin, undefined)
})

test('kapasitas platform: akun baru ditolak saat penuh, akun yang sudah dipantau tetap boleh', () => {
  const s = fresh(1)
  state().subscriptionSettings.platformCaps.bigo = 1
  sub.addSelection(s.id, 'bigo', 'pertama')
  const other = sub.redeemCode(code().code, buyer(2)).subscriber
  assert.equal(code_of(() => sub.addSelection(other.id, 'bigo', 'kedua')), 'CAPACITY_FULL')
  sub.addSelection(other.id, 'bigo', 'pertama')
  assert.equal(other.selections.length, 1)
})

test('akun jeda otomatis saat tidak ada pengikut aktif, hanya untuk akun dari pelanggan', () => {
  const a = fresh(1)
  const b = sub.redeemCode(code().code, buyer(2)).subscriber
  const { account } = sub.addSelection(a.id, 'tiktok', 'bersama')
  sub.addSelection(b.id, 'tiktok', 'bersama')
  sub.removeSelection(a.id, account.id)
  assert.equal(account.monitoringEnabled, true)
  sub.removeSelection(b.id, account.id)
  assert.equal(account.monitoringEnabled, false)
  sub.addSelection(a.id, 'tiktok', 'bersama')
  assert.equal(account.monitoringEnabled, true)
})

test('pengikut hanya pelanggan aktif: kedaluwarsa dan dihentikan tidak dihitung', () => {
  const a = fresh(1)
  const { account } = sub.addSelection(a.id, 'tiktok', 'ikuti')
  assert.equal(sub.followersOf(account.id).length, 1)
  a.expiresAt = new Date(Date.now() - 1000).toISOString()
  assert.equal(sub.followersOf(account.id).length, 0)
  assert.equal(code_of(() => sub.addSelection(a.id, 'tiktok', 'baru')), 'NOT_ACTIVE')
  a.expiresAt = new Date(Date.now() + 86400000).toISOString()
  sub.updateSubscriber(a.id, { status: 'revoked' })
  assert.equal(sub.followersOf(account.id).length, 0)
  assert.equal(account.monitoringEnabled, false)
  sub.updateSubscriber(a.id, { status: 'active' })
  assert.equal(account.monitoringEnabled, true)
})

test('batas penggantian per minggu berlaku untuk pembeli, tidak untuk admin', () => {
  const s = fresh(1, { maxAccounts: 10 })
  state().subscriptionSettings.changesPerWeek = 2
  const ids = ['satu', 'dua', 'tiga', 'empat'].map((u) => sub.addSelection(s.id, 'tiktok', u).account.id)
  sub.removeSelection(s.id, ids[0])
  sub.removeSelection(s.id, ids[1])
  assert.equal(code_of(() => sub.removeSelection(s.id, ids[2])), 'CHANGE_LIMIT')
  sub.removeSelection(s.id, ids[2], { byAdmin: true })
  s.changeLog = s.changeLog.map(() => new Date(Date.now() - 8 * 86400000).toISOString())
  sub.removeSelection(s.id, ids[3])
  assert.equal(s.selections.length, 0)
})

test('admin: perpanjang, ubah jatah (tidak di bawah pemakaian), catatan, dan hapus data pelanggan', () => {
  const s = fresh(1, { maxAccounts: 3 })
  const exp = new Date(s.expiresAt).getTime()
  sub.updateSubscriber(s.id, { extendDays: 5, note: 'VIP' })
  assert.equal(new Date(s.expiresAt).getTime() - exp, 5 * 86400000)
  const { account } = sub.addSelection(s.id, 'tiktok', 'satu')
  sub.addSelection(s.id, 'tiktok', 'dua')
  assert.equal(code_of(() => sub.updateSubscriber(s.id, { maxAccounts: 1 })), 'SLOTS_IN_USE')
  sub.deleteSubscriber(s.id)
  assert.equal(state().subscribers.length, 0)
  assert.equal(account.monitoringEnabled, false)
})

test('pengaturan divalidasi: platform, batas, blocklist, dan teks', () => {
  const cur = state().subscriptionSettings
  assert.equal(sub.validateSettings({ blocklist: ['TikTok:Nama'], platformCaps: { tiktok: 10 } }, cur).blocklist[0], 'tiktok:nama')
  assert.equal(code_of(() => sub.validateSettings({ allowedPlatforms: ['bukan'] }, cur)), 'VALIDATION_ERROR')
  assert.equal(code_of(() => sub.validateSettings({ platformCaps: { tiktok: 0 } }, cur)), 'VALIDATION_ERROR')
  assert.equal(code_of(() => sub.validateSettings({ blocklist: ['asal'] }, cur)), 'VALIDATION_ERROR')
  assert.equal(code_of(() => sub.validateSettings({ contactText: 'x'.repeat(501) }, cur)), 'VALIDATION_ERROR')
})

test('menghapus akun dari dashboard melepasnya dari pilihan pelanggan', () => {
  const s = fresh(1)
  const { account } = sub.addSelection(s.id, 'tiktok', 'hapus_saya')
  sub.dropAccountSelections(account.id)
  assert.equal(s.selections.length, 0)
})

test('API admin: wajib login, kode tampil sekali, ringkasan tanpa kode asli, pengaturan divalidasi', async () => {
  reset()
  const server = createApp().listen(0)
  const base = `http://localhost:${server.address().port}/api`
  let cookie = ''
  const call = async (method, p, body, headers = {}) => {
    const r = await fetch(base + p, { method, headers: { 'X-Requested-With': 'live-monitor', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined })
    const set = r.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  try {
    assert.equal((await call('GET', '/subscription/overview')).status, 401)
    assert.equal((await call('POST', '/auth/login', { username: 'admin', password: 'kata-sandi-uji-123' })).status, 200)
    assert.equal((await call('POST', '/subscription/codes', { count: 2, maxAccounts: 4 }, { 'X-Requested-With': 'salah' })).status, 403)
    const made = await call('POST', '/subscription/codes', { label: 'Budi', count: 2, maxAccounts: 4, durationDays: 7 })
    assert.equal(made.status, 201)
    assert.equal(made.body.codes.length, 2)
    assert.ok(made.body.codes[0].code)
    assert.equal(made.body.codes[0].codeHash, undefined)
    const ov = await call('GET', '/subscription/overview')
    assert.equal(ov.body.stats.unusedCodes, 2)
    assert.equal(JSON.stringify(ov.body).includes(made.body.codes[0].code), false)
    assert.equal((await call('POST', `/subscription/codes/${made.body.codes[0].id}/revoke`)).status, 200)
    assert.equal((await call('POST', `/subscription/codes/${made.body.codes[0].id}/revoke`)).status, 409)
    assert.equal((await call('POST', '/subscription/codes', { count: 0 })).status, 400)
    assert.equal((await call('PATCH', '/subscription/settings', { platformCaps: { tiktok: -1 } })).status, 400)
    const ok = await call('PATCH', '/subscription/settings', { defaultMaxAccounts: 5, blocklist: ['tiktok:x_y'] })
    assert.equal(ok.body.settings.defaultMaxAccounts, 5)
    const s = sub.redeemCode(made.body.codes[1].code, buyer(9)).subscriber
    const added = await call('POST', `/subscription/subscribers/${s.id}/selections`, { platformId: 'bigo', username: 'airah05' })
    assert.equal(added.status, 201)
    assert.equal(added.body.subscribers[0].selections[0].username, 'airah05')
    assert.equal((await call('POST', `/subscription/subscribers/${s.id}/selections`, { platformId: 'youtube', username: 'abc' })).status, 400)
    assert.equal((await call('PATCH', `/subscription/subscribers/${s.id}`, { extendDays: 30 })).status, 200)
    assert.equal((await call('DELETE', `/subscription/subscribers/${s.id}`)).status, 200)
  } finally {
    server.close()
  }
})
