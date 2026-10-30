import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { HttpError } from '../utils/http.js'

export const COOKIE_NAME = 'lm_session'

export const authConfig = () => ({
  username: process.env.ADMIN_USERNAME || 'admin',
  passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
  ttlMs: (Number(process.env.SESSION_TTL_HOURS) || 12) * 3600 * 1000,
  secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'
})

export const assertAuthConfig = () => {
  const { passwordHash } = authConfig()
  if (!passwordHash.startsWith('scrypt:')) {
    console.error('ADMIN_PASSWORD_HASH belum diatur di .env. Jalankan "npm run hash-password" lalu salin hasilnya.')
    process.exit(1)
  }
}

const digest = (value) => createHash('sha256').update(value).digest('hex')
const sessions = new Map()

export const createSession = (username) => {
  const id = randomBytes(32).toString('base64url')
  sessions.set(digest(id), { username, exp: Date.now() + authConfig().ttlMs })
  return id
}

export const getSession = (id) => {
  if (!id) return null
  const session = sessions.get(digest(id))
  if (!session) return null
  if (session.exp < Date.now()) {
    sessions.delete(digest(id))
    return null
  }
  return session
}

export const destroySession = (id) => {
  if (id) sessions.delete(digest(id))
}

const purge = setInterval(() => {
  const now = Date.now()
  for (const [key, s] of sessions) if (s.exp < now) sessions.delete(key)
}, 10 * 60 * 1000)
purge.unref()

export const parseCookies = (header = '') =>
  Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split(/=(.*)/s))
      .filter(([k]) => k)
      .map(([k, v]) => [k, decodeURIComponent(v || '')])
  )

export const setSessionCookie = (res, id) => {
  const { ttlMs, secure } = authConfig()
  res.append('Set-Cookie', `${COOKIE_NAME}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(ttlMs / 1000)}${secure ? '; Secure' : ''}`)
}

export const clearSessionCookie = (res) => {
  const { secure } = authConfig()
  res.append('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`)
}

export const safeEqual = (a, b) => {
  const x = createHash('sha256').update(String(a)).digest()
  const y = createHash('sha256').update(String(b)).digest()
  return timingSafeEqual(x, y)
}

export const requireAuth = (req, res, next) => {
  const session = getSession(parseCookies(req.headers.cookie)[COOKIE_NAME])
  if (!session) return next(new HttpError(401, 'UNAUTHENTICATED', 'Silakan masuk terlebih dahulu.'))
  req.user = { username: session.username }
  return next()
}

const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_ACCOUNT = 5
const MAX_PER_IP = 20
const attempts = new Map()

const bucket = (key) => {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || now - entry.first > WINDOW_MS) {
    const fresh = { count: 0, first: now }
    attempts.set(key, fresh)
    return fresh
  }
  return entry
}

export const loginLimiter = {
  retryAfterSeconds: (ip, username) => {
    const acc = bucket(`${ip}|${username.toLowerCase()}`)
    const addr = bucket(ip)
    const blocked = acc.count >= MAX_PER_ACCOUNT ? acc : addr.count >= MAX_PER_IP ? addr : null
    return blocked ? Math.ceil((blocked.first + WINDOW_MS - Date.now()) / 1000) : 0
  },
  fail: (ip, username) => {
    bucket(`${ip}|${username.toLowerCase()}`).count += 1
    bucket(ip).count += 1
  },
  reset: (ip, username) => attempts.delete(`${ip}|${username.toLowerCase()}`)
}
