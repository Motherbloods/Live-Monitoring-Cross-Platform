import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-notif2-'))
process.env.DB_FILE = path.join(dir, 'db.json')
process.env.SEED_DEMO = 'false'
process.env.SUBSCRIBER_BOT_TOKEN = '555:token-rahasia'
process.env.TIKTOK_CHECKER = 'real'
delete process.env.TELEGRAM_BOT_TOKEN

const { loadState, getState } = await import('../src/store/db.js')
const subs = await import('../src/services/subscription.js')
const notifier = await import('../src/services/subscriberNotifier.js')
const jobs = await import('../src/services/subscriptionJobs.js')
const bot = await import('../src/services/subscriberBot.js')
const { setPageFetcher } = await import('../src/services/tiktok.js')
const { checkAccount } = await import('../src/services/monitor.js')
const { botStatus } = await import('../src/services/botStatus.js')

loadState()
let sent = []
const fakeSender = async (chatId, text) => {
  sent.push({ chatId: String(chatId), text, at: Date.now() })
}
const to = (chatId) => sent.filter((m) => m.chatId === String(chatId))
let counter = 0

const reset = () => {
  const s = getState()
  Object.assign(s, { codes: [], subscribers: [], accounts: [], runtime: {}, logs: [] })
  s.subscriptionSettings = { allowedPlatforms: ['tiktok', 'bigo'], defaultMaxAccounts: 5, defaultDurationDays: 30, platformCaps: { tiktok: 500, bigo: 500 }, changesPerWeek: 0, blocklist: [], contactText: 'x' }
  sent = []
  notifier.setSubscriberSender(fakeSender)
  notifier.setRateLimits({ chatMs: 0, globalPerSecond: 1000, retryMs: 10 })
}
const subscriber = (opts = {}) => {
  counter += 1
  const code = subs.createCodes({ label: 'uji' })[0].code
  const { subscriber: sub } = subs.redeemCode(code, { chatId: 7000 + counter, name: `Pembeli ${counter}`, username: `p${counter}` })
  Object.assign(sub, opts)
  return sub
}
const follow = (sub, platform, username) => subs.addSelection(sub.id, platform, username).account
const live = { startedAt: '2026-10-27T13:15:00.000Z', title: 'Jualan malam', url: undefined }

test('live mulai hanya dikirim ke pengikut aktif akun itu', async () => {
  reset()
  const A = subscriber()
  const B = subscriber()
  const C = subscriber()
  const expired = subscriber()
  const revoked = subscriber()
  const blocked = subscriber()
  const acc1 = follow(A, 'tiktok', 'akun_satu')
  follow(B, 'tiktok', 'akun_satu')
  follow(expired, 'tiktok', 'akun_satu')
  follow(revoked, 'tiktok', 'akun_satu')
  follow(blocked, 'tiktok', 'akun_satu')
  follow(B, 'tiktok', 'akun_dua')
  follow(C, 'tiktok', 'akun_dua')
  expired.expiresAt = new Date(Date.now() - 1000).toISOString()
  subs.updateSubscriber(revoked.id, { status: 'revoked' })
  blocked.blocked = true
  const count = notifier.notifyFollowersLiveStart(acc1, live)
  await notifier.flushSubscriberQueue()
  assert.equal(count, 2)
  assert.deepEqual(sent.map((m) => m.chatId).sort(), [A.chatId, B.chatId].sort())
  assert.match(sent[0].text, /akun_satu sedang live di TikTok/)
  assert.match(sent[0].text, /Akun: @akun_satu/)
  assert.match(sent[0].text, /Mulai: 20:15/)
  assert.match(sent[0].text, /Judul: Jualan malam/)
  assert.match(sent[0].text, /Tonton: https:\/\/www\.tiktok\.com\/@akun_satu\/live/)
  assert.equal(to(C.chatId).length, 0)
})

test('Bigo tanpa judul, dan tautan video live dipakai bila ada', async () => {
  reset()
  const A = subscriber()
  const acc = follow(A, 'bigo', 'airah05')
  notifier.notifyFollowersLiveStart(acc, { startedAt: live.startedAt, title: 'Live Bigo' })
  await notifier.flushSubscriberQueue()
  assert.equal(sent[0].text.includes('Judul:'), false)
  assert.match(sent[0].text, /Tonton: https:\/\/www\.bigo\.tv\/user\/airah05/)
  sent = []
  notifier.notifyFollowersLiveStart(acc, { ...live, url: 'https://contoh.test/video' })
  await notifier.flushSubscriberQueue()
  assert.match(sent[0].text, /Tonton: https:\/\/contoh\.test\/video/)
})

