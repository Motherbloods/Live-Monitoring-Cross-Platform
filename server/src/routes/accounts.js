import { Router } from 'express'
import { emptyRuntime, getState, persist, addLog } from '../store/db.js'
import { validateAccountInput } from '../config/validation.js'
import { getEligibility, resolveEffective } from '../utils/effectiveConfig.js'
import { checkAccount, nextCheckAt } from '../services/monitor.js'
import { HttpError, badRequest, wrap } from '../utils/http.js'

const router = Router()

const EDITABLE = ['platformId', 'username', 'displayName', 'profileUrl', 'monitoringEnabled', 'useCustomCheckInterval', 'customCheckIntervalSeconds', 'autoRecording', 'notifyEnabled', 'notifyOnStart', 'notifyOnEnd', 'notes']

const view = (account, state) => ({
  ...account,
  runtime: state.runtime[account.id],
  effective: { ...resolveEffective(account, state.config), ...getEligibility(account, state.config), nextCheckAt: nextCheckAt(account.id) }
})

const find = (id) => {
  const account = getState().accounts.find((a) => a.id === id)
  if (!account) throw new HttpError(404, 'NOT_FOUND', 'Akun tidak ditemukan.')
  return account
}

const pickEditable = (body) => Object.fromEntries(EDITABLE.filter((k) => k in body).map((k) => [k, body[k]]))

router.get('/', (req, res) => {
  const state = getState()
  res.json({ accounts: state.accounts.map((a) => view(a, state)) })
})

router.post('/', (req, res) => {
  const state = getState()
  const input = pickEditable(req.body || {})
  const { errors, username } = validateAccountInput(input, state.accounts)
  if (errors.length) throw badRequest(errors)
  const account = {
    id: `acc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    platformId: input.platformId,
    username,
    displayName: (input.displayName || '').trim() || username,
    profileUrl: input.profileUrl?.trim() || '',
    monitoringEnabled: input.monitoringEnabled ?? true,
    useCustomCheckInterval: Boolean(input.useCustomCheckInterval),
    customCheckIntervalSeconds: input.useCustomCheckInterval ? Number(input.customCheckIntervalSeconds) : null,
    autoRecording: input.autoRecording ?? null,
    notifyEnabled: input.notifyEnabled ?? null,
    notifyOnStart: input.notifyOnStart ?? null,
    notifyOnEnd: input.notifyOnEnd ?? null,
    notes: (input.notes || '').trim()
  }
  state.accounts.unshift(account)
  state.runtime[account.id] = emptyRuntime()
  addLog(account.platformId, 'INFO', `Akun ${account.displayName} ditambahkan`)
  persist()
  res.status(201).json({ account: view(account, state) })
})

router.patch('/:id', (req, res) => {
  const state = getState()
  const account = find(req.params.id)
  const merged = { ...account, ...pickEditable(req.body || {}) }
  const { errors, username } = validateAccountInput(merged, state.accounts, account.id)
  if (errors.length) throw badRequest(errors)
  Object.assign(account, merged, {
    username,
    displayName: (merged.displayName || '').trim() || username,
    customCheckIntervalSeconds: merged.useCustomCheckInterval ? Number(merged.customCheckIntervalSeconds) : null
  })
  persist()
  res.json({ account: view(account, state) })
})

router.delete('/:id', (req, res) => {
  const state = getState()
  const account = find(req.params.id)
  state.accounts = state.accounts.filter((a) => a.id !== account.id)
  delete state.runtime[account.id]
  addLog(account.platformId, 'INFO', `Akun ${account.displayName} dihapus`)
  persist()
  res.json({ ok: true })
})

router.patch('/:id/monitoring', (req, res) => {
  const account = find(req.params.id)
  if (typeof req.body?.enabled !== 'boolean') throw badRequest(['enabled harus boolean.'])
  account.monitoringEnabled = req.body.enabled
  persist()
  res.json({ account: view(account, getState()) })
})

router.post('/:id/check', wrap(async (req, res) => {
  const state = getState()
  const account = find(req.params.id)
  const platform = state.platformRuntime[account.platformId]
  if (!state.config.platforms[account.platformId].serviceEnabled) throw new HttpError(409, 'SERVICE_DISABLED', 'Service platform dinonaktifkan.')
  if (platform.status === 'offline') throw new HttpError(409, 'SERVICE_OFFLINE', 'Service platform sedang offline. Restart service terlebih dahulu.')
  if (state.runtime[account.id].checking) throw new HttpError(409, 'ALREADY_CHECKING', 'Akun sedang diperiksa.')
  const result = await checkAccount(account, { retry: false })
  res.json({ result, account: view(account, state) })
}))

export default router
