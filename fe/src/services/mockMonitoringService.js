import { delay, failRate } from '../api/client.js'

const simulateOne = (account, previous) => {
  const failed = Math.random() < failRate
  const now = new Date().toISOString()
  if (failed) {
    return { id: account.id, ok: false, patch: { checking: false, lastChecked: now, lastError: 'Pemeriksaan tersimulasi gagal' } }
  }
  const goLive = previous.lastStatus === 'live' ? Math.random() > 0.15 : Math.random() < 0.12
  const patch = {
    checking: false,
    lastChecked: now,
    lastSuccess: now,
    lastError: null,
    lastStatus: goLive ? 'live' : 'offline',
    live: goLive
      ? previous.live || { title: 'Sesi live tersimulasi', startedAt: now, viewers: Math.round(40 + Math.random() * 900), simulated: true }
      : null
  }
  return { id: account.id, ok: true, patch }
}

export const checkAccounts = async (accounts, runtime) => {
  await delay(900 + Math.random() * 700)
  return accounts.map((a) => simulateOne(a, runtime[a.id] || { lastStatus: 'unknown' }))
}

export const restartPlatform = async () => {
  await delay(1200)
  return { status: 'online', lastError: null, retryCount: 0, lastSuccess: new Date().toISOString() }
}
