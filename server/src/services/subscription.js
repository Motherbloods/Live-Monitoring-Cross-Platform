import { createHash, randomInt } from 'node:crypto'
import { PLATFORM_IDS } from '../config/defaults.js'
import { defaultProfileUrl, validateAccountInput } from '../config/validation.js'
import { addLog, emptyRuntime, getState, persist } from '../store/db.js'
import { HttpError } from '../utils/http.js'

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const DAY = 86400000
const fail = (status, code, message) => new HttpError(status, code, message)

export const normalizeCode = (input) => {
  const raw = String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = raw.startsWith('LM') ? raw.slice(2) : raw
  if (body.length !== 12 || [...body].some((c) => !ALPHABET.includes(c))) return null
  return `LM-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`
}

const hashCode = (canonical) => createHash('sha256').update(canonical).digest('hex')
const randomCode = () => normalizeCode(Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''))
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const intIn = (value, min, max, name) => {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) throw fail(400, 'VALIDATION_ERROR', `${name} harus bilangan bulat ${min}-${max}.`)
  return n
}

export const isActive = (subscriber, now = Date.now()) => subscriber.status === 'active' && new Date(subscriber.expiresAt).getTime() > now

export const followersOf = (accountId) => getState().subscribers.filter((s) => isActive(s) && s.selections.some((x) => x.accountId === accountId))

const platformLabel = (id) => ({ tiktok: 'TikTok', bigo: 'Bigo Live', youtube: 'YouTube', twitch: 'Twitch', shopee: 'Shopee', instagram: 'Instagram' })[id] || id

export const pauseIfUnfollowed = (accountId) => {
  const account = getState().accounts.find((a) => a.id === accountId)
  if (!account || account.origin !== 'subscription') return
  if (followersOf(accountId).length === 0 && account.monitoringEnabled) {
    account.monitoringEnabled = false
    addLog(account.platformId, 'INFO', `Pemeriksaan ${account.displayName} dijeda: tidak ada pelanggan aktif`)
  }
}

export const dropAccountSelections = (accountId) => {
  for (const sub of getState().subscribers) sub.selections = sub.selections.filter((x) => x.accountId !== accountId)
}

export const createCodes = ({ label = '', maxAccounts, durationDays, count = 1 }) => {
  const state = getState()
  const s = state.subscriptionSettings
  const plan = { maxAccounts: intIn(maxAccounts ?? s.defaultMaxAccounts, 1, 50, 'Jatah akun'), durationDays: intIn(durationDays ?? s.defaultDurationDays, 1, 3650, 'Masa aktif (hari)') }
  const total = intIn(count, 1, 50, 'Jumlah kode')
  const note = String(label || '').trim()
  if (note.length > 80) throw fail(400, 'VALIDATION_ERROR', 'Catatan maksimal 80 karakter.')
  const created = []
  while (created.length < total) {
    const code = randomCode()
    const hash = hashCode(code)
    if (state.codes.some((c) => c.codeHash === hash)) continue
    const record = { id: newId('code'), codeHash: hash, prefix: code.slice(0, 7), label: note, ...plan, status: 'unused', createdAt: new Date().toISOString(), redeemedAt: null, redeemedBy: null }
    state.codes.unshift(record)
    created.push({ ...publicCode(record), code })
  }
  addLog(null, 'INFO', `${total} kode langganan dibuat (${plan.maxAccounts} akun, ${plan.durationDays} hari)`)
  persist()
  return created
}

const publicCode = ({ codeHash, ...rest }) => rest

export const revokeCode = (id) => {
  const code = getState().codes.find((c) => c.id === id)
  if (!code) throw fail(404, 'NOT_FOUND', 'Kode tidak ditemukan.')
  if (code.status !== 'unused') throw fail(409, 'CODE_NOT_UNUSED', 'Hanya kode yang belum dipakai yang bisa dibatalkan.')
  code.status = 'revoked'
  persist()
  return publicCode(code)
}

export const redeemCode = (input, { chatId, name = '', username = '' }) => {
  const state = getState()
  const canonical = normalizeCode(input)
  const code = canonical ? state.codes.find((c) => c.codeHash === hashCode(canonical)) : null
  if (!code || code.status !== 'unused') throw fail(400, 'INVALID_CODE', 'Kode tidak valid atau sudah dipakai.')
  const id = String(chatId)
  let sub = state.subscribers.find((s) => s.chatId === id)
  if (sub?.status === 'revoked') throw fail(403, 'SUBSCRIBER_REVOKED', 'Langganan Anda dihentikan oleh admin.')
  const now = Date.now()
  let renewed = false
  if (!sub) {
    sub = { id: newId('sub'), chatId: id, name: String(name).slice(0, 80), telegramUsername: String(username).slice(0, 80), status: 'active', maxAccounts: code.maxAccounts, expiresAt: new Date(now + code.durationDays * DAY).toISOString(), selections: [], notifyEnd: false, changeLog: [], createdAt: new Date(now).toISOString(), note: '' }
    state.subscribers.push(sub)
  } else {
    renewed = true
    const active = isActive(sub, now)
    const base = active ? new Date(sub.expiresAt).getTime() : now
    sub.expiresAt = new Date(base + code.durationDays * DAY).toISOString()
    sub.maxAccounts = active ? Math.max(sub.maxAccounts, code.maxAccounts) : code.maxAccounts
    sub.selections = sub.selections.slice(0, sub.maxAccounts)
    if (name) sub.name = String(name).slice(0, 80)
    if (username) sub.telegramUsername = String(username).slice(0, 80)
  }
  code.status = 'redeemed'
  code.redeemedAt = new Date(now).toISOString()
  code.redeemedBy = sub.id
  addLog(null, 'INFO', `Kode ${code.prefix}… dipakai oleh pelanggan baru atau perpanjangan`)
  persist()
  return { subscriber: sub, renewed }
}

