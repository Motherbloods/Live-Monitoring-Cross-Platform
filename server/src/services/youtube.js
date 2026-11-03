const API = 'https://www.googleapis.com/youtube/v3'
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/
const HANDLE = /^[A-Za-z0-9._-]{3,30}$/

const apiKey = () => process.env.YOUTUBE_API_KEY || ''

export const youtubeConfigured = () => Boolean(apiKey())

const sanitize = (message) => {
  const key = apiKey()
  return key ? String(message).split(key).join('***') : String(message)
}

const pacificNow = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date())
  const o = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { day: `${o.year}-${o.month}-${o.day}`, secondsIntoDay: Number(o.hour) * 3600 + Number(o.minute) * 60 + Number(o.second) }
}

let usage = { day: '', units: 0 }
let blockedUntil = 0
let channelIds = new Map()
let settled = new Set()

export const youtubeUsage = () => {
  const { day } = pacificNow()
  if (usage.day !== day) usage = { day, units: 0 }
  return { day, units: usage.units }
}

export const resetYoutubeCache = () => {
  usage = { day: '', units: 0 }
  blockedUntil = 0
  channelIds = new Map()
  settled = new Set()
}

const request = async (url) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    return await fetch(url, { signal: controller.signal })
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'YouTube tidak merespons (timeout).' : 'Tidak dapat menghubungi YouTube.')
  } finally {
    clearTimeout(timer)
  }
}

const quotaMessage = () => `Kuota harian YouTube habis. Pemeriksaan dilanjutkan setelah reset (tengah malam Waktu Pasifik, sekitar ${Math.ceil(Math.max(0, blockedUntil - Date.now()) / 3600000)} jam lagi).`

const apiError = (status, data) => {
  const reason = data?.error?.errors?.[0]?.reason
  const message = data?.error?.message
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    blockedUntil = Date.now() + (86400 - pacificNow().secondsIntoDay) * 1000
    return new Error(quotaMessage())
  }
  if (reason === 'keyInvalid' || (status === 400 && /api key/i.test(message || ''))) return new Error('API key YouTube tidak valid.')
  if (reason === 'accessNotConfigured') return new Error('YouTube Data API v3 belum diaktifkan di proyek Google Cloud Anda.')
  if (reason === 'playlistNotFound') return new Error('Channel YouTube tidak ditemukan atau belum punya video publik.')
  if (reason === 'rateLimitExceeded') return new Error('YouTube membatasi permintaan sementara. Naikkan interval pemeriksaan.')
  return new Error(sanitize(`YouTube menjawab ${status}${message ? `: ${message}` : ''}`))
}

const call = async (path, params) => {
  if (Date.now() < blockedUntil) throw new Error(quotaMessage())
  const url = new URL(`${API}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set('key', apiKey())
  youtubeUsage()
  usage.units += 1
  const response = await request(url)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw apiError(response.status, data)
  return data
}

const resolveChannel = async (username) => {
  const name = String(username || '').replace(/^@/, '')
  if (CHANNEL_ID.test(name)) return name
  if (!HANDLE.test(name)) throw new Error('Username YouTube tidak valid (handle 3-30 karakter, atau ID channel yang diawali UC).')
  const cached = channelIds.get(name.toLowerCase())
  if (cached) return cached
  const data = await call('channels', { part: 'id', forHandle: `@${name}` })
  const id = data.items?.[0]?.id
  if (!id) throw new Error(`Channel YouTube "@${name}" tidak ditemukan.`)
  channelIds.set(name.toLowerCase(), id)
  return id
}

const viewersOf = (video) => {
  const n = Number(video.liveStreamingDetails?.concurrentViewers)
  return Number.isFinite(n) ? n : null
}

export const youtubeChecker = async (account, previous) => {
  if (!youtubeConfigured()) throw new Error('API key YouTube belum diisi (YOUTUBE_API_KEY di .env server).')
  const channelId = await resolveChannel(account.username)

  const videosOf = async (ids) => (ids.length ? (await call('videos', { part: 'snippet,liveStreamingDetails', id: ids.join(',') })).items || [] : [])
  const state = (video) => video.snippet?.liveBroadcastContent
  const toLive = (video) => ({
    videoId: video.id,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    title: video.snippet?.title?.trim() || 'Live YouTube',
    startedAt: video.liveStreamingDetails?.actualStartTime || previous?.live?.startedAt || new Date().toISOString(),
    viewers: viewersOf(video),
    simulated: false
  })

  if (previous?.lastStatus === 'live' && previous.live?.videoId) {
    const [video] = await videosOf([previous.live.videoId])
    if (video && state(video) === 'live') return { status: 'live', live: toLive(video) }
  }

  const playlist = await call('playlistItems', { part: 'contentDetails', playlistId: `UU${channelId.slice(2)}`, maxResults: '5' })
  const ids = (playlist.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean)
  const fresh = ids.filter((id) => !settled.has(id))
  const videos = await videosOf(fresh)

  if (settled.size > 5000) settled = new Set()
  const returned = new Set(videos.map((v) => v.id))
  for (const id of fresh) if (!returned.has(id)) settled.add(id)
  for (const video of videos) if (state(video) !== 'live' && state(video) !== 'upcoming') settled.add(video.id)

  const live = videos.filter((v) => state(v) === 'live').sort((a, b) => (viewersOf(b) || 0) - (viewersOf(a) || 0))[0]
  return live ? { status: 'live', live: toLive(live) } : { status: 'offline', live: null }
}
