import { create } from 'zustand'
import { monitoringApi } from '../api/monitoringApi.js'
import { loadConfig, saveConfig, updateGlobalConfig, updatePlatformConfig } from '../config/configurationManager.js'
import { mockAccounts, mockActivities, mockPlatformRuntime, mockRuntime } from '../data/mockAccounts.js'
import { getEligibility } from '../utils/effectiveConfig.js'

const initial = loadConfig()
let toastId = 0

export const useAppStore = create((set, get) => ({
  config: initial.config,
  draft: initial.config,
  savedAt: initial.savedAt,
  recovered: initial.recovered,
  accounts: mockAccounts,
  runtime: mockRuntime,
  platformRuntime: mockPlatformRuntime,
  activities: mockActivities,
  lastRefresh: new Date().toISOString(),
  toasts: [],
  busy: { checkAll: false },

  pushToast: (message, tone = 'info') => {
    const id = ++toastId
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4200)
  },

  refreshDashboard: () => set({ lastRefresh: new Date().toISOString() }),

  addActivity: (entry) =>
    set((s) => ({
      activities: [{ id: `act_${Date.now()}_${Math.random()}`, at: new Date().toISOString(), level: 'info', ...entry }, ...s.activities].slice(0, 40)
    })),

  setGlobal: (patch) => {
    const config = updateGlobalConfig(get().config, patch)
    saveConfig(config)
    set({ config, draft: config, savedAt: new Date().toISOString() })
  },

  setPlatform: (id, patch) => {
    const config = updatePlatformConfig(get().config, id, patch)
    saveConfig(config)
    set({ config, draft: config, savedAt: new Date().toISOString() })
  },

  toggleGlobalMonitoring: () => {
    const enabled = !get().config.global.globalMonitoringEnabled
    get().setGlobal({ globalMonitoringEnabled: enabled })
    get().addActivity({
      type: enabled ? 'monitoring_enabled' : 'monitoring_disabled',
      platformId: null,
      text: enabled ? 'Global monitoring dihidupkan' : 'Global monitoring dijeda'
    })
    get().pushToast(enabled ? 'Global monitoring aktif kembali.' : 'Global monitoring dijeda. Status terakhir mungkin tidak aktual.', 'info')
  },

  checkAllEnabled: async () => {
    const { accounts, config, runtime } = get()
    const targets = accounts.filter((a) => getEligibility(a, config).eligible)
    if (!targets.length) {
      get().pushToast('Tidak ada akun yang memenuhi syarat pemeriksaan.', 'warn')
      return null
    }
    set((s) => ({
      busy: { ...s.busy, checkAll: true },
      runtime: { ...s.runtime, ...Object.fromEntries(targets.map((a) => [a.id, { ...s.runtime[a.id], checking: true }])) }
    }))
    const results = await monitoringApi.checkAccounts(targets, runtime)
    set((s) => ({
      busy: { ...s.busy, checkAll: false },
      lastRefresh: new Date().toISOString(),
      runtime: {
        ...s.runtime,
        ...Object.fromEntries(results.map((r) => [r.id, { ...s.runtime[r.id], ...r.patch }]))
      }
    }))
    const failed = results.filter((r) => !r.ok).length
    const summary = { total: results.length, failed, succeeded: results.length - failed }
    get().pushToast(
      failed ? `${summary.succeeded} akun diperiksa, ${failed} gagal. Status akun yang gagal tidak diubah.` : `${summary.total} akun berhasil diperiksa (simulasi).`,
      failed ? 'warn' : 'ok'
    )
    return summary
  }
}))
