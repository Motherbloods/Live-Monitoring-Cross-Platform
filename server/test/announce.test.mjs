import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-announce-'))
process.env.DB_FILE = path.join(dir, 'db.json')
process.env.SEED_DEMO = 'false'
process.env.SUBSCRIBER_BOT_TOKEN = '555:token-rahasia'
process.env.TIKTOK_CHECKER = 'real'
delete process.env.TELEGRAM_BOT_TOKEN

const { loadState, getState } = await import('../src/store/db.js')
const subs = await import('../src/services/subscription.js')
const notifier = await import('../src/services/subscriberNotifier.js')
const bot = await import('../src/services/subscriberBot.js')
const { setPageFetcher } = await import('../src/services/tiktok.js')

loadState()
let sent = []
let fetched = 0
let uid = 0
const botApi = async () => ({})
let counter = 0

const page = (status) => `<script id="SIGI_STATE" type="application/json">${JSON.stringify({ LiveRoom: { liveRoomUserInfo: { liveRoom: { status, title: 'Live uji', startTime: 1790000000 } } } })}</script>`
const reset = () => {
  const s = getState()
  Object.assign(s, { codes: [], subscribers: [], accounts: [], runtime: {}, logs: [] })
  s.subscriptionSettings = { allowedPlatforms: ['tiktok', 'bigo'], defaultMaxAccounts: 5, defaultDurationDays: 30, platformCaps: { tiktok: 500, bigo: 500 }, changesPerWeek: 0, blocklist: [], contactText: 'x' }
  s.config.platforms.tiktok.retryAttempts = 0
  sent = []
  fetched = 0
  bot.resetBotMemory()
  notifier.setSubscriberSender(async (chatId, text) => {
    sent.push({ chatId: String(chatId), text })
  })
  notifier.setRateLimits({ chatMs: 0, globalPerSecond: 1000, retryMs: 10 })
  setPageFetcher(async () => {
    fetched += 1
    return page(2)
  })
}
const buyer = () => {
  counter += 1
  const code = subs.createCodes({})[0].code
  return subs.redeemCode(code, { chatId: 9000 + counter, name: `B${counter}`, username: `b${counter}` }).subscriber
}
const seedAccount = (username, runtimePatch) => {
  const s = getState()
  const account = { id: `acc_${username}`, platformId: 'tiktok', username, displayName: username, profileUrl: `https://www.tiktok.com/@${username}`, monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null, origin: 'subscription' }
  s.accounts.push(account)
  s.runtime[account.id] = { checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null, ...runtimePatch }
  return account
}
const addViaBot = async (sub, username) => {
  const send = (text) => bot.handleUpdate({ update_id: ++uid, message: { chat: { id: sub.chatId, type: 'private' }, from: {}, text } }, botApi)
  let buttonData = null
  const api = async (method, params) => {
    if (method === 'sendMessage' && params.reply_markup) buttonData = params.reply_markup.inline_keyboard[0][0].callback_data
    return {}
  }
  await bot.handleUpdate({ update_id: ++uid, message: { chat: { id: sub.chatId, type: 'private' }, from: {}, text: `/tambah tiktok ${username}` } }, api)
  await bot.handleUpdate({ update_id: ++uid, callback_query: { id: 'q', data: buttonData, message: { chat: { id: sub.chatId }, message_id: 1 } } }, api)
  await bot.flushBackground()
  await notifier.flushSubscriberQueue()
  void send
}
const to = (sub) => sent.filter((m) => m.chatId === sub.chatId)
const liveRuntime = { lastStatus: 'live', lastSuccess: new Date().toISOString(), live: { title: 'Sedang berjalan', startedAt: '2026-10-27T13:15:00.000Z', viewers: 5, simulated: false } }

test('akun yang baru diketahui live dan datanya segar: pembeli langsung dikabari tanpa memeriksa ulang', async () => {
  reset()
  seedAccount('sudah_live', liveRuntime)
  const A = buyer()
  await addViaBot(A, 'sudah_live')
  assert.equal(to(A).length, 1)
  assert.match(to(A)[0].text, /sudah_live sedang live di TikTok/)
  assert.match(to(A)[0].text, /Mulai: 20:15/)
  assert.match(to(A)[0].text, /Judul: Sedang berjalan/)
  assert.equal(fetched, 0)
})