test('live berakhir hanya untuk pengikut yang menyalakannya, lengkap dengan durasi', async () => {
  reset()
  const on = subscriber({ notifyEnd: true })
  const off = subscriber()
  const acc = follow(on, 'tiktok', 'selesai_ya')
  follow(off, 'tiktok', 'selesai_ya')
  notifier.notifyFollowersLiveEnd(acc, new Date(Date.now() - 85 * 60000).toISOString())
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 1)
  assert.equal(sent[0].chatId, on.chatId)
  assert.match(sent[0].text, /selesai live di TikTok/)
  assert.match(sent[0].text, /Durasi: 1j 25m/)
})

test('jeda per chat dihormati, chat lain tidak menunggu', async () => {
  reset()
  notifier.setRateLimits({ chatMs: 300, globalPerSecond: 1000 })
  const A = subscriber()
  const B = subscriber()
  notifier.notifySubscriber(A, 'satu')
  notifier.notifySubscriber(A, 'dua')
  notifier.notifySubscriber(B, 'tiga')
  await notifier.flushSubscriberQueue()
  const a = to(A.chatId)
  assert.equal(a.length, 2)
  assert.ok(a[1].at - a[0].at >= 270)
  assert.ok(to(B.chatId)[0].at - a[0].at < 200)
})

test('batas kirim global: 45 pesan dengan batas 20 per detik butuh sedikitnya 3 jendela waktu dan semuanya terkirim', async () => {
  reset()
  notifier.setRateLimits({ globalPerSecond: 20 })
  const people = Array.from({ length: 45 }, () => subscriber())
  const started = Date.now()
  people.forEach((p) => notifier.notifySubscriber(p, 'halo'))
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 45)
  assert.ok(Date.now() - started >= 950)
  const perSecondMax = Math.max(...Object.values(sent.reduce((acc, m) => ({ ...acc, [Math.floor(m.at / 1000)]: (acc[Math.floor(m.at / 1000)] || 0) + 1 }), {})))
  assert.ok(perSecondMax <= 40)
})

test('pembeli yang memblokir bot ditandai, tidak dicoba lagi, dan kembali normal saat ia menulis ke bot', async () => {
  reset()
  const A = subscriber()
  notifier.setSubscriberSender(async () => {
    const error = new Error('Forbidden: bot was blocked by the user')
    error.code = 403
    throw error
  })
  notifier.notifySubscriber(A, 'tes')
  await notifier.flushSubscriberQueue()
  assert.equal(A.blocked, true)
  assert.equal(notifier.notifySubscriber(A, 'lagi'), false)
  assert.ok(getState().logs.some((l) => l.message.includes('memblokir bot')))
  await bot.handleUpdate({ update_id: 90001, message: { chat: { id: A.chatId, type: 'private' }, from: {}, text: '/bantuan' } }, async () => ({}))
  assert.equal(A.blocked, false)
})

test('batas kecepatan Telegram (429) dicoba ulang, gangguan jaringan dicoba 3 kali lalu dihitung gagal', async () => {
  reset()
  const A = subscriber()
  let tries = 0
  notifier.setSubscriberSender(async (chatId, text) => {
    tries += 1
    if (tries === 1) {
      const error = new Error('Too Many Requests')
      error.code = 429
      error.retryAfter = 0.05
      throw error
    }
    sent.push({ chatId: String(chatId), text, at: Date.now() })
  })
  notifier.notifySubscriber(A, 'ulang')
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 1)

  let netTries = 0
  const failedBefore = botStatus().queue.failed
  notifier.setSubscriberSender(async () => {
    netTries += 1
    const error = new Error('Tidak dapat menghubungi Telegram.')
    error.network = true
    throw error
  })
  notifier.notifySubscriber(A, 'putus')
  await notifier.flushSubscriberQueue()
  assert.equal(netTries, 3)
  assert.equal(botStatus().queue.failed, failedBefore + 1)
})

test('tanpa token bot pembeli tidak ada yang dikirim', async () => {
  reset()
  const A = subscriber()
  const acc = follow(A, 'tiktok', 'tanpa_token')
  const token = process.env.SUBSCRIBER_BOT_TOKEN
  delete process.env.SUBSCRIBER_BOT_TOKEN
  assert.equal(notifier.notifyFollowersLiveStart(acc, live), 0)
  process.env.SUBSCRIBER_BOT_TOKEN = token
  assert.equal(sent.length, 0)
})

