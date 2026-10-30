import { Router } from 'express'
import { COOKIE_NAME, authConfig, clearSessionCookie, createSession, destroySession, loginLimiter, parseCookies, requireAuth, safeEqual, setSessionCookie } from '../services/auth.js'
import { verifyPassword } from '../utils/password.js'
import { HttpError, wrap } from '../utils/http.js'

const router = Router()

router.post('/login', wrap(async (req, res) => {
  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password || username.length > 100 || password.length > 200) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Username dan kata sandi wajib diisi.')
  }
  const wait = loginLimiter.retryAfterSeconds(req.ip, username)
  if (wait > 0) {
    res.set('Retry-After', String(wait))
    throw new HttpError(429, 'TOO_MANY_ATTEMPTS', `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(wait / 60)} menit.`)
  }
  const config = authConfig()
  const userOk = safeEqual(username, config.username)
  const passOk = await verifyPassword(password, config.passwordHash)
  if (!userOk || !passOk) {
    loginLimiter.fail(req.ip, username)
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Username atau kata sandi salah.')
  }
  loginLimiter.reset(req.ip, username)
  setSessionCookie(res, createSession(config.username))
  res.json({ user: { username: config.username } })
}))

router.post('/logout', (req, res) => {
  destroySession(parseCookies(req.headers.cookie)[COOKIE_NAME])
  clearSessionCookie(res)
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