test('hanya pembeli baru yang dikabari, pengikut lama tidak mendapat pesan ganda', async () => {
  reset()
  const account = seedAccount('ramai', liveRuntime)
  const old = buyer()
  subs.addSelection(old.id, 'tiktok', 'ramai')
  const fresh = buyer()
  await addViaBot(fresh, 'ramai')
  assert.equal(to(fresh).length, 1)
  assert.equal(to(old).length, 0)
  assert.equal(account.id, getState().accounts[0].id)
})

test('akun baru yang ternyata sedang live: tepat satu pesan (lewat perubahan status), bukan dua', async () => {
  reset()
  const A = buyer()
  await addViaBot(A, 'baru_live')
  assert.equal(fetched, 1)
  assert.equal(to(A).length, 1)
  assert.match(to(A)[0].text, /baru_live sedang live/)
})

test('akun baru yang sedang offline: tidak ada pesan live', async () => {
  reset()
  setPageFetcher(async () => {
    fetched += 1
    return page(4)
  })
  const A = buyer()
  await addViaBot(A, 'baru_offline')
  assert.equal(fetched, 1)
  assert.equal(to(A).length, 0)
  const account = getState().accounts.find((a) => a.username === 'baru_offline')
  assert.equal(getState().runtime[account.id].lastStatus, 'offline')
})

test('data live yang sudah usang diperiksa ulang: masih live berarti satu pesan, sudah selesai berarti tidak ada', async () => {
  reset()
  const stale = { ...liveRuntime, lastSuccess: new Date(Date.now() - 3600000).toISOString() }
  seedAccount('usang_masih', { ...stale })
  const A = buyer()
  await addViaBot(A, 'usang_masih')
  assert.equal(fetched, 1)
  assert.equal(to(A).length, 1)

  reset()
  setPageFetcher(async () => {
    fetched += 1
    return page(4)
  })
  seedAccount('usang_selesai', { ...stale })
  const B = buyer()
  await addViaBot(B, 'usang_selesai')
  assert.equal(fetched, 1)
  assert.equal(to(B).length, 0)
  assert.equal(getState().runtime.acc_usang_selesai.lastStatus, 'offline')
})

test('pemeriksaan gagal: tidak ada pesan dan status lama tidak dipercaya', async () => {
  reset()
  const stale = { ...liveRuntime, lastSuccess: new Date(Date.now() - 3600000).toISOString() }
  seedAccount('gagal_cek', stale)
  setPageFetcher(async () => {
    throw new Error('Diblokir')
  })
  const A = buyer()
  await addViaBot(A, 'gagal_cek')
  assert.equal(to(A).length, 0)
  assert.equal(getState().runtime.acc_gagal_cek.lastStatus, 'live')
})

test('akun yang sedang diperiksa scheduler tidak diperiksa dua kali', async () => {
  reset()
  seedAccount('sedang_dicek', { checking: true })
  const A = buyer()
  await addViaBot(A, 'sedang_dicek')
  assert.equal(fetched, 0)
  assert.equal(to(A).length, 0)
})

test('tambahan oleh admin lewat dashboard memakai logika yang sama', async () => {
  reset()
  const account = seedAccount('dari_admin', liveRuntime)
  const A = buyer()
  subs.addSelection(A.id, 'tiktok', 'dari_admin', { byAdmin: true })
  await bot.announceIfLive(A.id, account.id)
  await notifier.flushSubscriberQueue()
  assert.equal(to(A).length, 1)
})

test('pelanggan yang tidak aktif tidak dikabari', async () => {
  reset()
  const account = seedAccount('tidak_aktif', liveRuntime)
  const A = buyer()
  subs.addSelection(A.id, 'tiktok', 'tidak_aktif')
  A.expiresAt = new Date(Date.now() - 1000).toISOString()
  await bot.announceIfLive(A.id, account.id)
  await notifier.flushSubscriberQueue()
  assert.equal(to(A).length, 0)
})
