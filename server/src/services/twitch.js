const LOGIN = /^[A-Za-z0-9_]{4,25}$/
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const API_URL = 'https://api.twitch.tv/helix'

const credentials = () => ({ clientId: process.env.TWITCH_CLIENT_ID || '', clientSecret: process.env.TWITCH_CLIENT_SECRET || '' })

export const twitchConfigured = () => {
  const { clientId, clientSecret } = credentials()
  return Boolean(clientId && clientSecret)
}

const sanitize = (message) => {
  const { clientSecret } = credentials()
  return clientSecret ? String(message).split(clientSecret).join('***') : String(message)
}

let token = null
let tokenExpiresAt = 0
const verified = new Set()

export const resetTwitchCache = () => {
  token = null
  tokenExpiresAt = 0
  verified.clear()
}

const request = async (url, options = {}) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'Twitch tidak merespons (timeout).' : 'Tidak dapat menghubungi Twitch.')
  } finally {
    clearTimeout(timer)
  }
}

const fetchToken = async () => {
  const { clientId, clientSecret } = credentials()
  const response = await request(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' })
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || !data?.access_token) {
    throw new Error(sanitize(`Gagal mengambil token Twitch (${response.status}): ${data?.message || 'periksa TWITCH_CLIENT_ID dan TWITCH_CLIENT_SECRET'}`))
  }
  token = data.access_token
  tokenExpiresAt = Date.now() + Math.max(60, Number(data.expires_in) || 3600) * 1000 - 60000
  return token
}

const getToken = async () => (token && Date.now() < tokenExpiresAt ? token : fetchToken())

const helix = async (path, retried = false) => {
  const { clientId } = credentials()
  const response = await request(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${await getToken()}`, 'Client-Id': clientId } })
  if (response.status === 401 && !retried) {
    token = null
    return helix(path, true)
  }
  if (response.status === 429) throw new Error('Twitch membatasi permintaan (rate limit). Naikkan interval pemeriksaan.')
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(sanitize(`Twitch menjawab ${response.status}${data?.message ? `: ${data.message}` : ''}`))
  }
  return response.json()
}

export const twitchChecker = async (account, previous) => {
  if (!twitchConfigured()) throw new Error('Kredensial Twitch belum diisi (TWITCH_CLIENT_ID dan TWITCH_CLIENT_SECRET di .env server).')
  const login = String(account.username || '')
  if (!LOGIN.test(login)) throw new Error('Username Twitch tidak valid (4-25 karakter: huruf, angka, garis bawah).')
  const key = login.toLowerCase()

  const { data } = await helix(`/streams?user_login=${encodeURIComponent(key)}&first=1`)
  const stream = Array.isArray(data) ? data.find((s) => s.type === 'live') : null

  if (stream) {
    verified.add(key)
    return {
      status: 'live',
      live: {
        title: stream.title?.trim() || 'Live Twitch',
        game: stream.game_name || null,
        startedAt: stream.started_at || previous?.live?.startedAt || new Date().toISOString(),
        viewers: Number.isFinite(Number(stream.viewer_count)) ? Number(stream.viewer_count) : null,
        simulated: false
      }
    }
  }

  if (!verified.has(key)) {
    const users = await helix(`/users?login=${encodeURIComponent(key)}`)
    if (!users.data?.length) throw new Error(`Akun Twitch "${login}" tidak ditemukan.`)
    verified.add(key)
  }
  return { status: 'offline', live: null }
}
