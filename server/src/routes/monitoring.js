import { Router } from 'express'
import { addLog, getState, persist } from '../store/db.js'
import { getEligibility } from '../utils/effectiveConfig.js'
import { checkMany } from '../services/monitor.js'
import { PLATFORM_IDS } from '../config/defaults.js'
import { wrap } from '../utils/http.js'

const router = Router()

const status = () => {
  const state = getState()
  return {
    globalMonitoringEnabled: state.config.global.globalMonitoringEnabled,
    checking: Object.values(state.runtime).filter((r) => r.checking).length,
    eligible: state.accounts.filter((a) => getEligibility(a, state.config).eligible).length,
    total: state.accounts.length,
    platforms: Object.fromEntries(PLATFORM_IDS.map((id) => [id, { serviceEnabled: state.config.platforms[id].serviceEnabled, status: state.platformRuntime[id].status }]))
  }
}

const setGlobal = (enabled) => {
  const state = getState()
  state.config.global.globalMonitoringEnabled = enabled
  state.configSavedAt = new Date().toISOString()
  addLog(null, 'INFO', enabled ? 'Global monitoring dihidupkan' : 'Global monitoring dijeda')
  persist()
}

router.get('/status', (req, res) => res.json(status()))

router.post('/start', (req, res) => {
  setGlobal(true)
  res.json(status())
})

router.post('/stop', (req, res) => {
  setGlobal(false)
  res.json(status())
})

router.post('/check-all', wrap(async (req, res) => {
  const state = getState()
  const targets = state.accounts.filter((a) => getEligibility(a, state.config).eligible && !state.runtime[a.id].checking)
  const results = await checkMany(targets)
  const failed = results.filter((r) => !r.ok).length
  res.json({ summary: { total: results.length, succeeded: results.length - failed, failed }, results })
}))

export default router
