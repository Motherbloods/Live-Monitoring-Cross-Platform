import { DEFAULT_CONFIG, HOST_HINTS, LIMITS, PLATFORM_IDS } from './defaults.js'

const inRange = (v, { min, max }) => Number.isFinite(v) && v >= min && v <= max
const optional = (v, l) => v === null || v === undefined || inRange(v, l)

export const validateConfig = (cfg) => {
  const errors = []
  if (!cfg?.global || !cfg?.platforms) return ['Struktur konfigurasi tidak lengkap.']
  const g = cfg.global
  if (typeof g.appName !== 'string' || !g.appName.trim() || g.appName.length > 40) errors.push('appName wajib diisi, maksimal 40 karakter.')
  if (!inRange(g.defaultCheckIntervalSeconds, LIMITS.interval)) errors.push('defaultCheckIntervalSeconds di luar batas.')
  if (!inRange(g.defaultRetryAttempts, LIMITS.retryAttempts)) errors.push('defaultRetryAttempts tidak valid.')
  if (!inRange(g.defaultRetryDelaySeconds, LIMITS.retryDelay)) errors.push('defaultRetryDelaySeconds tidak valid.')
  if (!inRange(g.defaultRequestTimeoutMs, LIMITS.timeoutMs)) errors.push('defaultRequestTimeoutMs tidak valid.')
  if (!inRange(g.maxConcurrentChecks, LIMITS.concurrency)) errors.push('maxConcurrentChecks tidak valid.')
  if (typeof g.globalMonitoringEnabled !== 'boolean') errors.push('globalMonitoringEnabled harus boolean.')
  const r = g.recordingDefaults
  if (!r?.outputDirectory?.trim()) errors.push('outputDirectory rekaman wajib diisi.')
  if (!inRange(r?.maxDurationMinutes, LIMITS.recordingDuration)) errors.push('maxDurationMinutes tidak valid.')
  if (!inRange(r?.maxConcurrentRecordings, LIMITS.recordingConcurrent)) errors.push('maxConcurrentRecordings tidak valid.')
  for (const id of PLATFORM_IDS) {
    const p = cfg.platforms[id]
    if (!p) {
      errors.push(`Konfigurasi ${id} tidak ditemukan.`)
      continue
    }
    if (typeof p.serviceEnabled !== 'boolean' || typeof p.monitoringEnabled !== 'boolean') errors.push(`${id}: serviceEnabled dan monitoringEnabled harus boolean.`)
    if (!optional(p.checkIntervalSeconds, LIMITS.interval)) errors.push(`${id}: checkIntervalSeconds tidak valid.`)
    if (!optional(p.retryAttempts, LIMITS.retryAttempts)) errors.push(`${id}: retryAttempts tidak valid.`)
    if (!optional(p.retryDelaySeconds, LIMITS.retryDelay)) errors.push(`${id}: retryDelaySeconds tidak valid.`)
    if (!optional(p.requestTimeoutMs, LIMITS.timeoutMs)) errors.push(`${id}: requestTimeoutMs tidak valid.`)
    if (!optional(p.maxConcurrentChecks, LIMITS.concurrency)) errors.push(`${id}: maxConcurrentChecks tidak valid.`)
  }
  return errors
}

export const mergeConfigPatch = (current, patch) => {
  const out = JSON.parse(JSON.stringify(current))
  const errors = []
  if (patch.global) {
    for (const [key, value] of Object.entries(patch.global)) {
      if (!(key in DEFAULT_CONFIG.global)) {
        errors.push(`Kunci global tidak dikenal: ${key}`)
        continue
      }
      out.global[key] = value && typeof value === 'object' && !Array.isArray(value) ? { ...out.global[key], ...value } : value
    }
  }
  if (patch.platforms) {
    for (const [id, values] of Object.entries(patch.platforms)) {
      if (!PLATFORM_IDS.includes(id)) {
        errors.push(`Platform tidak dikenal: ${id}`)
        continue
      }
      for (const [key, value] of Object.entries(values || {})) {
        if (!(key in DEFAULT_CONFIG.platforms[id])) errors.push(`Kunci platform tidak dikenal: ${id}.${key}`)
        else out.platforms[id][key] = value
      }
    }
  }
  return { config: out, errors }
}

export const validateAccountInput = (input, accounts, editingId = null) => {
  const errors = []
  const platformId = input.platformId
  if (!PLATFORM_IDS.includes(platformId)) errors.push('platformId tidak valid.')
  let username = typeof input.username === 'string' ? input.username.trim().replace(/^@/, '') : ''
  const profileUrl = typeof input.profileUrl === 'string' ? input.profileUrl.trim() : ''
  if (!username && profileUrl) {
    try {
      username = (new URL(profileUrl).pathname.split('/').filter(Boolean)[0] || '').replace(/^@/, '')
    } catch {
      errors.push('profileUrl tidak valid.')
    }
  }
  if (!/^[A-Za-z0-9._-]{2,40}$/.test(username)) errors.push('username harus 2-40 karakter: huruf, angka, titik, garis bawah, atau strip.')
  if (profileUrl && PLATFORM_IDS.includes(platformId)) {
    try {
      if (!new URL(profileUrl).hostname.includes(HOST_HINTS[platformId])) errors.push(`profileUrl harus berasal dari ${HOST_HINTS[platformId]}.`)
    } catch {
      errors.push('profileUrl tidak valid.')
    }
  }
  if (input.useCustomCheckInterval && !inRange(Number(input.customCheckIntervalSeconds), LIMITS.interval)) errors.push('customCheckIntervalSeconds di luar batas.')
  for (const key of ['autoRecording', 'notifyEnabled', 'notifyOnStart', 'notifyOnEnd']) {
    if (input[key] !== undefined && input[key] !== null && typeof input[key] !== 'boolean') errors.push(`${key} harus boolean atau null.`)
  }
  if (typeof input.notes === 'string' && input.notes.length > 500) errors.push('notes maksimal 500 karakter.')
  if (!errors.length && accounts.some((a) => a.id !== editingId && a.platformId === platformId && a.username.toLowerCase() === username.toLowerCase())) errors.push('Akun sudah ada di platform tersebut.')
  return { errors, username }
}
