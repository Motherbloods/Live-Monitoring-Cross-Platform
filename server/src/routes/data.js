import { Router } from 'express'
import { getState, persist } from '../store/db.js'
import { PLATFORM_IDS } from '../config/defaults.js'
import { mergeConfigPatch, validateConfig } from '../config/validation.js'
import { isConfigured, sendMessage } from '../services/telegram.js'
import { HttpError, badRequest, wrap } from '../utils/http.js'

export const history = Router()
export const recordings = Router()
export const notifications = Router()

history.get('/', (req, res) => {
  const { platform, accountId } = req.query
  res.json({ history: getState().history.filter((h) => (!platform || h.platformId === platform) && (!accountId || h.accountId === accountId)) })
})

recordings.get('/', (req, res) => {
  res.json({ recordings: getState().recordings })
})

const settings = () => {
  const { config } = getState()
  return {
    defaults: config.global.notificationDefaults,
    overrides: Object.fromEntries(PLATFORM_IDS.map((id) => [id, config.platforms[id].notificationOverrides]))
  }
}

notifications.post('/test', wrap(async (req, res) => {
  if (!isConfigured()) throw new HttpError(409, 'TELEGRAM_NOT_CONFIGURED', 'Telegram belum dikonfigurasi di server (TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID).')
  try {
    await sendMessage('Live Monitor: notifikasi uji berhasil dikirim.')
  } catch (error) {
    throw new HttpError(502, 'TELEGRAM_FAILED', error.message)
  }
  res.json({ ok: true })
}))

notifications.get('/settings', (req, res) => res.json(settings()))

notifications.patch('/settings', (req, res) => {
  const state = getState()
  const body = req.body || {}
  const patch = { global: {}, platforms: {} }
  if (body.defaults) patch.global.notificationDefaults = body.defaults
  for (const [id, values] of Object.entries(body.overrides || {})) patch.platforms[id] = { notificationOverrides: values }
  const { config, errors } = mergeConfigPatch(state.config, patch)
  const values = [...Object.values(config.global.notificationDefaults), ...PLATFORM_IDS.flatMap((id) => Object.values(config.platforms[id].notificationOverrides))]
  const invalid = [...errors, ...validateConfig(config), ...(values.every((v) => typeof v === 'boolean') ? [] : ['Semua nilai notifikasi harus boolean.'])]
  if (invalid.length) throw badRequest(invalid)
  state.config = config
  state.configSavedAt = new Date().toISOString()
  persist()
  res.json(settings())
})

export const logs = Router()

logs.get('/', (req, res) => {
  const { platform, level } = req.query
  const wanted = level ? String(level).toUpperCase() : null
  res.json({ logs: getState().logs.filter((l) => (!platform || l.platformId === platform) && (!wanted || l.level === wanted)) })
})
