import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.DB_FILE = path.join(os.tmpdir(), `lm-twitch-${Date.now()}.json`)
process.env.SEED_DEMO = 'false'
process.env.TWITCH_CLIENT_ID = 'id-uji'
process.env.TWITCH_CLIENT_SECRET = 'rahasia-uji-123'
process.env.TWITCH_CHECKER = 'real'

const { twitchChecker, resetTwitchCache } = await import('../src/services/twitch.js')
const { loadState, getState } = await import('../src/store/db.js')
const { checkAccount } = await import('../src/services/monitor.js')
const { validateAccountInput } = await import('../src/config/validation.js')

const realFetch = globalThis.fetch
let calls = []
let routes = {}

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), options })
  const u = new URL(url)
  const handler = routes[u.origin + u.pathname]
  if (!handler) throw new Error(`rute tidak disiapkan: ${url}`)
  return handler(u, options)
}

const setup = (extra = {}) => {
  calls = []
  resetTwitchCache()
  routes = {
    'https://id.twitch.tv/oauth2/token': () => json(200, { access_token: 'tok-1', expires_in: 5000 }),
    'https://api.twitch.tv/helix/streams': () => json(200, { data: [] }),
    'https://api.twitch.tv/helix/users': () => json(200, { data: [{ id: '1' }] }),
    ...extra
  }
}
const acc = (username = 'pixel_raka') => ({ username })
const count = (needle) => calls.filter((c) => c.url.includes(needle)).length

test('stream live: judul, game, penonton, waktu mulai, dan header yang benar', async () => {
  setup({ 'https://api.twitch.tv/helix/streams': () => json(200, { data: [{ type: 'live', title: 'Speedrun santai', game_name: 'Celeste', viewer_count: 203, started_at: '2026-10-27T12:00:00Z' }] }) })
  const r = await twitchChecker(acc(), null)
  assert.equal(r.status, 'live')
  assert.equal(r.live.title, 'Speedrun santai')
  assert.equal(r.live.game, 'Celeste')
  assert.equal(r.live.viewers, 203)
  assert.equal(r.live.startedAt, '2026-10-27T12:00:00Z')
  assert.equal(r.live.simulated, false)
  const api = calls.find((c) => c.url.includes('/helix/streams'))
  assert.equal(api.options.headers.Authorization, 'Bearer tok-1')
  assert.equal(api.options.headers['Client-Id'], 'id-uji')
  assert.match(api.url, /user_login=pixel_raka/)
  const tokenCall = calls.find((c) => c.url.includes('oauth2/token'))
  assert.match(String(tokenCall.options.body), /grant_type=client_credentials/)
})

test('token dipakai ulang, akun offline diverifikasi sekali saja', async () => {
  setup()
  assert.equal((await twitchChecker(acc(), null)).status, 'offline')
  assert.equal((await twitchChecker(acc(), null)).status, 'offline')
  assert.equal(count('oauth2/token'), 1)
  assert.equal(count('/helix/users'), 1)
})

test('akun yang tidak ada dianggap gagal, bukan offline', async () => {
  setup({ 'https://api.twitch.tv/helix/users': () => json(200, { data: [] }) })
  await assert.rejects(() => twitchChecker(acc('akun_hantu'), null), /tidak ditemukan/)
})

test('token ditolak (401) diambil ulang lalu dicoba sekali lagi', async () => {
  let first = true
  setup({
    'https://api.twitch.tv/helix/streams': () => {
      if (first) {
        first = false
        return json(401, { message: 'Invalid OAuth token' })
      }
      return json(200, { data: [] })
    }
  })
  assert.equal((await twitchChecker(acc(), null)).status, 'offline')
  assert.equal(count('oauth2/token'), 2)
})

test('rate limit dan kredensial salah menghasilkan pesan jelas tanpa rahasia', async () => {
  setup({ 'https://api.twitch.tv/helix/streams': () => json(429, {}) })
  await assert.rejects(() => twitchChecker(acc(), null), /rate limit/)
  setup({ 'https://id.twitch.tv/oauth2/token': () => json(400, { message: 'invalid client secret rahasia-uji-123' }) })
  await assert.rejects(() => twitchChecker(acc(), null), (e) => !e.message.includes('rahasia-uji-123') && /token/.test(e.message))
})

test('username tidak valid dan kredensial kosong ditolak tanpa memanggil Twitch', async () => {
  setup()
  await assert.rejects(() => twitchChecker(acc('a b/../'), null), /tidak valid/)
  assert.equal(calls.length, 0)
  const id = process.env.TWITCH_CLIENT_ID
  delete process.env.TWITCH_CLIENT_ID
  await assert.rejects(() => twitchChecker(acc(), null), /Kredensial Twitch belum diisi/)
  process.env.TWITCH_CLIENT_ID = id
  assert.equal(calls.length, 0)
})

test('validasi akun: username Twitch dan TikTok mengikuti aturan platformnya', () => {
  const ok = (platformId, username) => validateAccountInput({ platformId, username }, []).errors.length === 0
  assert.equal(ok('twitch', 'pixel_raka'), true)
  assert.equal(ok('twitch', 'gita.codes'), false)
  assert.equal(ok('twitch', 'abc'), false)
  assert.equal(ok('tiktok', 'nadia.putri'), true)
})

test('alur penuh: live membuka riwayat, offline menutupnya, error tidak mengubah status', async () => {
  loadState()
  const state = getState()
  const account = { id: 'acc_tw', platformId: 'twitch', username: 'pixel_raka', displayName: 'Pixel Raka', profileUrl: 'https://www.twitch.tv/pixel_raka', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null }
  state.accounts.push(account)
  state.runtime[account.id] = { checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null }
  state.config.platforms.twitch.retryAttempts = 0

  setup({ 'https://api.twitch.tv/helix/streams': () => json(200, { data: [{ type: 'live', title: 'Uji', game_name: 'X', viewer_count: 5, started_at: new Date().toISOString() }] }) })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.equal(state.history.filter((h) => h.accountId === account.id && !h.endAt).length, 1)

  routes['https://api.twitch.tv/helix/streams'] = () => json(500, {})
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.match(state.runtime[account.id].lastError, /500/)

  routes['https://api.twitch.tv/helix/streams'] = () => json(200, { data: [] })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'offline')
  assert.equal(state.history.find((h) => h.accountId === account.id).status, 'ended')
})

test.after(() => {
  globalThis.fetch = realFetch
})
