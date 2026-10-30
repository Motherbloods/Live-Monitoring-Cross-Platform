import { Router } from 'express'
import { addLog, getState, persist } from '../store/db.js'
import { PLATFORM_IDS } from '../config/defaults.js'
import { mergeConfigPatch, validateConfig } from '../config/validation.js'
import { getEligibility } from '../utils/effectiveConfig.js'
import { checkMany, resetPlatformFailures } from '../services/monitor.js'
import { HttpError, badRequest, wrap } from '../utils/http.js'

const router = Router()

const summary = (id, state) => {
  const own = state.accounts.filter((a) => a.platformId === id)
  return {
    total: own.length,
    enabled: own.filter((a) => a.monitoringEnabled).length,
    eligible: own.filter((a) => getEligibility(a, state.config).eligible).length,
    live: own.filter((a) => state.runtime[a.id].lastStatus === 'live').length
  }
}

const view = (id, state) => ({ id, config: state.config.platforms[id], runtime: state.platformRuntime[id], summary: summary(id, state) })

const platform = (id) => {
  if (!PLATFORM_IDS.includes(id)) throw new HttpError(404, 'NOT_FOUND', 'Platform tidak ditemukan.')
  return id
}

const startService = (id) => {
  const state = getState()
  state.platformRuntime[id].status = 'starting'
  setTimeout(() => {
    state.platformRuntime[id].status = 'online'
    state.platformRuntime[id].lastError = null
    state.platformRuntime[id].retryCount = 0
    resetPlatformFailures(id)
    addLog(id, 'INFO', 'Service berjalan')
    persist()
  }, 1200).unref?.()
}

router.get('/', (req, res) => {
  const state = getState()
  res.json({ platforms: PLATFORM_IDS.map((id) => view(id, state)) })
})

router.get('/:platform', (req, res) => {
  res.json({ platform: view(platform(req.params.platform), getState()) })
})

router.get('/:platform/logs', (req, res) => {
  const id = platform(req.params.platform)
  const level = String(req.query.level || '').toUpperCase()
  const q = String(req.query.q || '').toLowerCase()
  const logs = getState().logs.filter((l) => l.platformId === id && (!level || l.level === level) && l.message.toLowerCase().includes(q))
  res.json({ logs })
})

router.patch('/:platform/config', (req, res) => {
  const id = platform(req.params.platform)
  const state = getState()
  const wasEnabled = state.config.platforms[id].serviceEnabled
  const { config, errors } = mergeConfigPatch(state.config, { platforms: { [id]: req.body || {} } })
  const invalid = [...errors, ...validateConfig(config)]
  if (invalid.length) throw badRequest(invalid)
  state.config = config
  state.configSavedAt = new Date().toISOString()
  addLog(id, 'INFO', 'Konfigurasi service diperbarui')
  if (!wasEnabled && config.platforms[id].serviceEnabled) startService(id)
  if (wasEnabled && !config.platforms[id].serviceEnabled) addLog(id, 'INFO', 'Service dinonaktifkan')
  persist()
  res.json({ platform: view(id, state) })
})

router.post('/:platform/check', wrap(async (req, res) => {
  const id = platform(req.params.platform)
  const state = getState()
  if (!state.config.platforms[id].serviceEnabled) throw new HttpError(409, 'SERVICE_DISABLED', 'Service platform dinonaktifkan.')
  if (state.platformRuntime[id].status === 'offline') throw new HttpError(409, 'SERVICE_OFFLINE', 'Service platform sedang offline. Restart service terlebih dahulu.')
  const targets = state.accounts.filter((a) => a.platformId === id && getEligibility(a, state.config).eligible && !state.runtime[a.id].checking)
  const results = await checkMany(targets)
  const failed = results.filter((r) => !r.ok).length
  addLog(id, failed ? 'WARN' : 'INFO', `Pemeriksaan ${results.length} akun: ${results.length - failed} berhasil, ${failed} gagal`)
  persist()
  res.json({ summary: { total: results.length, succeeded: results.length - failed, failed }, results })
}))

router.post('/:platform/restart', (req, res) => {
  const id = platform(req.params.platform)
  if (!getState().config.platforms[id].serviceEnabled) throw new HttpError(409, 'SERVICE_DISABLED', 'Service platform dinonaktifkan.')
  addLog(id, 'INFO', 'Restart service diminta')
  startService(id)
  res.status(202).json({ platform: view(id, getState()) })
})

export default router
