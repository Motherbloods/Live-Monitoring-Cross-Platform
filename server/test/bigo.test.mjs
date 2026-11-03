import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-bigo-'))
const sessionFile = path.join(dir, 'bigo-session.json')
process.env.DB_FILE = path.join(dir, 'db.json')
process.env.SEED_DEMO = 'false'
process.env.BIGO_SESSION_FILE = sessionFile
process.env.BIGO_CHECKER = 'real'

const { bigoChecker, resetBigoCache, bigoSessionAvailable } = await import('../src/services/bigo.js')
const { loadState, getState } = await import('../src/store/db.js')
const { checkAccount } = await import('../src/services/monitor.js')
const { validateAccountInput, defaultProfileUrl } = await import('../src/config/validation.js')

const realFetch = globalThis.fetch
let calls = []
let reply = () => ({ ok: true, status: 200, json: async () => ({ data: { alive: 0 } }) })
globalThis.fetch = async (url, options) => {
  calls.push({ url: String(url), options })
  return reply()
}

const writeSession = (cookies) => fs.writeFileSync(sessionFile, JSON.stringify({ cookies }))
const info = (data, status = 200) => () => ({ ok: status === 200, status, json: async () => ({ data }) })
const acc = (username = 'airah05') => ({ username })
const setup = () => {
  calls = []
  resetBigoCache()
  writeSession([{ name: 'sid', value: 'rahasia-sid-123', domain: '.bigo.tv' }, { name: 'lang', value: 'id', domain: 'www.bigo.tv' }, { name: 'asing', value: 'x', domain: '.google.com' }])
  reply = info({ alive: 0 })
}

test('live terdeteksi: permintaan memakai form, referer, dan hanya cookie Bigo', async () => {
  setup()
  reply = info({ alive: 1, roomId: '777' })
  const r = await bigoChecker(acc(), null)
  assert.equal(r.status, 'live')
  assert.equal(r.live.roomId, '777')
  assert.equal(r.live.simulated, false)
  const call = calls[0]
  assert.equal(call.url, 'https://ta.bigo.tv/official_website/studio/getInternalStudioInfo')
  assert.equal(call.options.method, 'POST')
  assert.equal(call.options.headers.Referer, 'https://www.bigo.tv/')
  assert.equal(call.options.headers.Cookie, 'sid=rahasia-sid-123; lang=id')
  assert.match(String(call.options.body), /siteId=airah05/)
  assert.match(String(call.options.body), /isEncrypt=0/)
})

test('alive bukan 1 dianggap offline', async () => {
  setup()
  assert.equal((await bigoChecker(acc(), null)).status, 'offline')
})

test('sesi kedaluwarsa menjadi kegagalan dengan petunjuk, bukan offline', async () => {
  setup()
  reply = info({ needLogin: true, alive: 0 })
  await assert.rejects(() => bigoChecker(acc(), null), (e) => /kedaluwarsa/.test(e.message) && !e.message.includes('rahasia-sid-123'))
})

test('file sesi hilang, rusak, kosong, atau berisi cookie berbahaya ditolak tanpa memanggil Bigo', async () => {
  setup()
  fs.rmSync(sessionFile)
  resetBigoCache()
  await assert.rejects(() => bigoChecker(acc(), null), /tidak ditemukan/)
  assert.equal(bigoSessionAvailable(), false)
  fs.writeFileSync(sessionFile, '{rusak')
  resetBigoCache()
  await assert.rejects(() => bigoChecker(acc(), null), /rusak/)
  writeSession([])
  resetBigoCache()
  await assert.rejects(() => bigoChecker(acc(), null), /tidak berisi cookie/)
  writeSession([{ name: 'sid', value: 'a\r\nX-Evil: 1', domain: '.bigo.tv' }])
  resetBigoCache()
  await assert.rejects(() => bigoChecker(acc(), null), /tidak valid/)
  assert.equal(calls.length, 0)
})

test('sesi dibaca ulang otomatis saat file diganti', async () => {
  setup()
  await bigoChecker(acc(), null)
  assert.match(calls[0].options.headers.Cookie, /rahasia-sid-123/)
  writeSession([{ name: 'sid', value: 'sesi-baru-456', domain: '.bigo.tv' }])
  fs.utimesSync(sessionFile, new Date(), new Date(Date.now() + 5000))
  await bigoChecker(acc(), null)
  assert.equal(calls[1].options.headers.Cookie, 'sid=sesi-baru-456')
})

test('respons aneh dan HTTP error menjadi kegagalan; username tidak valid ditolak', async () => {
  setup()
  reply = info(null)
  await assert.rejects(() => bigoChecker(acc(), null), /tidak dikenali/)
  reply = info({}, 500)
  await assert.rejects(() => bigoChecker(acc(), null), /HTTP 500/)
  const before = calls.length
  await assert.rejects(() => bigoChecker(acc('a b/../'), null), /tidak valid/)
  assert.equal(calls.length, before)
})

test('validasi akun Bigo dan URL profil bawaan', () => {
  const errors = (username) => validateAccountInput({ platformId: 'bigo', username }, []).errors.length
  assert.equal(errors('airah05'), 0)
  assert.equal(errors('a.b'), 1)
  assert.equal(defaultProfileUrl('bigo', 'airah05'), 'https://www.bigo.tv/user/airah05')
})

test('database lama tanpa Bigo dilengkapi saat dimuat', () => {
  const old = path.join(dir, 'lama.json')
  const state = loadState()
  const legacy = JSON.parse(JSON.stringify(state))
  delete legacy.config.platforms.bigo
  delete legacy.platformRuntime.bigo
  fs.writeFileSync(old, JSON.stringify(legacy))
  const saved = process.env.DB_FILE
  process.env.DB_FILE = old
  const migrated = loadState()
  process.env.DB_FILE = saved
  assert.equal(migrated.config.platforms.bigo.checkIntervalSeconds, 180)
  assert.equal(migrated.platformRuntime.bigo.status, 'online')
})

test('alur penuh: live membuka riwayat, selesai menutupnya, sesi habis tidak mengubah status', async () => {
  loadState()
  const state = getState()
  const account = { id: 'acc_bg', platformId: 'bigo', username: 'airah05', displayName: 'Airah', profileUrl: 'https://www.bigo.tv/user/airah05', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null }
  state.accounts.push(account)
  state.runtime[account.id] = { checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null }
  state.config.platforms.bigo.retryAttempts = 0
  setup()

  reply = info({ alive: 1, roomId: '1' })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.equal(state.history.filter((h) => h.accountId === account.id && !h.endAt).length, 1)

  reply = info({ needLogin: true })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.match(state.runtime[account.id].lastError, /kedaluwarsa/)

  reply = info({ alive: 0 })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'offline')
  assert.equal(state.history.find((h) => h.accountId === account.id).status, 'ended')
})

test.after(() => {
  globalThis.fetch = realFetch
})