const findSubscriber = (id) => {
  const sub = getState().subscribers.find((s) => s.id === id)
  if (!sub) throw fail(404, 'NOT_FOUND', 'Pelanggan tidak ditemukan.')
  return sub
}

export const getSubscriberByChat = (chatId) => getState().subscribers.find((s) => s.chatId === String(chatId)) || null

const findAccount = (platformId, username) => getState().accounts.find((a) => a.platformId === platformId && a.username.toLowerCase() === username.toLowerCase())

export const addSelection = (subscriberId, platformId, rawUsername, { byAdmin = false } = {}) => {
  const state = getState()
  const s = state.subscriptionSettings
  const sub = findSubscriber(subscriberId)
  if (!byAdmin && !isActive(sub)) throw fail(403, 'NOT_ACTIVE', 'Langganan Anda tidak aktif. Kirim kode baru untuk memperpanjang.')
  if (!PLATFORM_IDS.includes(platformId) || !s.allowedPlatforms.includes(platformId)) throw fail(400, 'PLATFORM_NOT_ALLOWED', `Platform ini belum tersedia untuk pelanggan. Pilihan: ${s.allowedPlatforms.map(platformLabel).join(', ')}.`)
  const { errors, username } = validateAccountInput({ platformId, username: String(rawUsername || '') }, [])
  if (errors.length) throw fail(400, 'VALIDATION_ERROR', errors[0])
  if (s.blocklist.includes(`${platformId}:${username.toLowerCase()}`)) throw fail(403, 'BLOCKED', 'Akun ini tidak dapat dipantau.')
  let account = findAccount(platformId, username)
  if (account && sub.selections.some((x) => x.accountId === account.id)) throw fail(409, 'ALREADY_SELECTED', 'Akun ini sudah ada di daftar Anda.')
  if (sub.selections.length >= sub.maxAccounts) throw fail(409, 'NO_SLOTS', `Jatah akun Anda habis (${sub.maxAccounts}). Hapus satu akun dulu.`)

  const monitored = state.accounts.filter((a) => a.platformId === platformId && a.monitoringEnabled).length
  const cap = s.platformCaps[platformId]
  const needsCapacity = !account || (!account.monitoringEnabled && account.origin === 'subscription')
  if (needsCapacity && cap && monitored >= cap) throw fail(409, 'CAPACITY_FULL', `Kapasitas pemantauan ${platformLabel(platformId)} sedang penuh. Coba lagi nanti.`)

  if (!account) {
    account = { id: newId('acc'), platformId, username, displayName: username, profileUrl: defaultProfileUrl(platformId, username), monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: null, autoRecording: null, notifyEnabled: null, notifyOnStart: null, notifyOnEnd: null, notes: '', origin: 'subscription' }
    state.accounts.unshift(account)
    state.runtime[account.id] = emptyRuntime()
  } else if (!account.monitoringEnabled && account.origin === 'subscription') {
    account.monitoringEnabled = true
  }
  sub.selections.push({ accountId: account.id, addedAt: new Date().toISOString() })
  persist()
  return { account, subscriber: sub }
}

export const removeSelection = (subscriberId, accountId, { byAdmin = false } = {}) => {
  const state = getState()
  const sub = findSubscriber(subscriberId)
  if (!sub.selections.some((x) => x.accountId === accountId)) throw fail(404, 'NOT_FOUND', 'Akun tidak ada di daftar pelanggan.')
  const limit = state.subscriptionSettings.changesPerWeek
  if (!byAdmin && limit > 0) {
    const weekAgo = Date.now() - 7 * DAY
    sub.changeLog = sub.changeLog.filter((t) => new Date(t).getTime() > weekAgo)
    if (sub.changeLog.length >= limit) {
      const next = new Date(new Date(sub.changeLog[0]).getTime() + 7 * DAY)
      throw fail(429, 'CHANGE_LIMIT', `Batas penggantian akun (${limit} per minggu) tercapai. Bisa lagi setelah ${next.toISOString().slice(0, 10)}.`)
    }
  }
  sub.selections = sub.selections.filter((x) => x.accountId !== accountId)
  if (!byAdmin) sub.changeLog.push(new Date().toISOString())
  pauseIfUnfollowed(accountId)
  persist()
  return sub
}

