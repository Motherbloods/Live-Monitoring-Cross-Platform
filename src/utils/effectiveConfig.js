import { PLATFORM_IDS } from '../config/defaults.js'

const pick = (...values) => values.find((v) => v !== null && v !== undefined)

export const resolveEffectiveConfig = (account, config) => {
  const g = config.global
  const p = config.platforms[account.platformId]
  const own = account.useCustomCheckInterval ? account.customCheckIntervalSeconds : null
  const source = own ? 'account' : p.checkIntervalSeconds ? 'platform' : 'global'
  return {
    checkIntervalSeconds: pick(own, p.checkIntervalSeconds, g.defaultCheckIntervalSeconds),
    intervalSource: source,
    retryAttempts: pick(p.retryAttempts, g.defaultRetryAttempts),
    retryDelaySeconds: pick(p.retryDelaySeconds, g.defaultRetryDelaySeconds),
    requestTimeoutMs: pick(p.requestTimeoutMs, g.defaultRequestTimeoutMs),
    maxConcurrentChecks: pick(p.maxConcurrentChecks, g.maxConcurrentChecks)
  }
}

export const getEligibility = (account, config) => {
  const p = config.platforms[account.platformId]
  if (!config.global.globalMonitoringEnabled) return { eligible: false, reason: 'Global monitoring dimatikan' }
  if (!p.serviceEnabled) return { eligible: false, reason: 'Service platform dimatikan' }
  if (!p.monitoringEnabled) return { eligible: false, reason: 'Monitoring platform dimatikan' }
  if (!account.monitoringEnabled) return { eligible: false, reason: 'Monitoring akun dimatikan' }
  return { eligible: true, reason: 'Memenuhi semua syarat' }
}

export const getDisplayStatus = (account, runtime, platformRuntime, config) => {
  if (!account.monitoringEnabled) return 'disabled'
  const r = runtime[account.id]
  if (!r) return 'unknown'
  if (r.checking) return 'checking'
  const svc = platformRuntime[account.platformId]?.status
  const untrusted =
    !config.global.globalMonitoringEnabled ||
    !config.platforms[account.platformId].serviceEnabled ||
    svc === 'offline'
  if (untrusted && (r.lastStatus === 'live' || r.lastStatus === 'offline')) return 'unknown'
  return r.lastStatus
}

export const computeStats = (accounts, runtime, platformRuntime, config) => {
  const statuses = accounts.map((a) => getDisplayStatus(a, runtime, platformRuntime, config))
  const count = (s) => statuses.filter((x) => x === s).length
  const enabledServices = PLATFORM_IDS.filter((id) => config.platforms[id].serviceEnabled)
  return {
    total: accounts.length,
    enabled: accounts.filter((a) => a.monitoringEnabled).length,
    live: count('live'),
    offline: count('offline'),
    unknown: count('unknown') + count('error'),
    disabled: count('disabled'),
    eligible: accounts.filter((a) => getEligibility(a, config).eligible).length,
    activeServices: enabledServices.filter((id) => platformRuntime[id]?.status !== 'offline').length,
    disabledServices: PLATFORM_IDS.length - enabledServices.length,
    degradedServices: enabledServices.filter((id) => platformRuntime[id]?.status === 'degraded').length
  }
}

export const getGlobalStatus = (config, platformRuntime) => {
  if (!config.global.globalMonitoringEnabled) return 'stopped'
  const ids = PLATFORM_IDS.filter((id) => config.platforms[id].serviceEnabled)
  if (!ids.length) return 'stopped'
  if (ids.some((id) => platformRuntime[id]?.status === 'starting')) return 'starting'
  const healthy = ids.filter((id) => platformRuntime[id]?.status === 'online')
  return healthy.length === PLATFORM_IDS.length ? 'running' : 'partial'
}

export const getPlatformSummary = (platformId, accounts, runtime, platformRuntime, config) => {
  const own = accounts.filter((a) => a.platformId === platformId)
  const statuses = own.map((a) => ({ a, st: getDisplayStatus(a, runtime, platformRuntime, config) }))
  return {
    total: own.length,
    enabled: own.filter((a) => a.monitoringEnabled).length,
    live: statuses.filter((x) => x.st === 'live').length,
    unable: statuses.filter((x) => x.a.monitoringEnabled && (x.st === 'unknown' || x.st === 'error')).length,
    eligible: own.filter((a) => getEligibility(a, config).eligible).length
  }
}

export const getServiceStatus = (platformId, platformRuntime, config) => {
  if (!config.platforms[platformId].serviceEnabled) return 'svcDisabled'
  const st = platformRuntime[platformId]?.status
  return st === 'offline' ? 'svcOffline' : st
}

export const resolvePlatformNotifications = (platformId, config) => ({
  ...config.global.notificationDefaults,
  ...config.platforms[platformId].notificationOverrides
})

export const resolvePlatformRecording = (platformId, config) => ({
  ...config.global.recordingDefaults,
  ...config.platforms[platformId].recordingOverrides
})

export const resolveAccountNotifications = (account, config) => {
  const base = resolvePlatformNotifications(account.platformId, config)
  return {
    ...base,
    enabled: account.notifyEnabled ?? base.enabled,
    liveStart: account.notifyOnStart ?? base.liveStart,
    liveEnd: account.notifyOnEnd ?? base.liveEnd
  }
}

export const resolveAccountRecording = (account, config) => ({
  ...resolvePlatformRecording(account.platformId, config),
  autoRecording: account.autoRecording ?? resolvePlatformRecording(account.platformId, config).autoRecording
})
