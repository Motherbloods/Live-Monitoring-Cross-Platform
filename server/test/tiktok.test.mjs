import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.DB_FILE = path.join(os.tmpdir(), `lm-tiktok-${Date.now()}.json`)
process.env.SEED_DEMO = 'false'

const { parseTiktokLive, setPageFetcher, tiktokChecker } = await import('../src/services/tiktok.js')
const { loadState, getState } = await import('../src/store/db.js')
const { checkAccount } = await import('../src/services/monitor.js')

const page = (state) => `<html><body><script id="SIGI_STATE" type="application/json">${JSON.stringify(state)}</script></body></html>`
const room = (extra) => ({ LiveRoom: { liveRoomUserInfo: { liveRoom: extra } } })
const livePage = page(room({ status: 2, title: 'Jualan malam', startTime: 1790000000, liveRoomStats: { userCount: 321 } }))
const offlinePage = page(room({ status: 4 }))

test('halaman live dibaca: judul, penonton, dan waktu mulai', () => {
  const r = parseTiktokLive(livePage)
  assert.equal(r.state, 'live')
  assert.equal(r.live.title, 'Jualan malam')
  assert.equal(r.live.viewers, 321)
  assert.equal(r.live.simulated, false)
  assert.equal(r.live.startedAt, new Date(1790000000 * 1000).toISOString())
})

test('status selain 2 dianggap offline', () => {
  assert.equal(parseTiktokLive(offlinePage).state, 'offline')
})

test('halaman tanpa SIGI_STATE dan data rusak dianggap gagal, bukan offline', () => {
  assert.throws(() => parseTiktokLive('<html></html>'), /tidak ditemukan/)
  assert.throws(() => parseTiktokLive('<script id="SIGI_STATE">{rusak</script>'), /tidak bisa dibaca/)
  assert.throws(() => parseTiktokLive(page({ Lain: {} })), /tidak dikenali/)
})

test('username tidak valid ditolak sebelum membuka halaman', async () => {
  let calls = 0
  setPageFetcher(async () => {
    calls += 1
    return livePage
  })
  await assert.rejects(() => tiktokChecker({ username: '../etc/passwd' }, null), /tidak valid/)
  assert.equal(calls, 0)
})

test('mencoba ulang sekali jika halaman pertama kosong', async () => {
  let calls = 0
  setPageFetcher(async () => {
    calls += 1
    return calls === 1 ? '<html></html>' : livePage
  })
  const result = await tiktokChecker({ username: 'nadia.putri' }, null)
  assert.equal(result.status, 'live')
  assert.equal(calls, 2)
})

test('alur penuh: live membuka riwayat, offline menutupnya, kegagalan tidak mengubah status', async () => {
  loadState()
  const state = getState()
  const account = { id: 'acc_t', platformId: 'tiktok', username: 'nadia.putri', displayName: 'Nadia', profileUrl: 'https://www.tiktok.com/@nadia.putri', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null }
  state.accounts.push(account)
  state.runtime[account.id] = { checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null }
  state.config.global.defaultRetryAttempts = 0
  state.config.platforms.tiktok.retryAttempts = 0
  process.env.TIKTOK_CHECKER = 'real'

  setPageFetcher(async () => livePage)
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.equal(state.history.filter((h) => h.accountId === account.id && !h.endAt).length, 1)

  const successBefore = state.runtime[account.id].lastSuccess
  setPageFetcher(async () => {
    throw new Error('Diblokir')
  })
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'live')
  assert.equal(state.runtime[account.id].lastSuccess, successBefore)
  assert.equal(state.runtime[account.id].lastError, 'Diblokir')

  setPageFetcher(async () => offlinePage)
  await checkAccount(account)
  assert.equal(state.runtime[account.id].lastStatus, 'offline')
  assert.equal(state.history.filter((h) => h.accountId === account.id && !h.endAt).length, 0)
  assert.equal(state.history.find((h) => h.accountId === account.id).status, 'ended')
})
