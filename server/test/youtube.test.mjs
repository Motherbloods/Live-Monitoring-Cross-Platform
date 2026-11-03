import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.DB_FILE = path.join(os.tmpdir(), `lm-youtube-${Date.now()}.json`)
process.env.SEED_DEMO = 'false'
process.env.YOUTUBE_API_KEY = 'AIza-kunci-rahasia'
process.env.YOUTUBE_CHECKER = 'real'

const { youtubeChecker, resetYoutubeCache, youtubeUsage } = await import('../src/services/youtube.js')
const { loadState, getState } = await import('../src/store/db.js')
const { checkAccount } = await import('../src/services/monitor.js')
const { validateAccountInput, defaultProfileUrl } = await import('../src/config/validation.js')

const realFetch = globalThis.fetch
let calls = []
let routes = {}
const CHANNEL = 'UC' + 'a'.repeat(22)
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

globalThis.fetch = async (url) => {
  const u = new URL(url)
  calls.push(u)
  const handler = routes[u.pathname]
  if (!handler) throw new Error(`rute tidak disiapkan: ${u.pathname}`)
  return handler(u)
}

const video = (id, state, extra = {}) => ({ id, snippet: { title: `Video ${id}`, liveBroadcastContent: state }, liveStreamingDetails: extra })
const setup = (extra = {}) => {
  calls = []
  resetYoutubeCache()
  routes = {
    '/youtube/v3/channels': () => json(200, { items: [{ id: CHANNEL }] }),
    '/youtube/v3/playlistItems': () => json(200, { items: [{ contentDetails: { videoId: 'v1' } }, { contentDetails: { videoId: 'v2' } }] }),
    '/youtube/v3/videos': (u) => json(200, { items: u.searchParams.get('id').split(',').map((id) => video(id, 'none')) }),
    ...extra
  }
}
const count = (name) => calls.filter((c) => c.pathname.endsWith(`/${name}`)).length
const acc = (username = 'WarungTekno') => ({ username })

test('live terdeteksi dari daftar unggahan: judul, penonton, waktu mulai, tautan video', async () => {
  setup({ '/youtube/v3/videos': () => json(200, { items: [video('v1', 'none'), video('v2', 'live', { actualStartTime: '2026-10-27T12:00:00Z', concurrentViewers: '486' })] }) })
  const r = await youtubeChecker(acc(), null)
  assert.equal(r.status, 'live')
  assert.equal(r.live.videoId, 'v2')
  assert.equal(r.live.url, 'https://www.youtube.com/watch?v=v2')
  assert.equal(r.live.viewers, 486)
  assert.equal(r.live.startedAt, '2026-10-27T12:00:00Z')
  assert.equal(r.live.simulated, false)
  const channelsCall = calls.find((c) => c.pathname.endsWith('/channels'))
  assert.equal(channelsCall.searchParams.get('forHandle'), '@WarungTekno')
  assert.equal(channelsCall.searchParams.get('key'), 'AIza-kunci-rahasia')
  assert.equal(calls.find((c) => c.pathname.endsWith('/playlistItems')).searchParams.get('playlistId'), 'UU' + 'a'.repeat(22))
})

test('hemat kuota: handle dan video lama disimpan, pemeriksaan offline berikutnya hanya 1 unit', async () => {
  setup()
  assert.equal((await youtubeChecker(acc(), null)).status, 'offline')
  const first = youtubeUsage().units
  assert.equal(first, 3)
  assert.equal((await youtubeChecker(acc(), null)).status, 'offline')
  assert.equal(youtubeUsage().units - first, 1)
  assert.equal(count('channels'), 1)
  assert.equal(count('videos'), 1)
})

test('siaran terjadwal (upcoming) tetap diperiksa ulang', async () => {
  setup({ '/youtube/v3/videos': (u) => json(200, { items: u.searchParams.get('id').split(',').map((id) => video(id, id === 'v2' ? 'upcoming' : 'none')) }) })
  await youtubeChecker(acc(), null)
  await youtubeChecker(acc(), null)
  assert.equal(count('videos'), 2)
  assert.match(calls.filter((c) => c.pathname.endsWith('/videos'))[1].searchParams.get('id'), /^v2$/)
})

test('akun yang sudah live hanya perlu satu panggilan untuk memastikan masih live', async () => {
  setup({ '/youtube/v3/videos': () => json(200, { items: [video('v9', 'live', { concurrentViewers: '12' })] }) })
  const r = await youtubeChecker(acc(), { lastStatus: 'live', live: { videoId: 'v9', startedAt: '2026-10-27T10:00:00Z' } })
  assert.equal(r.status, 'live')
  assert.equal(r.live.viewers, 12)
  assert.equal(r.live.startedAt, '2026-10-27T10:00:00Z')
  assert.equal(calls.length, 2)
  assert.equal(count('playlistItems'), 0)
})

