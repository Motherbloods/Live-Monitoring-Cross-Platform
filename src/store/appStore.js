import { create } from 'zustand'
import { accountsApi } from '../api/accountsApi.js'
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

  addAccount: async (form, username) => {
    const account = await accountsApi.create(form, username)
    set((s) => ({
      accounts: [account, ...s.accounts],
      runtime: { ...s.runtime, [account.id]: { checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null } }
    }))
    get().addActivity({ type: 'config_updated', platformId: account.platformId, text: `Akun ${account.displayName} ditambahkan` })
    get().pushToast(`${account.displayName} ditambahkan. Statusnya Unknown sampai diperiksa.`, 'ok')
    return account
  },

  updateAccount: async (id, patch) => {
    await accountsApi.update(patch)
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) }))
    get().addActivity({ type: 'config_updated', platformId: patch.platformId || null, text: `Konfigurasi ${patch.displayName || 'akun'} diperbarui` })
    get().pushToast('Perubahan akun disimpan.', 'ok')
  },

  deleteAccount: async (id) => {
    const account = get().accounts.find((a) => a.id === id)
    await accountsApi.remove(id)
    set((s) => {
      const { [id]: removed, ...rest } = s.runtime
      return { accounts: s.accounts.filter((a) => a.id !== id), runtime: rest }
    })
    get().addActivity({ type: 'config_updated', platformId: account.platformId, text: `Akun ${account.displayName} dihapus` })
    get().pushToast(`${account.displayName} dihapus. Riwayat live tetap tersimpan.`, 'info')
  },

  setAccountMonitoring: async (id, enabled) => {
    const account = get().accounts.find((a) => a.id === id)
    await accountsApi.update({ monitoringEnabled: enabled })
    set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, monitoringEnabled: enabled } : a)) }))
    get().addActivity({
      type: enabled ? 'monitoring_enabled' : 'monitoring_disabled',
      platformId: account.platformId,
      text: `Monitoring ${account.displayName} ${enabled ? 'diaktifkan' : 'dinonaktifkan'}`
    })
  },

  checkAccount: async (id) => {
    const { accounts, runtime } = get()
    const account = accounts.find((a) => a.id === id)
    set((s) => ({ runtime: { ...s.runtime, [id]: { ...s.runtime[id], checking: true } } }))
    const [result] = await monitoringApi.checkAccounts([account], runtime)
    set((s) => ({ lastRefresh: new Date().toISOString(), runtime: { ...s.runtime, [id]: { ...s.runtime[id], ...result.patch } } }))
    const status = result.patch.lastStatus
    get().pushToast(
      result.ok ? `${account.displayName}: ${status === 'live' ? 'sedang live' : 'tidak live'} (simulasi).` : `Pemeriksaan ${account.displayName} gagal. Status sebelumnya tidak diubah.`,
      result.ok ? 'ok' : 'warn'
    )
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
