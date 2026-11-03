import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.DB_FILE = path.join(os.tmpdir(), `lm-notif-${Date.now()}.json`)
process.env.SEED_DEMO = 'false'
process.env.TELEGRAM_BOT_TOKEN = '123456:ABC-rahasia'
process.env.TELEGRAM_CHAT_ID = '999'
process.env.TIKTOK_CHECKER = 'real'

const { loadState, getState } = await import('../src/store/db.js')
const telegram = await import('../src/services/telegram.js')
const notifier = await import('../src/services/notifier.js')
const { setPageFetcher } = await import('../src/services/tiktok.js')
const { checkAccount } = await import('../src/services/monitor.js')

loadState()
telegram.setMinIntervalMs(0)
const sent = []
telegram.setSender(async (text) => {
  sent.push(text)
})

const account = (patch = {}) => ({ id: 'acc_n', platformId: 'tiktok', username: 'nadia.putri', displayName: 'Nadia', profileUrl: 'https://www.tiktok.com/@nadia.putri', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null, notifyEnabled: null, notifyOnStart: null, notifyOnEnd: null, ...patch })
const reset = () => {
  sent.length = 0
  notifier.resetCooldowns()
  const { config } = getState()
  config.global.notificationDefaults = { enabled: true, liveStart: true, liveEnd: false, serviceFail: true, serviceRecover: true, recordingStart: false, recordingFail: true }
  config.platforms.tiktok.notificationOverrides = {}
  config.global.timezone = 'Asia/Jakarta'
}

test('live mulai: pesan memuat akun, platform, jam, dan tautan live', async () => {
  reset()
  notifier.notifyLiveStart(account(), { startedAt: '2026-10-27T13:15:00.000Z', title: 'Jualan malam' })
  await telegram.flush()
  assert.equal(sent.length, 1)
  assert.match(sent[0], /TikTok Live Started/)
  assert.match(sent[0], /Account: @nadia\.putri/)
  assert.match(sent[0], /Started At: 20:15/)
  assert.match(sent[0], /Live URL: https:\/\/www\.tiktok\.com\/@nadia\.putri\/live/)
})

test('live berakhir default mati, bisa dinyalakan lewat platform atau akun', async () => {
  reset()
  notifier.notifyLiveEnd(account(), new Date(Date.now() - 85 * 60000).toISOString())
  await telegram.flush()
  assert.equal(sent.length, 0)
  getState().config.platforms.tiktok.notificationOverrides = { liveEnd: true }
  notifier.notifyLiveEnd(account(), new Date(Date.now() - 85 * 60000).toISOString())
  await telegram.flush()
  assert.equal(sent.length, 1)
  assert.match(sent[0], /Duration: 1j 25m/)
  reset()
  notifier.notifyLiveEnd(account({ notifyOnEnd: true }), null)
  await telegram.flush()
  assert.equal(sent.length, 1)
})

test('pengaturan akun dan master switch dihormati', async () => {
  reset()
  notifier.notifyLiveStart(account({ notifyOnStart: false }), { startedAt: new Date().toISOString() })
  notifier.notifyLiveStart(account({ notifyEnabled: false }), { startedAt: new Date().toISOString() })
  getState().config.global.notificationDefaults.enabled = false
  notifier.notifyLiveStart(account(), { startedAt: new Date().toISOString() })
  await telegram.flush()
  assert.equal(sent.length, 0)
})

test('service gagal dan pulih hanya sekali dalam masa jeda', async () => {
  reset()
  notifier.notifyServiceFailed('tiktok', 'Diblokir')
  notifier.notifyServiceFailed('tiktok', 'Diblokir')
  notifier.notifyServiceRecovered('tiktok')
  notifier.notifyServiceRecovered('tiktok')
  await telegram.flush()
  assert.equal(sent.length, 2)
  assert.match(sent[0], /Service Failed/)
  assert.match(sent[1], /Service Recovered/)
})