test('ID channel langsung dipakai tanpa mencari handle', async () => {
  setup()
  await youtubeChecker(acc(CHANNEL), null)
  assert.equal(count('channels'), 0)
})

test('kuota habis: pesan jelas, lalu pemeriksaan berikutnya gagal cepat tanpa memanggil YouTube', async () => {
  setup({ '/youtube/v3/playlistItems': () => json(403, { error: { message: 'quota', errors: [{ reason: 'quotaExceeded' }] } }) })
  await assert.rejects(() => youtubeChecker(acc(), null), /Kuota harian YouTube habis/)
  const before = calls.length
  await assert.rejects(() => youtubeChecker(acc(), null), /Kuota harian YouTube habis/)
  assert.equal(calls.length, before)
})

test('API key salah, API belum aktif, dan channel tidak ada memberi pesan jelas tanpa kunci', async () => {
  setup({ '/youtube/v3/channels': () => json(400, { error: { message: 'API key not valid. AIza-kunci-rahasia', errors: [{ reason: 'keyInvalid' }] } }) })
  await assert.rejects(() => youtubeChecker(acc(), null), (e) => /tidak valid/.test(e.message) && !e.message.includes('AIza-kunci-rahasia'))
  setup({ '/youtube/v3/channels': () => json(403, { error: { message: 'x', errors: [{ reason: 'accessNotConfigured' }] } }) })
  await assert.rejects(() => youtubeChecker(acc(), null), /belum diaktifkan/)
  setup({ '/youtube/v3/channels': () => json(200, {}) })
  await assert.rejects(() => youtubeChecker(acc('akun_hantu'), null), /tidak ditemukan/)
  setup({ '/youtube/v3/playlistItems': () => json(404, { error: { message: 'x', errors: [{ reason: 'playlistNotFound' }] } }) })
  await assert.rejects(() => youtubeChecker(acc(), null), /belum punya video/)
})

test('username tidak valid dan kunci kosong ditolak tanpa memanggil YouTube', async () => {
  setup()
  await assert.rejects(() => youtubeChecker(acc('a b/../x'), null), /tidak valid/)
  assert.equal(calls.length, 0)
  const key = process.env.YOUTUBE_API_KEY
  delete process.env.YOUTUBE_API_KEY
  await assert.rejects(() => youtubeChecker(acc(), null), /API key YouTube belum diisi/)
  process.env.YOUTUBE_API_KEY = key
  assert.equal(calls.length, 0)
})

test('URL profil YouTube dan tautan bawaan diturunkan dengan benar', () => {
  const ok = (url) => validateAccountInput({ platformId: 'youtube', username: '', profileUrl: url }, [])
  assert.equal(ok('https://www.youtube.com/@WarungTekno').username, 'WarungTekno')
  assert.equal(ok(`https://www.youtube.com/channel/${CHANNEL}`).username, CHANNEL)
  assert.ok(ok('https://www.youtube.com/c/NamaLama').errors.length > 0)
  assert.equal(defaultProfileUrl('youtube', 'WarungTekno'), 'https://www.youtube.com/@WarungTekno')
  assert.equal(defaultProfileUrl('youtube', CHANNEL), `https://www.youtube.com/channel/${CHANNEL}`)
  assert.equal(defaultProfileUrl('twitch', 'pixel_raka'), 'https://www.twitch.tv/pixel_raka')
})

test('alur penuh: live membuka riwayat, selesai menutupnya, error tidak mengubah status', async () => {
  loadState()
  const state = getState()
  const account = { id: 'acc_yt', platformId: 'youtube', username: 'WarungTekno', displayName: 'Warung Tekno', profileUrl: 'https://www.youtube.com/@WarungTekno', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null }
  state.accounts.push(account)
  state.runtime[account.id] = { checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null }
  state.config.platforms.youtube.retryAttempts = 0

  setup({ '/youtube/v3/videos': () => json(200, { items: [video('v1', 'live', { actualStartTime: new Date().toISOString(), concurrentViewers: '7' })] }) })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.equal(state.runtime[account.id].live.videoId, 'v1')
  assert.equal(state.history.filter((h) => h.accountId === account.id && !h.endAt).length, 1)

  routes['/youtube/v3/videos'] = () => json(500, { error: { message: 'gangguan' } })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.match(state.runtime[account.id].lastError, /500/)

  routes['/youtube/v3/videos'] = () => json(200, { items: [video('v1', 'none')] })
  routes['/youtube/v3/playlistItems'] = () => json(200, { items: [{ contentDetails: { videoId: 'v1' } }] })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'offline')
  assert.equal(state.history.find((h) => h.accountId === account.id).status, 'ended')
})

test.after(() => {
  globalThis.fetch = realFetch
})
