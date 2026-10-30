import { addLog, getState, persist } from '../store/db.js'
import { checkers } from './checkers.js'
import { getEligibility, resolveEffective } from '../utils/effectiveConfig.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const dueAt = new Map()
const failStreak = {}
const runningByPlatform = {}
let ticking = false
let timer = null

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Permintaan melewati batas waktu')), ms))])

const syncHistory = (account, before, after) => {
  const { history } = getState()
  if (before !== 'live' && after.status === 'live') {
    history.unshift({
      id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      accountId: account.id,
      displayName: account.displayName,
      username: account.username,
      platformId: account.platformId,
      startAt: after.live.startedAt,
      endAt: null,
      status: 'live',
      url: account.profileUrl
    })
  }
  if (before === 'live' && after.status !== 'live') {
    const open = history.find((h) => h.accountId === account.id && !h.endAt)
    if (open) {
      open.endAt = new Date().toISOString()
      open.status = 'ended'
    }
  }
}

export const checkAccount = async (account, { retry = true } = {}) => {
  const state = getState()
  const runtime = state.runtime[account.id]
  const platform = state.platformRuntime[account.platformId]
  const eff = resolveEffective(account, state.config)
  runtime.checking = true
  runningByPlatform[account.platformId] = (runningByPlatform[account.platformId] || 0) + 1
  const attempts = retry ? eff.retryAttempts : 0
  let result = null
  let error = null

  for (let i = 0; i <= attempts; i += 1) {
    try {
      result = await withTimeout(checkers[account.platformId](account, runtime), eff.requestTimeoutMs)
      error = null
      break
    } catch (e) {
      error = e
      if (i < attempts) await sleep(eff.retryDelaySeconds * 1000)
    }
  }

  const now = new Date().toISOString()
  runtime.checking = false
  runningByPlatform[account.platformId] -= 1
  dueAt.set(account.id, Date.now() + eff.checkIntervalSeconds * 1000)

  if (result) {
    const before = runtime.lastStatus
    syncHistory(account, before, result)
    Object.assign(runtime, { lastStatus: result.status, live: result.live, lastChecked: now, lastSuccess: now, lastError: null })
    failStreak[account.platformId] = 0
    if (platform.status !== 'online' && platform.status !== 'starting') {
      platform.status = 'online'
      addLog(account.platformId, 'INFO', 'Service pulih')
    }
    Object.assign(platform, { lastSuccess: now, lastError: null, retryCount: 0 })
    if (before !== result.status && (before === 'live' || result.status === 'live')) {
      addLog(account.platformId, 'INFO', `${account.displayName} ${result.status === 'live' ? 'terdeteksi live' : 'selesai live'}`)
    }
  } else {
    runtime.lastChecked = now
    runtime.lastError = error.message
    failStreak[account.platformId] = (failStreak[account.platformId] || 0) + 1
    platform.retryCount = failStreak[account.platformId]
    platform.lastError = error.message
    platform.status = failStreak[account.platformId] >= 3 ? 'offline' : 'degraded'
    addLog(account.platformId, platform.status === 'offline' ? 'ERROR' : 'WARN', `Pemeriksaan ${account.displayName} gagal: ${error.message}`)
  }
  persist()
  return { id: account.id, ok: Boolean(result), error: error?.message || null }
}

const runPool = async (accounts, limit, options) => {
  const queue = [...accounts]
  const results = []
  const worker = async () => {
    while (queue.length) results.push(await checkAccount(queue.shift(), options))
  }
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker))
  return results
}

export const checkMany = (accounts, options = { retry: false }) => runPool(accounts, getState().config.global.maxConcurrentChecks, options)

export const resetPlatformFailures = (platformId) => {
  failStreak[platformId] = 0
}

const tick = async () => {
  if (ticking) return
  ticking = true
  try {
    const { accounts, runtime, config } = getState()
    const now = Date.now()
    let slots = config.global.maxConcurrentChecks - Object.values(runtime).filter((r) => r.checking).length
    for (const account of accounts) {
      if (slots <= 0) break
      if (!getEligibility(account, config).eligible || runtime[account.id].checking) continue
      if ((runningByPlatform[account.platformId] || 0) >= resolveEffective(account, config).maxConcurrentChecks) continue
      if ((dueAt.get(account.id) || 0) > now) continue
      slots -= 1
      dueAt.set(account.id, now + 60000)
      checkAccount(account).catch(() => {})
    }
  } finally {
    ticking = false
  }
}

export const nextCheckAt = (accountId) => dueAt.get(accountId) || null

export const startScheduler = () => {
  timer = setInterval(tick, 1000)
  timer.unref?.()
}

export const stopScheduler = () => clearInterval(timer)
