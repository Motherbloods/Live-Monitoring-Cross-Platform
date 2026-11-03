import { getState } from '../store/db.js'
import { enqueue, isConfigured } from './telegram.js'

const NAMES = { tiktok: 'TikTok', shopee: 'Shopee Live', youtube: 'YouTube Live', instagram: 'Instagram Live', twitch: 'Twitch' }
const COOLDOWN_MS = 10 * 60 * 1000
const lastSent = new Map()

export const resetCooldowns = () => lastSent.clear()

export const liveUrl = (account) => (account.platformId === 'tiktok' ? `${account.profileUrl.replace(/\/$/, '')}/live` : account.profileUrl)

const clock = (iso, timezone) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone })

const minutesText = (from, to) => {
  const m = Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}j ${m % 60}m` : `${m}m`
}

const platformSettings = (platformId, config) => ({ ...config.global.notificationDefaults, ...config.platforms[platformId].notificationOverrides })

const accountSettings = (account, config) => {
  const base = platformSettings(account.platformId, config)
  return { ...base, enabled: account.notifyEnabled ?? base.enabled, liveStart: account.notifyOnStart ?? base.liveStart, liveEnd: account.notifyOnEnd ?? base.liveEnd }
}

const send = (platformId, lines) => enqueue(lines.join('\n'), platformId)

const cooled = (key) => {
  const now = Date.now()
  if (now - (lastSent.get(key) || 0) < COOLDOWN_MS) return false
  lastSent.set(key, now)
  return true
}

export const notifyLiveStart = (account, live) => {
  if (!isConfigured()) return
  const { config } = getState()
  const s = accountSettings(account, config)
  if (!s.enabled || !s.liveStart) return
  const name = NAMES[account.platformId]
  send(account.platformId, [
    `${name} Live Started`,
    '',
    `Account: @${account.username}`,
    `Platform: ${name}`,
    `Started At: ${clock(live.startedAt, config.global.timezone)}`,
    ...(live.title ? [`Title: ${live.title}`] : []),
    `Live URL: ${liveUrl(account)}`
  ])
}

export const notifyLiveEnd = (account, startedAt) => {
  if (!isConfigured()) return
  const { config } = getState()
  const s = accountSettings(account, config)
  if (!s.enabled || !s.liveEnd) return
  const name = NAMES[account.platformId]
  const now = new Date().toISOString()
  send(account.platformId, [
    `${name} Live Ended`,
    '',
    `Account: @${account.username}`,
    `Platform: ${name}`,
    `Ended At: ${clock(now, config.global.timezone)}`,
    ...(startedAt ? [`Duration: ${minutesText(startedAt, now)}`] : [])
  ])
}

export const notifyServiceFailed = (platformId, message) => {
  if (!isConfigured()) return
  const s = platformSettings(platformId, getState().config)
  if (!s.enabled || !s.serviceFail || !cooled(`fail:${platformId}`)) return
  send(platformId, [`${NAMES[platformId]} Service Failed`, '', `Platform: ${NAMES[platformId]}`, `Error: ${message}`])
}

export const notifyServiceRecovered = (platformId) => {
  if (!isConfigured()) return
  const s = platformSettings(platformId, getState().config)
  if (!s.enabled || !s.serviceRecover || !cooled(`recover:${platformId}`)) return
  send(platformId, [`${NAMES[platformId]} Service Recovered`, '', `Platform: ${NAMES[platformId]}`, 'Status: Online'])
}
