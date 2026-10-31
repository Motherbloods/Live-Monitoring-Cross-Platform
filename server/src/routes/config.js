import { Router } from 'express'
import { getState, persist, addLog } from '../store/db.js'
import { checkerModes } from '../services/checkers.js'
import { mergeConfigPatch, validateConfig } from '../config/validation.js'
import { badRequest } from '../utils/http.js'

const router = Router()

router.get('/', (req, res) => {
  const { config, configSavedAt } = getState()
  res.json({ config, savedAt: configSavedAt, engine: checkerModes() })
})

router.patch('/', (req, res) => {
  const state = getState()
  const { config, errors } = mergeConfigPatch(state.config, req.body || {})
  const invalid = [...errors, ...validateConfig(config)]
  if (invalid.length) throw badRequest(invalid)
  state.config = config
  state.configSavedAt = new Date().toISOString()
  addLog(null, 'INFO', 'Konfigurasi diperbarui')
  persist()
  res.json({ config, savedAt: state.configSavedAt })
})

export default router
