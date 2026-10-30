const pick = (...values) => values.find((v) => v !== null && v !== undefined)

export const resolveEffective = (account, config) => {
  const g = config.global
  const p = config.platforms[account.platformId]
  const own = account.useCustomCheckInterval ? account.customCheckIntervalSeconds : null
  return {
    checkIntervalSeconds: pick(own, p.checkIntervalSeconds, g.defaultCheckIntervalSeconds),
    intervalSource: own ? 'account' : p.checkIntervalSeconds ? 'platform' : 'global',
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
