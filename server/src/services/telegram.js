import { addLog, persist } from '../store/db.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const credentials = () => ({ token: process.env.TELEGRAM_BOT_TOKEN || '', chatId: process.env.TELEGRAM_CHAT_ID || '' })

export const isConfigured = () => {
  const { token, chatId } = credentials()
  return Boolean(token && chatId)
}

const sanitize = (message) => {
  const { token } = credentials()
  const clean = token ? String(message).split(token).join('***') : String(message)
  return clean.replace(/bot\d+:[\w-]+/g, 'bot***')
}

export const sendMessage = async (text) => {
  const { token, chatId } = credentials()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let response
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: controller.signal
    })
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'Telegram tidak merespons (timeout).' : 'Tidak dapat menghubungi Telegram.')
  } finally {
    clearTimeout(timer)
  }
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.ok) {
    const error = new Error(sanitize(data?.description || `Telegram menjawab HTTP ${response.status}`))
    error.retryAfter = data?.parameters?.retry_after
    throw error
  }
  return true
}

let sender = sendMessage
let minIntervalMs = 1100
const queue = []
let running = null

export const setSender = (fn) => {
  sender = fn
}

export const setMinIntervalMs = (ms) => {
  minIntervalMs = ms
}

const deliver = async (item, retried = false) => {
  try {
    await sender(item.text)
  } catch (error) {
    if (error.retryAfter && !retried && error.retryAfter <= 30) {
      await sleep(error.retryAfter * 1000)
      return deliver(item, true)
    }
    addLog(item.platformId || null, 'ERROR', `Notifikasi Telegram gagal: ${sanitize(error.message)}`)
    persist()
    return null
  }
  return null
}

const drain = async () => {
  while (queue.length) {
    await deliver(queue.shift())
    if (queue.length) await sleep(minIntervalMs)
  }
}

const start = () => {
  if (running) return
  running = drain().finally(() => {
    running = null
    if (queue.length) start()
  })
}

export const enqueue = (text, platformId = null) => {
  if (queue.length >= 100) queue.shift()
  queue.push({ text, platformId })
  start()
}

export const flush = async () => {
  while (running) await running
}
