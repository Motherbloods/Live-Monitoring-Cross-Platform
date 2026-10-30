import { serverApi } from '../api/serverApi.js'
import { validateConfig } from '../config/configurationManager.js'
import { setTimezone } from '../utils/formatters.js'

const toActivity = (log) => ({ id: log.id, type: 'log', platformId: log.platformId, text: log.message, at: log.at, level: log.level.toLowerCase() })

const accountBody = (form) => ({
  platformId: form.platformId,
  username: form.username,
  profileUrl: form.profileUrl,
  displayName: form.displayName,
  monitoringEnabled: form.monitoringEnabled,
  useCustomCheckInterval: form.useCustomCheckInterval,
  customCheckIntervalSeconds: form.useCustomCheckInterval ? Number(form.customCheckIntervalSeconds) : null,
  autoRecording: form.autoRecording,
  notifyEnabled: form.notifyEnabled,
  notifyOnStart: form.notifyOnStart,
  notifyOnEnd: form.notifyOnEnd,
  notes: form.notes
})

export const createHttpActions = (set, get) => {
  const attempt = async (fn, successMessage, tone = 'ok') => {
    try {
      const result = await fn()
      await get().hydrate()
      if (successMessage) get().pushToast(successMessage, tone)
      return result ?? true
    } catch (error) {
      get().pushToast(error.message, 'warn')
      return false
    }
  }

  const pushConfig = async (next, message, applyToDraft) => {
    const errors = validateConfig(next)
    if (errors.length) {
      get().pushToast(errors[0], 'warn')
      return false
    }
    const ok = await attempt(() => serverApi.patchConfig({ global: next.global, platforms: next.platforms }))
    if (!ok) return false
    if (applyToDraft) set((s) => ({ draft: applyToDraft(s.draft) }))
    else set((s) => ({ draft: s.config }))
    setTimezone(next.global.timezone)
    get().pushToast(`${message}. Tersimpan di server.`, 'ok')
    return true
  }

  return {
    hydrate: async () => {
      try {
        const snap = await serverApi.snapshot()
        const split = snap.accounts.map(({ runtime, effective, ...account }) => ({ account, runtime }))
        set((s) => ({
          accounts: split.map((x) => x.account),
          runtime: Object.fromEntries(split.map((x) => [x.account.id, x.runtime])),
          platformRuntime: Object.fromEntries(snap.platforms.map((p) => [p.id, p.runtime])),
          config: snap.config,
          draft: JSON.stringify(s.draft) === JSON.stringify(s.config) ? snap.config : s.draft,
          savedAt: snap.savedAt,
          history: snap.history,
          recordings: snap.recordings,
          logs: snap.logs,
          activities: snap.logs.slice(0, 40).map(toActivity),
          lastRefresh: new Date().toISOString(),
          connection: 'online',
          ready: true
        }))
        setTimezone(snap.config.global.timezone)
      } catch {
        const was = get().connection
        set({ connection: 'offline', ready: true })
        if (was !== 'offline') get().pushToast('Server tidak dapat dihubungi. Data yang tampil bisa kedaluwarsa.', 'warn')
      }
    },

    refreshDashboard: () => get().hydrate(),

    addAccount: (form) => attempt(() => serverApi.createAccount(accountBody(form)), 'Akun ditambahkan. Statusnya Unknown sampai diperiksa.'),

    updateAccount: (id, patch) => attempt(() => serverApi.updateAccount(id, patch), 'Perubahan akun disimpan.'),

    deleteAccount: (id) => attempt(() => serverApi.deleteAccount(id), 'Akun dihapus. Riwayat live tetap tersimpan.', 'info'),

    setAccountMonitoring: (id, enabled) => attempt(() => serverApi.setMonitoring(id, enabled)),

    checkAccount: async (id) => {
      set((s) => ({ runtime: { ...s.runtime, [id]: { ...s.runtime[id], checking: true } } }))
      try {
        const { result } = await serverApi.checkAccount(id)
        await get().hydrate()
        get().pushToast(result.ok ? 'Pemeriksaan selesai.' : 'Pemeriksaan gagal. Status sebelumnya tidak diubah.', result.ok ? 'ok' : 'warn')
      } catch (error) {
        await get().hydrate()
        get().pushToast(error.message, 'warn')
      }
    },

    checkAllEnabled: async () => {
      set((s) => ({ busy: { ...s.busy, checkAll: true } }))
      try {
        const { summary } = await serverApi.checkAll()
        await get().hydrate()
        get().pushToast(summary.failed ? `${summary.succeeded} akun diperiksa, ${summary.failed} gagal. Status akun yang gagal tidak diubah.` : `${summary.total} akun berhasil diperiksa.`, summary.failed ? 'warn' : 'ok')
        return summary
      } catch (error) {
        get().pushToast(error.message, 'warn')
        return null
      } finally {
        set((s) => ({ busy: { ...s.busy, checkAll: false } }))
      }
    },

    toggleGlobalMonitoring: () => {
      const enabled = !get().config.global.globalMonitoringEnabled
      return attempt(() => (enabled ? serverApi.startMonitoring() : serverApi.stopMonitoring()), enabled ? 'Global monitoring aktif kembali.' : 'Global monitoring dijeda. Status terakhir mungkin tidak aktual.', 'info')
    },

    savePlatformConfig: (id, patch) => attempt(() => serverApi.patchPlatform(id, patch), 'Konfigurasi platform disimpan di server.'),

    setServiceEnabled: async (id, enabled) => {
      const ok = await attempt(() => serverApi.patchPlatform(id, { serviceEnabled: enabled }), enabled ? 'Service diaktifkan.' : 'Service dinonaktifkan. Akun dan konfigurasinya tetap tersimpan.', 'info')
      if (ok && enabled) setTimeout(() => get().hydrate(), 1600)
      return ok
    },

    restartPlatform: async (id) => {
      const ok = await attempt(() => serverApi.restartPlatform(id), 'Restart service diminta.', 'info')
      if (ok) setTimeout(() => get().hydrate(), 1600)
      return ok
    },

    checkPlatform: async (id) => {
      try {
        const { summary } = await serverApi.checkPlatform(id)
        await get().hydrate()
        get().pushToast(`${summary.succeeded} dari ${summary.total} akun berhasil diperiksa.`, summary.failed ? 'warn' : 'ok')
      } catch (error) {
        get().pushToast(`${error.message} Status akun tidak diubah.`, 'warn')
      }
    },

    commitConfig: (next, message) => pushConfig(next, message, null),

    saveConfigSection: (apply, message) => pushConfig(apply(get().config), message, apply)
  }
}