export const updateSubscriber = (id, patch) => {
  const sub = findSubscriber(id)
  if (patch.extendDays !== undefined) {
    const days = intIn(patch.extendDays, 1, 3650, 'Perpanjangan (hari)')
    const base = isActive(sub) || sub.status === 'revoked' ? Math.max(Date.now(), new Date(sub.expiresAt).getTime()) : Date.now()
    sub.expiresAt = new Date(base + days * DAY).toISOString()
  }
  if (patch.maxAccounts !== undefined) {
    const max = intIn(patch.maxAccounts, 1, 50, 'Jatah akun')
    if (max < sub.selections.length) throw fail(409, 'SLOTS_IN_USE', 'Jatah tidak boleh di bawah jumlah akun yang sedang dipantau. Hapus akunnya dulu.')
    sub.maxAccounts = max
  }
  if (patch.status !== undefined) {
    if (!['active', 'revoked'].includes(patch.status)) throw fail(400, 'VALIDATION_ERROR', 'status harus active atau revoked.')
    sub.status = patch.status
    if (sub.status === 'revoked') for (const x of sub.selections) pauseIfUnfollowed(x.accountId)
    else for (const x of sub.selections) {
      const account = getState().accounts.find((a) => a.id === x.accountId)
      if (account?.origin === 'subscription' && isActive(sub)) account.monitoringEnabled = true
    }
  }
  if (patch.note !== undefined) {
    if (String(patch.note).length > 200) throw fail(400, 'VALIDATION_ERROR', 'Catatan maksimal 200 karakter.')
    sub.note = String(patch.note)
  }
  if (patch.notifyEnd !== undefined) sub.notifyEnd = Boolean(patch.notifyEnd)
  persist()
  return sub
}

export const deleteSubscriber = (id) => {
  const state = getState()
  const sub = findSubscriber(id)
  state.subscribers = state.subscribers.filter((s) => s.id !== id)
  for (const x of sub.selections) pauseIfUnfollowed(x.accountId)
  state.codes.forEach((c) => {
    if (c.redeemedBy === id) c.redeemedBy = null
  })
  persist()
}

export const validateSettings = (input, current) => {
  const next = { ...current, ...input }
  if (!Array.isArray(next.allowedPlatforms) || !next.allowedPlatforms.every((p) => PLATFORM_IDS.includes(p))) throw fail(400, 'VALIDATION_ERROR', 'allowedPlatforms tidak valid.')
  next.defaultMaxAccounts = intIn(next.defaultMaxAccounts, 1, 50, 'defaultMaxAccounts')
  next.defaultDurationDays = intIn(next.defaultDurationDays, 1, 3650, 'defaultDurationDays')
  next.changesPerWeek = intIn(next.changesPerWeek, 0, 50, 'changesPerWeek')
  if (typeof next.platformCaps !== 'object' || next.platformCaps === null) throw fail(400, 'VALIDATION_ERROR', 'platformCaps tidak valid.')
  next.platformCaps = Object.fromEntries(Object.entries(next.platformCaps).map(([id, v]) => {
    if (!PLATFORM_IDS.includes(id)) throw fail(400, 'VALIDATION_ERROR', `Platform tidak dikenal: ${id}`)
    return [id, intIn(v, 1, 1000, `Kapasitas ${id}`)]
  }))
  const list = Array.isArray(next.blocklist) ? next.blocklist.map((b) => String(b).trim().toLowerCase()) : null
  if (!list || !list.every((b) => /^[a-z]+:[a-z0-9._-]{2,64}$/.test(b))) throw fail(400, 'VALIDATION_ERROR', 'blocklist harus berisi entri berbentuk platform:username.')
  next.blocklist = [...new Set(list)]
  if (typeof next.contactText !== 'string' || next.contactText.length > 500) throw fail(400, 'VALIDATION_ERROR', 'contactText maksimal 500 karakter.')
  return next
}

export const overview = () => {
  const state = getState()
  const subs = state.subscribers.map((sub) => ({
    ...sub,
    active: isActive(sub),
    expired: sub.status === 'active' && !isActive(sub),
    selections: sub.selections.map((x) => {
      const a = state.accounts.find((acc) => acc.id === x.accountId)
      return { ...x, platformId: a?.platformId, username: a?.username, displayName: a?.displayName, liveStatus: a ? state.runtime[a.id]?.lastStatus : null }
    })
  }))
  return {
    settings: state.subscriptionSettings,
    codes: state.codes.map(publicCode),
    subscribers: subs,
    stats: {
      unusedCodes: state.codes.filter((c) => c.status === 'unused').length,
      redeemedCodes: state.codes.filter((c) => c.status === 'redeemed').length,
      activeSubscribers: subs.filter((s) => s.active).length,
      followedAccounts: new Set(state.subscribers.filter((s) => isActive(s)).flatMap((s) => s.selections.map((x) => x.accountId))).size
    }
  }
}