test('alur penuh dari pemeriksaan TikTok: pengikut dikabari saat live dan saat selesai', async () => {
  reset()
  const A = subscriber({ notifyEnd: true })
  const B = subscriber()
  const other = subscriber()
  const acc = follow(A, 'tiktok', 'alur_penuh')
  follow(B, 'tiktok', 'alur_penuh')
  follow(other, 'tiktok', 'orang_lain')
  getState().config.platforms.tiktok.retryAttempts = 0
  const page = (status) => `<script id="SIGI_STATE" type="application/json">${JSON.stringify({ LiveRoom: { liveRoomUserInfo: { liveRoom: { status, title: 'Live uji' } } } })}</script>`
  setPageFetcher(async () => page(2))
  await checkAccount(acc)
  await checkAccount(acc)
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 2)
  setPageFetcher(async () => page(4))
  await checkAccount(acc)
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 3)
  assert.equal(to(A.chatId).length, 2)
  assert.match(to(A.chatId)[1].text, /selesai live/)
  assert.equal(to(B.chatId).length, 1)
  assert.equal(to(other.chatId).length, 0)
})

test('pengingat 3 hari: sekali per tanggal habis, tidak untuk yang baru saja memperpanjang', async () => {
  reset()
  const A = subscriber()
  A.lastRenewedAt = new Date(Date.now() - 20 * 86400000).toISOString()
  A.expiresAt = new Date(Date.now() + 2 * 86400000).toISOString()
  jobs.sweep()
  jobs.sweep()
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 1)
  assert.match(sent[0].text, /2 hari lagi/)
  sent = []
  const fresh = subscriber()
  fresh.expiresAt = new Date(Date.now() + 2 * 86400000).toISOString()
  jobs.sweep()
  await notifier.flushSubscriberQueue()
  assert.equal(to(fresh.chatId).length, 0)
})

test('masa aktif habis: pemberitahuan sekali, akun yang tak diikuti dijeda, lalu aktif lagi saat diperpanjang', async () => {
  reset()
  const A = subscriber()
  const B = subscriber()
  const own = follow(A, 'tiktok', 'milik_a')
  const shared = follow(A, 'tiktok', 'bersama')
  follow(B, 'tiktok', 'bersama')
  getState().accounts.push({ id: 'acc_admin', platformId: 'tiktok', username: 'milik_admin', displayName: 'Admin', profileUrl: 'x', monitoringEnabled: true })
  A.expiresAt = new Date(Date.now() - 1000).toISOString()
  jobs.sweep()
  jobs.sweep()
  await notifier.flushSubscriberQueue()
  assert.equal(to(A.chatId).length, 1)
  assert.match(to(A.chatId)[0].text, /sudah berakhir/)
  assert.equal(own.monitoringEnabled, false)
  assert.equal(shared.monitoringEnabled, true)
  assert.equal(getState().accounts.find((a) => a.id === 'acc_admin').monitoringEnabled, true)

  const renew = subs.createCodes({ durationDays: 30 })[0].code
  subs.redeemCode(renew, { chatId: A.chatId, name: 'A', username: 'a' })
  assert.equal(own.monitoringEnabled, true)
  sent = []
  jobs.sweep()
  await notifier.flushSubscriberQueue()
  assert.equal(to(A.chatId).length, 0)
  A.expiresAt = new Date(Date.now() + 86400000).toISOString()
  A.lastRenewedAt = new Date(Date.now() - 86400000).toISOString()
  jobs.sweep()
  await notifier.flushSubscriberQueue()
  assert.equal(to(A.chatId).length, 1)
})

test('pelanggan yang dihentikan admin atau memblokir bot tidak dikirimi pengingat', async () => {
  reset()
  const revoked = subscriber()
  const blocked = subscriber({ blocked: true })
  revoked.expiresAt = new Date(Date.now() + 86400000).toISOString()
  blocked.expiresAt = new Date(Date.now() + 86400000).toISOString()
  revoked.lastRenewedAt = blocked.lastRenewedAt = new Date(Date.now() - 10 * 86400000).toISOString()
  subs.updateSubscriber(revoked.id, { status: 'revoked' })
  jobs.sweep()
  await notifier.flushSubscriberQueue()
  assert.equal(sent.length, 0)
})
