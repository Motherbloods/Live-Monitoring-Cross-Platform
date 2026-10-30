import { create } from 'zustand'
import { accountsApi } from '../api/accountsApi.js'
import { monitoringApi } from '../api/monitoringApi.js'
import { platformsApi } from '../api/platformsApi.js'
import { loadConfig, saveConfig, updateGlobalConfig, updatePlatformConfig } from '../config/configurationManager.js'
import { mockLogs } from '../data/mockLogs.js'
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
  logs: mockLogs,
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

  addLog: (platformId, level, message) =>
    set((s) => ({ logs: [{ id: `log_${Date.now()}_${Math.random()}`, platformId, level, message, at: new Date().toISOString() }, ...s.logs].slice(0, 200) })),

  setPlatformRuntime: (id, patch) => set((s) => ({ platformRuntime: { ...s.platformRuntime, [id]: { ...s.platformRuntime[id], ...patch } } })),

  savePlatformConfig: async (id, patch) => {
    await platformsApi.saveConfig(id, patch)
    get().setPlatform(id, patch)
    get().addActivity({ type: 'config_updated', platformId: id, text: 'Konfigurasi service diperbarui' })
    get().addLog(id, 'INFO', 'Konfigurasi service disimpan (lokal)')
    get().pushToast('Konfigurasi platform disimpan secara lokal.', 'ok')
  },

  setServiceEnabled: async (id, enabled) => {
    get().setPlatform(id, { serviceEnabled: enabled })
    get().addActivity({ type: enabled ? 'monitoring_enabled' : 'monitoring_disabled', platformId: id, text: `Service ${enabled ? 'diaktifkan' : 'dinonaktifkan'}` })
    get().addLog(id, 'INFO', enabled ? 'Service diaktifkan' : 'Service dinonaktifkan')
    if (!enabled) {
      get().pushToast('Service dinonaktifkan. Akun dan konfigurasinya tetap tersimpan.', 'info')
      return
    }
    get().setPlatformRuntime(id, { status: 'starting' })
    const result = await platformsApi.startService(id)
    get().setPlatformRuntime(id, { ...result, lastSuccess: new Date().toISOString() })
    get().pushToast('Service aktif kembali (simulasi).', 'ok')
  },

  restartPlatform: async (id) => {
    get().setPlatformRuntime(id, { status: 'starting' })
    get().addLog(id, 'INFO', 'Restart service diminta')
    const result = await monitoringApi.restartPlatform(id)
    get().setPlatformRuntime(id, result)
    get().addActivity({ type: 'service_recovered', platformId: id, text: 'Service berhasil di-restart' })
    get().addLog(id, 'INFO', 'Service berjalan kembali')
    get().pushToast('Service di-restart (simulasi).', 'ok')
  },

  checkPlatform: async (id) => {
    const { accounts, config, runtime, platformRuntime } = get()
    if (platformRuntime[id].status === 'offline') {
      get().addLog(id, 'ERROR', 'Pemeriksaan dibatalkan: service offline')
      get().pushToast('Service sedang offline. Restart service dulu. Status akun tidak diubah.', 'warn')
      return
    }
    const targets = accounts.filter((a) => a.platformId === id && getEligibility(a, config).eligible)
    if (!targets.length) {
      get().pushToast('Tidak ada akun platform ini yang memenuhi syarat pemeriksaan.', 'warn')
      return
    }
    set((s) => ({ runtime: { ...s.runtime, ...Object.fromEntries(targets.map((a) => [a.id, { ...s.runtime[a.id], checking: true }])) } }))
    const results = await monitoringApi.checkAccounts(targets, runtime)
    const ok = results.filter((r) => r.ok).length
    set((s) => ({ lastRefresh: new Date().toISOString(), runtime: { ...s.runtime, ...Object.fromEntries(results.map((r) => [r.id, { ...s.runtime[r.id], ...r.patch }])) } }))
    if (ok) get().setPlatformRuntime(id, { lastSuccess: new Date().toISOString() })
    get().addLog(id, ok === results.length ? 'INFO' : 'WARN', `Pemeriksaan ${results.length} akun: ${ok} berhasil, ${results.length - ok} gagal`)
    get().pushToast(`${ok} dari ${results.length} akun berhasil diperiksa (simulasi).`, ok === results.length ? 'ok' : 'warn')
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