test('tanpa token, tidak ada yang dikirim dan tidak error', async () => {
  reset()
  const token = process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_BOT_TOKEN
  notifier.notifyLiveStart(account(), { startedAt: new Date().toISOString() })
  await telegram.flush()
  process.env.TELEGRAM_BOT_TOKEN = token
  assert.equal(sent.length, 0)
})

test('kegagalan kirim dicatat di log tanpa membocorkan token', async () => {
  reset()
  telegram.setSender(async () => {
    throw new Error(`gagal di bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`)
  })
  notifier.notifyLiveStart(account(), { startedAt: new Date().toISOString() })
  await telegram.flush()
  const log = getState().logs.find((l) => l.message.includes('Notifikasi Telegram gagal'))
  assert.ok(log)
  assert.equal(log.message.includes('ABC-rahasia'), false)
  telegram.setSender(async (text) => {
    sent.push(text)
  })
})

test('pesan dikirim berurutan walau banyak sekaligus', async () => {
  reset()
  for (let i = 0; i < 5; i += 1) notifier.notifyLiveStart(account({ username: `akun${i}` }), { startedAt: new Date().toISOString() })
  await telegram.flush()
  assert.equal(sent.length, 5)
  assert.match(sent[0], /akun0/)
  assert.match(sent[4], /akun4/)
})

test('pengirim asli: alamat, isi, dan pesan error tanpa token', async () => {
  const realFetch = globalThis.fetch
  let call = null
  globalThis.fetch = async (url, options) => {
    call = { url, body: JSON.parse(options.body) }
    return { ok: false, status: 401, json: async () => ({ ok: false, description: 'Unauthorized bot123456:ABC-rahasia' }) }
  }
  await assert.rejects(() => telegram.sendMessage('halo'), (error) => !error.message.includes('ABC-rahasia'))
  globalThis.fetch = realFetch
  assert.equal(call.url, 'https://api.telegram.org/bot123456:ABC-rahasia/sendMessage')
  assert.equal(call.body.chat_id, '999')
  assert.equal(call.body.text, 'halo')
})

test('alur penuh: akun TikTok mulai live memicu satu notifikasi, selesai live memicu satu lagi', async () => {
  reset()
  getState().config.platforms.tiktok.notificationOverrides = { liveEnd: true }
  const state = getState()
  const acc = account({ id: 'acc_flow' })
  state.accounts.push(acc)
  state.runtime[acc.id] = { checking: false, lastStatus: 'offline', lastChecked: null, lastSuccess: null, lastError: null, live: null }
  state.config.platforms.tiktok.retryAttempts = 0
  const page = (status) => `<script id="SIGI_STATE" type="application/json">${JSON.stringify({ LiveRoom: { liveRoomUserInfo: { liveRoom: { status, title: 'Live uji' } } } })}</script>`
  setPageFetcher(async () => page(2))
  await checkAccount(acc)
  await checkAccount(acc)
  setPageFetcher(async () => page(4))
  await checkAccount(acc)
  await telegram.flush()
  assert.equal(sent.length, 2)
  assert.match(sent[0], /Live Started/)
  assert.match(sent[1], /Live Ended/)
})

test('tiga kegagalan berturut-turut mengirim satu pemberitahuan service gagal', async () => {
  reset()
  const state = getState()
  const acc = account({ id: 'acc_fail' })
  state.accounts.push(acc)
  state.runtime[acc.id] = { checking: false, lastStatus: 'offline', lastChecked: null, lastSuccess: null, lastError: null, live: null }
  state.platformRuntime.tiktok.status = 'online'
  setPageFetcher(async () => {
    throw new Error('Diblokir')
  })
  for (let i = 0; i < 4; i += 1) await checkAccount(acc, { retry: false })
  await telegram.flush()
  const failed = sent.filter((t) => t.includes('Service Failed'))
  assert.equal(failed.length, 1)
  assert.equal(state.platformRuntime.tiktok.status, 'offline')
})
