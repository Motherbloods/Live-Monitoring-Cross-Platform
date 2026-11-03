import { addLog, getState, persist } from '../store/db.js'
import { bumpQueue } from './botStatus.js'
import { liveUrl } from './notifier.js'
import { followersOf } from './subscription.js'
import { createBotApi } from './telegramApi.js'

const NAMES = { tiktok: 'TikTok', bigo: 'Bigo Live', youtube: 'YouTube', twitch: 'Twitch', shopee: 'Shopee Live', instagram: 'Instagram Live' }
const MAX_IN_FLIGHT = 5
const MAX_ATTEMPTS = 3

const api = createBotApi(() => process.env.SUBSCRIBER_BOT_TOKEN)
let sender = (chatId, text) => api('sendMessage', { chat_id: chatId, text, disable_web_page_preview: true })
let chatIntervalMs = 1100
let perSecond = 25
let networkRetryMs = 3000

const queue = []
const nextAllowed = new Map()
let inFlight = 0
let windowStart = 0
let windowCount = 0
let timer = null
let idle = []

export const setSubscriberSender = (fn) => {
  sender = fn
}

export const setRateLimits = ({ chatMs, globalPerSecond, retryMs }) => {
  if (retryMs !== undefined) networkRetryMs = retryMs
  if (chatMs !== undefined) chatIntervalMs = chatMs
  if (globalPerSecond !== undefined) perSecond = globalPerSecond
}

export const botReady = () => Boolean(process.env.SUBSCRIBER_BOT_TOKEN)

const clock = (iso, timezone) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone })

const minutesText = (from, to) => {
  const m = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`
}

const settle = () => {
  if (queue.length === 0 && inFlight === 0) {
    const waiting = idle
    idle = []
    waiting.forEach((resolve) => resolve())
  }
}

const markBlocked = (subscriberId) => {
  const sub = getState().subscribers.find((s) => s.id === subscriberId)
  if (sub && !sub.blocked) {
    sub.blocked = true
    sub.blockedAt = new Date().toISOString()
    addLog(null, 'WARN', `Pelanggan ${sub.name || sub.chatId} memblokir bot atau chat tidak ditemukan; notifikasi dihentikan`)
    persist()
  }
}

const unreachable = (error) => error.code === 403 || (error.code === 400 && /chat not found|user is deactivated/i.test(error.message))

const run = async (item) => {
  inFlight += 1
  try {
    await sender(item.chatId, item.text)
    bumpQueue('sent')
  } catch (error) {
    if (unreachable(error)) {
      markBlocked(item.subscriberId)
      bumpQueue('failed')
    } else if (item.attempts + 1 < MAX_ATTEMPTS && (error.retryAfter || error.network)) {
      const delay = error.retryAfter ? Math.min(error.retryAfter, 30) * 1000 : networkRetryMs
      queue.push({ ...item, attempts: item.attempts + 1, notBefore: Date.now() + delay })
      bumpQueue('pending')
    } else {
      bumpQueue('failed')
      addLog(null, 'ERROR', `Notifikasi pelanggan gagal terkirim: ${error.message}`)
      persist()
    }
  } finally {
    inFlight -= 1
    pump()
  }
}

const pump = () => {
  clearTimeout(timer)
  const now = Date.now()
  if (now - windowStart >= 1000) {
    windowStart = now
    windowCount = 0
  }
  let wake = Infinity
  for (let i = 0; i < queue.length && inFlight < MAX_IN_FLIGHT; ) {
    const item = queue[i]
    const ready = Math.max(item.notBefore || 0, nextAllowed.get(item.chatId) || 0)
    if (ready > now) {
      wake = Math.min(wake, ready)
      i += 1
    } else if (windowCount >= perSecond) {
      wake = Math.min(wake, windowStart + 1000)
      break
    } else {
      queue.splice(i, 1)
      bumpQueue('pending', -1)
      windowCount += 1
      nextAllowed.set(item.chatId, now + chatIntervalMs)
      run(item)
    }
  }
  if (queue.length && wake !== Infinity) timer = setTimeout(pump, Math.max(10, wake - Date.now()))
  settle()
}

export const notifySubscriber = (subscriber, text) => {
  if (!botReady() || subscriber.blocked) return false
  queue.push({ chatId: subscriber.chatId, subscriberId: subscriber.id, text, attempts: 0, notBefore: 0 })
  bumpQueue('pending')
  pump()
  return true
}

export const flushSubscriberQueue = () => (queue.length === 0 && inFlight === 0 ? Promise.resolve() : new Promise((resolve) => idle.push(resolve)))

export const liveStartText = (account, live) => {
  const timezone = getState().config.global.timezone
  const lines = [`${account.displayName} sedang live di ${NAMES[account.platformId]}`, '', `Akun: @${account.username}`, `Mulai: ${clock(live.startedAt, timezone)}`]
  if (live.title && live.title !== 'Live Bigo') lines.push(`Judul: ${live.title}`)
  lines.push(`Tonton: ${live.url || liveUrl(account)}`)
  return lines.join('\n')
}

export const notifyFollowersLiveStart = (account, live) => {
  if (!botReady()) return 0
  const text = liveStartText(account, live)
  return followersOf(account.id).filter((s) => notifySubscriber(s, text)).length
}

export const notifyFollowersLiveEnd = (account, startedAt) => {
  if (!botReady()) return 0
  const lines = [`${account.displayName} selesai live di ${NAMES[account.platformId]}`, '', `Akun: @${account.username}`]
  if (startedAt) lines.push(`Durasi: ${minutesText(startedAt, new Date().toISOString())}`)
  const text = lines.join('\n')
  return followersOf(account.id).filter((s) => s.notifyEnd && notifySubscriber(s, text)).length
}
