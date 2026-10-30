import { NOTIFICATION_EVENTS, PLATFORMS } from './defaults.js'

const GLOBAL_LABELS = {
  appName: 'Nama aplikasi',
  timezone: 'Zona waktu',
  globalMonitoringEnabled: 'Global monitoring',
  defaultCheckIntervalSeconds: 'Interval pemeriksaan default (detik)',
  defaultRetryAttempts: 'Retry attempts default',
  defaultRetryDelaySeconds: 'Retry delay default (detik)',
  defaultRequestTimeoutMs: 'Request timeout default (ms)',
  maxConcurrentChecks: 'Max concurrent checks',
  dashboardRefreshIntervalSeconds: 'Dashboard refresh (detik)',
  showOfflineAccounts: 'Tampilkan akun offline',
  showUnknownAccounts: 'Tampilkan akun unknown',
  compactMode: 'Compact mode'
}

const PLATFORM_LABELS = {
  serviceEnabled: 'Service',
  monitoringEnabled: 'Monitoring platform',
  checkIntervalSeconds: 'Interval (detik)',
  retryAttempts: 'Retry attempts',
  retryDelaySeconds: 'Retry delay (detik)',
  requestTimeoutMs: 'Request timeout (ms)',
  maxConcurrentChecks: 'Max concurrent checks'
}

const show = (v) => (v === null || v === undefined ? 'ikut global' : v === true ? 'Aktif' : v === false ? 'Mati' : String(v))

export const diffConfig = (before, after) => {
  const rows = []
  const push = (label, a, b) => {
    if (a !== b) rows.push({ label, before: show(a), after: show(b) })
  }
  for (const key of Object.keys(GLOBAL_LABELS)) push(GLOBAL_LABELS[key], before.global[key], after.global[key])
  for (const [key, label] of NOTIFICATION_EVENTS) push(`Notifikasi · ${label}`, before.global.notificationDefaults?.[key], after.global.notificationDefaults?.[key])
  for (const key of ['autoRecording', 'outputDirectory', 'outputFormat', 'maxDurationMinutes', 'maxConcurrentRecordings', 'retryOnFailure']) {
    push(`Rekaman · ${key}`, before.global.recordingDefaults?.[key], after.global.recordingDefaults?.[key])
  }
  for (const p of PLATFORMS) {
    push(`${p.short} · Override notifikasi`, JSON.stringify(before.platforms[p.id]?.notificationOverrides || {}), JSON.stringify(after.platforms[p.id]?.notificationOverrides || {}))
    push(`${p.short} · Override rekaman`, JSON.stringify(before.platforms[p.id]?.recordingOverrides || {}), JSON.stringify(after.platforms[p.id]?.recordingOverrides || {}))
    for (const key of Object.keys(PLATFORM_LABELS)) {
      push(`${p.short} · ${PLATFORM_LABELS[key]}`, before.platforms[p.id]?.[key], after.platforms[p.id]?.[key])
    }
  }
  return rows
}
