import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_CONFIG } from '../config/defaults.js'

const file = () => path.resolve(process.env.DB_FILE || 'data/db.json')
const clone = (v) => JSON.parse(JSON.stringify(v))

const seedAccounts = [
  ['tiktok', 'nadia.putri', 'Nadia Putri'],
  ['tiktok', 'rizky_gadget', 'Rizky Gadget', 15],
  ['tiktok', 'laras.skincare', 'Laras Skincare'],
  ['shopee', 'toko_batik_solo', 'Toko Batik Solo'],
  ['shopee', 'sepatu.lokal', 'Sepatu Lokal'],
  ['youtube', 'WarungTekno', 'Warung Tekno'],
  ['instagram', 'ayu.travel', 'Ayu Travel'],
  ['instagram', 'tari.studio', 'Tari Studio'],
  ['twitch', 'pixel_raka', 'Pixel Raka'],
  ['twitch', 'gita.codes', 'Gita Codes']
]

const hosts = { tiktok: 'tiktok.com/@', shopee: 'shopee.co.id/', youtube: 'youtube.com/@', instagram: 'instagram.com/', twitch: 'twitch.tv/' }

export const emptyRuntime = () => ({ checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null })

const seed = () => {
  const accounts = seedAccounts.map(([platformId, username, displayName, custom], i) => ({
    id: `acc_${String(i + 1).padStart(3, '0')}`,
    platformId,
    username,
    displayName,
    profileUrl: `https://${hosts[platformId]}${username}`,
    monitoringEnabled: true,
    useCustomCheckInterval: Boolean(custom),
    customCheckIntervalSeconds: custom || null,
    autoRecording: null,
    notifyEnabled: null,
    notifyOnStart: null,
    notifyOnEnd: null,
    notes: ''
  }))
  return {
    config: clone(DEFAULT_CONFIG),
    configSavedAt: null,
    accounts,
    runtime: Object.fromEntries(accounts.map((a) => [a.id, emptyRuntime()])),
    platformRuntime: Object.fromEntries(Object.keys(DEFAULT_CONFIG.platforms).map((id) => [id, { status: 'online', lastSuccess: null, lastError: null, retryCount: 0 }])),
    history: [],
    recordings: [],
    logs: []
  }
}

let state = null
let timer = null

export const persistNow = () => {
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  const tmp = `${file()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, file())
}

export const loadState = () => {
  try {
    state = JSON.parse(fs.readFileSync(file(), 'utf8'))
    for (const r of Object.values(state.runtime)) r.checking = false
  } catch {
    state = seed()
    persistNow()
  }
  return state
}

export const getState = () => state

export const persist = () => {
  clearTimeout(timer)
  timer = setTimeout(persistNow, 300)
  timer.unref?.()
}

export const addLog = (platformId, level, message) => {
  state.logs.unshift({ id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, platformId, level, message, at: new Date().toISOString() })
  state.logs.length = Math.min(state.logs.length, 300)
}
