import { randomBytes } from 'node:crypto'
import { defaultProfileUrl, usernameFromUrl } from '../config/validation.js'
import { addLog, getState, persist, persistNow } from '../store/db.js'
import { addSelection, deleteSubscriber, getSubscriberByChat, isActive, normalizeCode, prepareSelection, redeemCode, removeSelection, updateSubscriber } from './subscription.js'
import { setBotStatus } from './botStatus.js'
import { checkAccount } from './monitor.js'
import { liveStartText, notifySubscriber } from './subscriberNotifier.js'
import { resolveEffective } from '../utils/effectiveConfig.js'
import { createBotApi } from './telegramApi.js'
import { HttpError } from '../utils/http.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const PLATFORM_NAMES = { tiktok: 'TikTok', bigo: 'Bigo Live', youtube: 'YouTube', twitch: 'Twitch' }
const ALIASES = { tiktok: 'tiktok', bigo: 'bigo', bigolive: 'bigo' }
const LIVE_LABEL = { live: 'sedang live', offline: 'tidak live', unknown: 'belum diperiksa', error: 'belum bisa diperiksa' }
const PENDING_TTL = 10 * 60 * 1000
const CODE_FAIL_LIMIT = 5
const CODE_FAIL_WINDOW = 60 * 60 * 1000

let background = Promise.resolve()

export const flushBackground = () => background

export const announceIfLive = async (subscriberId, accountId) => {
  const state = getState()
  const sub = state.subscribers.find((s) => s.id === subscriberId)
  const account = state.accounts.find((a) => a.id === accountId)
  if (!sub || !account || !isActive(sub)) return
  const runtime = state.runtime[accountId]
  if (!runtime || runtime.checking) return
  const interval = resolveEffective(account, state.config).checkIntervalSeconds
  const fresh = runtime.lastSuccess && Date.now() - new Date(runtime.lastSuccess).getTime() <= Math.max(300000, 3 * interval * 1000)
  const before = runtime.lastStatus
  if (!fresh) {
    if (!state.config.global.globalMonitoringEnabled || !state.config.platforms[account.platformId].serviceEnabled) return
    const successBefore = runtime.lastSuccess
    await checkAccount(account, { retry: false })
    if (runtime.lastSuccess === successBefore) return
    if (before !== 'live' && runtime.lastStatus === 'live') return
  }
  if (runtime.lastStatus === 'live' && runtime.live) notifySubscriber(sub, liveStartText(account, runtime.live))
}

const pending = new Map()
const failures = new Map()

export const resetBotMemory = () => {
  pending.clear()
  failures.clear()
}

const tz = () => getState().config.global.timezone
const fmtDate = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: tz() })
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000))
const nameOf = (from = {}) => [from.first_name, from.last_name].filter(Boolean).join(' ').trim()

const HELP = [
  'Perintah:',
  '/akun - lihat langganan dan akun yang dipantau',
  '/tambah tiktok username - tambah akun (juga: bigo)',
  '/hapus tiktok username - lepas akun',
  '/notif_selesai on atau off - kabar saat live berakhir',
  '/hapusdata - hapus data saya',
  '',
  'Untuk berlangganan atau memperpanjang, kirim kode yang Anda terima dari admin ke chat ini.'
].join('\n')

