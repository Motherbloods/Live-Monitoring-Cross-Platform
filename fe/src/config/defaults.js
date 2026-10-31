export const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', short: 'TikTok', color: '#25f4ee', hostHint: 'tiktok.com' },
  { id: 'shopee', name: 'Shopee Live', short: 'Shopee', color: '#ff6a2b', hostHint: 'shopee.co.id' },
  { id: 'youtube', name: 'YouTube Live', short: 'YouTube', color: '#ff3d3d', hostHint: 'youtube.com' },
  { id: 'instagram', name: 'Instagram Live', short: 'Instagram', color: '#d946a8', hostHint: 'instagram.com' },
  { id: 'twitch', name: 'Twitch', short: 'Twitch', color: '#9b6bff', hostHint: 'twitch.tv' }
]

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id)

export const LIMITS = {
  interval: { min: 5, max: 3600 },
  retryAttempts: { min: 0, max: 10 },
  retryDelay: { min: 1, max: 600 },
  timeoutMs: { min: 1000, max: 120000 },
  concurrency: { min: 1, max: 50 },
  recordingDuration: { min: 1, max: 1440 },
  recordingConcurrent: { min: 1, max: 10 }
}

const platformDefaults = (interval) => ({
  serviceEnabled: true,
  monitoringEnabled: true,
  checkIntervalSeconds: interval,
  retryAttempts: null,
  retryDelaySeconds: null,
  requestTimeoutMs: null,
  maxConcurrentChecks: null,
  notificationOverrides: {},
  recordingOverrides: {}
})

export const DEFAULT_CONFIG = {
  global: {
    appName: 'Live Monitor',
    timezone: 'Asia/Jakarta',
    globalMonitoringEnabled: true,
    defaultCheckIntervalSeconds: 60,
    defaultRetryAttempts: 3,
    defaultRetryDelaySeconds: 10,
    defaultRequestTimeoutMs: 15000,
    maxConcurrentChecks: 5,
    dashboardRefreshIntervalSeconds: 15,
    showOfflineAccounts: true,
    showUnknownAccounts: true,
    compactMode: false,
    notificationDefaults: {
      enabled: true,
      liveStart: true,
      liveEnd: false,
      serviceFail: true,
      serviceRecover: true,
      recordingStart: false,
      recordingFail: true
    },
    recordingDefaults: {
      autoRecording: false,
      outputDirectory: 'recordings',
      outputFormat: 'ts',
      maxDurationMinutes: 240,
      maxConcurrentRecordings: 3,
      retryOnFailure: true
    }
  },
  platforms: {
    tiktok: { ...platformDefaults(30), requestTimeoutMs: 45000 },
    shopee: platformDefaults(null),
    youtube: platformDefaults(null),
    instagram: platformDefaults(120),
    twitch: platformDefaults(null)
  }
}

export const NOTIFICATION_EVENTS = [
  ['enabled', 'Aktifkan notifikasi'],
  ['liveStart', 'Saat live dimulai'],
  ['liveEnd', 'Saat live berakhir'],
  ['serviceFail', 'Saat service gagal'],
  ['serviceRecover', 'Saat service pulih'],
  ['recordingStart', 'Saat rekaman dimulai'],
  ['recordingFail', 'Saat rekaman gagal']
]
