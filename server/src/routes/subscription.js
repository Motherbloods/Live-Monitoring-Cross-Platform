import { Router } from 'express'
import { getState, persist } from '../store/db.js'
import { addSelection, createCodes, deleteSubscriber, overview, removeSelection, revokeCode, updateSubscriber, validateSettings } from '../services/subscription.js'
import { announceIfLive } from '../services/subscriberBot.js'
import { HttpError } from '../utils/http.js'

const router = Router()

router.get('/overview', (req, res) => res.json(overview()))

router.post('/codes', (req, res) => {
  const codes = createCodes(req.body || {})
  res.status(201).json({ codes })
})

router.post('/codes/:id/revoke', (req, res) => res.json({ code: revokeCode(req.params.id) }))

router.get('/settings', (req, res) => res.json({ settings: getState().subscriptionSettings }))

router.patch('/settings', (req, res) => {
  const state = getState()
  state.subscriptionSettings = validateSettings(req.body || {}, state.subscriptionSettings)
  persist()
  res.json({ settings: state.subscriptionSettings })
})

router.patch('/subscribers/:id', (req, res) => {
  updateSubscriber(req.params.id, req.body || {})
  res.json(overview())
})

router.delete('/subscribers/:id', (req, res) => {
  deleteSubscriber(req.params.id)
  res.json({ ok: true })
})

router.post('/subscribers/:id/selections', (req, res) => {
  const { platformId, username } = req.body || {}
  if (typeof platformId !== 'string' || typeof username !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', 'platformId dan username wajib diisi.')
  const { account, subscriber } = addSelection(req.params.id, platformId, username, { byAdmin: true })
  announceIfLive(subscriber.id, account.id).catch(() => {})
  res.status(201).json(overview())
})

router.delete('/subscribers/:id/selections/:accountId', (req, res) => {
  removeSelection(req.params.id, req.params.accountId, { byAdmin: true })
  res.json(overview())
})

export default router
