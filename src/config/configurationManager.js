import { DEFAULT_CONFIG, LIMITS, PLATFORMS } from './defaults.js'

const STORAGE_KEY = 'livemonitor.config.v1'

const clone = (v) => JSON.parse(JSON.stringify(v))

export const getGlobalConfig = (cfg) => cfg.global
export const getPlatformConfig = (cfg, id) => cfg.platforms[id]
export const updateGlobalConfig = (cfg, patch) => ({ ...cfg, global: { ...cfg.global, ...patch } })
export const updatePlatformConfig = (cfg, id, patch) => ({
  ...cfg,
  platforms: { ...cfg.platforms, [id]: { ...cfg.platforms[id], ...patch } }
})
export const resetToDefaults = () => clone(DEFAULT_CONFIG)

const inRange = (value, { min, max }) => Number.isFinite(value) && value >= min && value <= max
const optionalInRange = (value, range) => value === null || value === undefined || inRange(value, range)

export const validateConfig = (cfg) => {
  const errors = []
  if (!cfg || typeof cfg !== 'object' || !cfg.global || !cfg.platforms) return ['Struktur konfigurasi tidak lengkap.']
  const g = cfg.global
  if (typeof g.appName !== 'string' || !g.appName.trim() || g.appName.length > 40) errors.push('Nama aplikasi wajib diisi (maksimal 40 karakter).')
  if (!inRange(g.defaultCheckIntervalSeconds, LIMITS.interval)) errors.push('Interval global di luar batas yang diizinkan.')
  if (!inRange(g.defaultRetryAttempts, LIMITS.retryAttempts)) errors.push('Retry attempts global tidak valid.')
  if (!inRange(g.defaultRetryDelaySeconds, LIMITS.retryDelay)) errors.push('Retry delay global tidak valid.')
  if (!inRange(g.defaultRequestTimeoutMs, LIMITS.timeoutMs)) errors.push('Request timeout global tidak valid.')
  if (!inRange(g.maxConcurrentChecks, LIMITS.concurrency)) errors.push('Maximum concurrent checks global tidak valid.')
  for (const p of PLATFORMS) {
    const pc = cfg.platforms[p.id]
    if (!pc) {
      errors.push(`Konfigurasi ${p.name} tidak ditemukan.`)
      continue
    }
    if (!optionalInRange(pc.checkIntervalSeconds, LIMITS.interval)) errors.push(`Interval ${p.name} tidak valid.`)
    if (!optionalInRange(pc.retryAttempts, LIMITS.retryAttempts)) errors.push(`Retry attempts ${p.name} tidak valid.`)
    if (!optionalInRange(pc.retryDelaySeconds, LIMITS.retryDelay)) errors.push(`Retry delay ${p.name} tidak valid.`)
    if (!optionalInRange(pc.requestTimeoutMs, LIMITS.timeoutMs)) errors.push(`Request timeout ${p.name} tidak valid.`)
    if (!optionalInRange(pc.maxConcurrentChecks, LIMITS.concurrency)) errors.push(`Concurrent checks ${p.name} tidak valid.`)
  }
  return errors
}

export const loadConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { config: clone(DEFAULT_CONFIG), savedAt: null, recovered: false }
    const parsed = JSON.parse(raw)
    if (validateConfig(parsed.config).length) throw new Error('invalid')
    return { config: parsed.config, savedAt: parsed.savedAt, recovered: false }
  } catch {
    return { config: clone(DEFAULT_CONFIG), savedAt: null, recovered: true }
  }
}

export const saveConfig = (cfg) => {
  const savedAt = new Date().toISOString()
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: cfg, savedAt }))
  return savedAt
}

export const exportConfig = (cfg) => JSON.stringify({ version: 1, config: cfg }, null, 2)

export const importConfig = (text) => {
  try {
    const parsed = JSON.parse(text)
    const errors = validateConfig(parsed.config)
    return errors.length ? { ok: false, errors } : { ok: true, config: parsed.config }
  } catch {
    return { ok: false, errors: ['File bukan JSON yang valid.'] }
  }
}