const send = async (api, chatId, text, extra = {}) => {
  try {
    return await api('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra })
  } catch (error) {
    if (error.retryAfter && error.retryAfter <= 5) {
      await sleep(error.retryAfter * 1000)
      return api('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true, ...extra })
    }
    throw error
  }
}

const statusText = (sub) => {
  const state = getState()
  const lines = [isActive(sub) ? `Langganan aktif sampai ${fmtDate(sub.expiresAt)} (${daysLeft(sub.expiresAt)} hari lagi).` : `Langganan Anda tidak aktif (berakhir ${fmtDate(sub.expiresAt)}). Kirim kode baru untuk memperpanjang.`]
  lines.push(`Jatah akun: ${sub.selections.length} dari ${sub.maxAccounts}.`)
  sub.selections.forEach((x, i) => {
    const a = state.accounts.find((acc) => acc.id === x.accountId)
    if (a) lines.push(`${i + 1}. ${PLATFORM_NAMES[a.platformId] || a.platformId} @${a.username}: ${LIVE_LABEL[state.runtime[a.id]?.lastStatus] || 'belum diperiksa'}`)
  })
  if (isActive(sub)) lines.push('', 'Tambah akun: /tambah tiktok username', 'Lepas akun: /hapus tiktok username')
  return lines.join('\n')
}

const welcome = (sub) => (sub && isActive(sub) ? `Selamat datang kembali.\n\n${statusText(sub)}` : `Halo! Bot ini memberi tahu Anda saat akun TikTok atau Bigo pilihan Anda mulai live.\n\n${getState().subscriptionSettings.contactText}`)

const parseTarget = (args) => {
  const [platformArg, usernameArg] = args
  const platformId = ALIASES[String(platformArg || '').toLowerCase().replace(/\s/g, '')]
  if (!platformArg || !usernameArg) return { usage: true }
  if (!platformId) return { error: 'Platform tidak dikenal. Pilihan: tiktok atau bigo.' }
  const username = /[\/:]/.test(usernameArg) ? usernameFromUrl(usernameArg, platformId) : usernameArg.replace(/^@/, '')
  return username ? { platformId, username } : { error: 'Username tidak terbaca dari tautan itu.' }
}

const askConfirm = async (api, chatId, action, text) => {
  for (const [id, p] of pending) if (p.expires < Date.now()) pending.delete(id)
  const id = randomBytes(6).toString('base64url')
  pending.set(id, { ...action, chatId: String(chatId), expires: Date.now() + PENDING_TTL })
  return send(api, chatId, text, { reply_markup: { inline_keyboard: [[{ text: 'Ya, lanjutkan', callback_data: `y:${id}` }, { text: 'Batal', callback_data: `n:${id}` }]] } })
}

const redeem = async (api, msg, text) => {
  const chatId = String(msg.chat.id)
  const record = failures.get(chatId) || { count: 0, first: Date.now() }
  if (Date.now() - record.first > CODE_FAIL_WINDOW) Object.assign(record, { count: 0, first: Date.now() })
  if (record.count >= CODE_FAIL_LIMIT) {
    const minutes = Math.ceil((record.first + CODE_FAIL_WINDOW - Date.now()) / 60000)
    return send(api, chatId, `Terlalu banyak kode salah. Coba lagi dalam ${minutes} menit, atau hubungi admin.`)
  }
  try {
    const { subscriber, renewed } = redeemCode(text, { chatId, name: nameOf(msg.from), username: msg.from?.username || '' })
    failures.delete(chatId)
    const head = renewed ? `Langganan diperpanjang sampai ${fmtDate(subscriber.expiresAt)}.` : `Kode diterima. Langganan aktif sampai ${fmtDate(subscriber.expiresAt)} (${daysLeft(subscriber.expiresAt)} hari).`
    return send(api, chatId, `${head}\nJatah: ${subscriber.maxAccounts} akun TikTok atau Bigo (terpakai ${subscriber.selections.length}).\n\nPilih akun dengan:\n/tambah tiktok username\nContoh: /tambah bigo airah05`)
  } catch (error) {
    if (error.code === 'INVALID_CODE') {
      failures.set(chatId, { ...record, count: record.count + 1 })
      return send(api, chatId, `${error.message}\nPastikan kode diketik persis seperti yang dikirim admin.`)
    }
    throw error
  }
}

const requireSubscriber = (chatId) => {
  const sub = getSubscriberByChat(chatId)
  if (!sub) throw new HttpError(403, 'NO_SUBSCRIPTION', `Anda belum berlangganan. ${getState().subscriptionSettings.contactText}`)
  if (sub.status === 'revoked') throw new HttpError(403, 'SUBSCRIBER_REVOKED', 'Langganan Anda dihentikan oleh admin.')
  return sub
}

const handleCommand = async (api, msg, cmd, args) => {
  const chatId = String(msg.chat.id)
  if (cmd === '/start') {
    if (args[0] && normalizeCode(args[0])) return redeem(api, msg, args[0])
    return send(api, chatId, welcome(getSubscriberByChat(chatId)))
  }
  if (cmd === '/bantuan' || cmd === '/help') return send(api, chatId, HELP)
  if (cmd === '/akun') return send(api, chatId, statusText(requireSubscriber(chatId)))

  if (cmd === '/tambah') {
    const sub = requireSubscriber(chatId)
    const target = parseTarget(args)
    if (target.usage) return send(api, chatId, 'Cara pakai: /tambah tiktok username\nContoh: /tambah bigo airah05')
    if (target.error) return send(api, chatId, target.error)
    const check = prepareSelection(sub.id, target.platformId, target.username)
    const url = defaultProfileUrl(target.platformId, check.username)
    return askConfirm(api, chatId, { kind: 'add', platformId: target.platformId, username: check.username }, `Anda akan memantau:\n${PLATFORM_NAMES[target.platformId]} @${check.username}\n${url}\n\nBuka tautan di atas untuk memastikan akunnya benar. Jatah terpakai setelah ini: ${sub.selections.length + 1} dari ${sub.maxAccounts}.`)
  }

  if (cmd === '/hapus') {
    const sub = requireSubscriber(chatId)
    const target = parseTarget(args)
    if (target.usage) return send(api, chatId, 'Cara pakai: /hapus tiktok username')
    if (target.error) return send(api, chatId, target.error)
    const state = getState()
    const account = state.accounts.find((a) => a.platformId === target.platformId && a.username.toLowerCase() === target.username.toLowerCase())
    if (!account || !sub.selections.some((x) => x.accountId === account.id)) return send(api, chatId, 'Akun itu tidak ada di daftar Anda. Lihat daftar dengan /akun.')
    const limit = state.subscriptionSettings.changesPerWeek
    const note = limit > 0 ? `\nMelepas akun memakai 1 dari ${limit} penggantian per minggu.` : ''
    return askConfirm(api, chatId, { kind: 'remove', accountId: account.id }, `Lepas ${PLATFORM_NAMES[account.platformId]} @${account.username} dari daftar Anda?${note}`)
  }

  if (cmd === '/notif_selesai') {
    const sub = requireSubscriber(chatId)
    const value = String(args[0] || '').toLowerCase()
    if (!['on', 'off'].includes(value)) return send(api, chatId, `Notifikasi live berakhir saat ini ${sub.notifyEnd ? 'AKTIF' : 'mati'}.\nUbah dengan /notif_selesai on atau /notif_selesai off`)
    updateSubscriber(sub.id, { notifyEnd: value === 'on' })
    return send(api, chatId, `Notifikasi live berakhir sekarang ${value === 'on' ? 'aktif' : 'mati'}.`)
  }

  if (cmd === '/hapusdata') {
    const sub = getSubscriberByChat(chatId)
    if (!sub) return send(api, chatId, 'Tidak ada data Anda yang tersimpan.')
    return askConfirm(api, chatId, { kind: 'delete', subscriberId: sub.id }, 'Hapus semua data Anda? Langganan dan daftar akun akan hilang, notifikasi berhenti, dan kode yang sudah dipakai tidak bisa dipakai lagi.')
  }

  return send(api, chatId, `Perintah tidak dikenal.\n\n${HELP}`)
}

const handleCallback = async (api, query) => {
  const chatId = String(query.message?.chat?.id || '')
  const [action, id] = String(query.data || '').split(':')
  const item = pending.get(id)
  const finish = async (text) => {
    await api('answerCallbackQuery', { callback_query_id: query.id }).catch(() => {})
    if (query.message) await api('editMessageText', { chat_id: chatId, message_id: query.message.message_id, text, disable_web_page_preview: true }).catch(() => {})
  }
  if (!item || item.chatId !== chatId || item.expires < Date.now()) {
    pending.delete(id)
    return finish('Permintaan ini sudah kedaluwarsa. Ulangi perintahnya.')
  }
  pending.delete(id)
  if (action !== 'y') return finish('Dibatalkan.')
  try {
    const sub = getSubscriberByChat(chatId)
    if (!sub) throw new HttpError(403, 'NO_SUBSCRIPTION', 'Data Anda tidak ditemukan.')
    if (item.kind === 'add') {
      const { account, subscriber } = addSelection(sub.id, item.platformId, item.username)
      background = background.then(() => announceIfLive(subscriber.id, account.id)).catch(() => {})
      return finish(`Berhasil. ${PLATFORM_NAMES[item.platformId]} @${account.username} sekarang dipantau (${subscriber.selections.length} dari ${subscriber.maxAccounts}). Anda akan dapat notifikasi saat akun ini mulai live.`)
    }
    if (item.kind === 'remove') {
      removeSelection(sub.id, item.accountId)
      return finish('Akun dilepas. Jatah Anda kembali.')
    }
    deleteSubscriber(item.subscriberId)
    return finish('Data Anda sudah dihapus.')
  } catch (error) {
    if (error instanceof HttpError) return finish(error.message)
    throw error
  }
}

export const handleUpdate = async (update, api) => {
  try {
    if (update.callback_query) return await handleCallback(api, update.callback_query)
    const msg = update.message
    if (!msg || msg.chat?.type !== 'private' || typeof msg.text !== 'string') return null
    const known = getSubscriberByChat(msg.chat.id)
    if (known?.blocked) {
      known.blocked = false
      persist()
    }
    const text = msg.text.trim()
    if (text.startsWith('/')) {
      const [first, ...args] = text.split(/\s+/)
      return await handleCommand(api, msg, first.toLowerCase().replace(/@.*$/, ''), args)
    }
    if (normalizeCode(text)) return await redeem(api, msg, text)
    const sub = getSubscriberByChat(msg.chat.id)
    return await send(api, msg.chat.id, sub ? 'Perintah tidak dikenal. Ketik /bantuan untuk daftar perintah.' : welcome(null))
  } catch (error) {
    if (error instanceof HttpError) {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id
      if (chatId) await send(api, chatId, error.message).catch(() => {})
      return null
    }
    addLog(null, 'ERROR', `Bot pelanggan: kesalahan memproses pesan (${error.message})`)
    persist()
    return null
  }
}

export const pollOnce = async (api, { timeout = 25, signal } = {}) => {
  const state = getState()
  const updates = await api('getUpdates', { offset: state.botOffset + 1, timeout, allowed_updates: ['message', 'callback_query'] }, { timeoutMs: (timeout + 10) * 1000, signal })
  let handled = 0
  for (const update of updates) {
    if (update.update_id <= state.botOffset) continue
    await handleUpdate(update, api)
    state.botOffset = update.update_id
    persist()
    handled += 1
  }
  return handled
}

let running = false
let controller = null

export const startSubscriberBot = async () => {
  const token = process.env.SUBSCRIBER_BOT_TOKEN
  if (!token || running) return
  setBotStatus({ configured: true })
  const api = createBotApi(() => process.env.SUBSCRIBER_BOT_TOKEN)
  try {
    const me = await api('getMe')
    await api('deleteWebhook', { drop_pending_updates: false })
    await api('setMyCommands', { commands: [{ command: 'akun', description: 'Lihat langganan dan akun saya' }, { command: 'tambah', description: 'Tambah akun: /tambah tiktok username' }, { command: 'hapus', description: 'Lepas akun' }, { command: 'bantuan', description: 'Daftar perintah' }] })
    setBotStatus({ running: true, username: me.username, lastError: null })
    console.log(`Bot pelanggan aktif: @${me.username}`)
  } catch (error) {
    setBotStatus({ running: false, lastError: error.message })
    console.error(`Bot pelanggan tidak bisa dimulai: ${error.message}`)
    return
  }
  running = true
  controller = new AbortController()
  let backoff = 1000
  while (running) {
    try {
      await pollOnce(api, { signal: controller.signal })
      backoff = 1000
      setBotStatus({ lastError: null })
    } catch (error) {
      if (!running) break
      const conflict = error.code === 409
      setBotStatus({ lastError: conflict ? 'Token bot dipakai program lain yang juga membaca pesan (getUpdates).' : error.message })
      backoff = conflict ? 30000 : Math.min(backoff * 2, 30000)
      await sleep(backoff)
    }
  }
}

export const stopSubscriberBot = () => {
  running = false
  controller?.abort()
  setBotStatus({ running: false })
  persistNow()
}
