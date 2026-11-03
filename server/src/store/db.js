import fs from 'node:fs'
import path from 'node:path'
import { DEFAULT_CONFIG, DEFAULT_SUBSCRIPTION_SETTINGS } from '../config/defaults.js'
import { createMongoStorage } from './mongoStorage.js'

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
  ['twitch', 'gita_codes', 'Gita Codes']
]

const hosts = { tiktok: 'tiktok.com/@', shopee: 'shopee.co.id/', youtube: 'youtube.com/@', instagram: 'instagram.com/', twitch: 'twitch.tv/' }

export const emptyRuntime = () => ({ checking: false, lastStatus: 'unknown', lastChecked: null, lastSuccess: null, lastError: null, live: null })

const seed = () => {
  const demo = process.env.SEED_DEMO !== 'false'
  const accounts = (demo ? seedAccounts : []).map(([platformId, username, displayName, custom], i) => ({
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
    logs: [],
    codes: [],
    subscribers: [],
    subscriptionSettings: clone(DEFAULT_SUBSCRIPTION_SETTINGS),
    botOffset: 0
  }
}

let state = null
let timer = null
let storage = null

const migrate = (loaded) => {
  const defaults = clone(DEFAULT_CONFIG)
  loaded.config = loaded.config || defaults
  loaded.config.global = { ...defaults.global, ...loaded.config.global }
  loaded.config.platforms = loaded.config.platforms || {}
  loaded.platformRuntime = loaded.platformRuntime || {}
  for (const id of Object.keys(defaults.platforms)) {
    loaded.config.platforms[id] = { ...defaults.platforms[id], ...loaded.config.platforms[id] }
    loaded.platformRuntime[id] = loaded.platformRuntime[id] || { status: 'online', lastSuccess: null, lastError: null, retryCount: 0 }
  }
  for (const key of ['accounts', 'history', 'recordings', 'logs', 'codes', 'subscribers']) loaded[key] = loaded[key] || []
  loaded.runtime = loaded.runtime || {}
  loaded.configSavedAt = loaded.configSavedAt ?? null
  loaded.botOffset = Number(loaded.botOffset) || 0
  loaded.subscriptionSettings = { ...clone(DEFAULT_SUBSCRIPTION_SETTINGS), ...loaded.subscriptionSettings }
  return loaded
}

const writeFile = () => {
  fs.mkdirSync(path.dirname(file()), { recursive: true })
  const tmp = `${file()}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, file())
}

export const persistNow = () => {
  if (storage) return storage.enqueue(() => state)
  writeFile()
  return Promise.resolve()
}

const prepare = (loaded) => {
  const ready = migrate(loaded)
  for (const r of Object.values(ready.runtime)) r.checking = false
  return ready
}

export const loadState = () => {
  storage = null
  try {
    state = prepare(JSON.parse(fs.readFileSync(file(), 'utf8')))
  } catch {
    state = seed()
    writeFile()
  }
  return state
}

export const initStore = async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) return loadState()
  const mongo = await createMongoStorage({ uri, dbName: process.env.MONGODB_DB || 'live_monitor', timeoutMs: Number(process.env.MONGODB_TIMEOUT_MS) || 8000 })
  let migratedFrom = null
  const loaded = await mongo.load()
  if (loaded) {
    state = prepare(loaded)
  } else if (fs.existsSync(file())) {
    try {
      state = prepare(JSON.parse(fs.readFileSync(file(), 'utf8')))
      migratedFrom = file()
    } catch {
      state = seed()
    }
  } else {
    state = seed()
  }
  storage = mongo
  await persistNow()
  if (migratedFrom) {
    try {
      fs.renameSync(migratedFrom, `${migratedFrom}.sudah-dipindah`)
      console.log(`Data dari ${migratedFrom} dipindahkan ke MongoDB. File lama disimpan sebagai ${migratedFrom}.sudah-dipindah`)
    } catch {
      console.log(`Data dari ${migratedFrom} dipindahkan ke MongoDB. File lama tidak bisa diganti namanya (folder hanya-baca), hapus atau pindahkan sendiri.`)
    }
  }
  return state
}

export const flushStore = async () => {
  if (storage) {
    storage.enqueue(() => state)
    await storage.flush()
  }
}

export const closeStore = async () => {
  if (storage) {
    await storage.close()
    storage = null
  }
}

export const storageInfo = () => (storage ? { kind: 'mongo', ...storage.info() } : { kind: 'file', lastError: null })

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
