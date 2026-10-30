import cors from 'cors'
import express from 'express'
import accounts from './routes/accounts.js'
import platforms from './routes/platforms.js'
import config from './routes/config.js'
import monitoring from './routes/monitoring.js'
import { history, logs, notifications, recordings } from './routes/data.js'
import auth from './routes/auth.js'
import { requireAuth } from './services/auth.js'
import { HttpError } from './utils/http.js'

export const createApp = () => {
  const app = express()
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim())
  app.disable('x-powered-by')
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : process.env.TRUST_PROXY)
  app.use(cors({ origin: origins, credentials: true, allowedHeaders: ['Content-Type', 'X-Requested-With'] }))
  app.use(express.json({ limit: '100kb' }))
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' })
    next()
  })
  app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.get('x-requested-with') !== 'live-monitor') {
      return next(new HttpError(403, 'CSRF_REJECTED', 'Permintaan ditolak.'))
    }
    return next()
  })

  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.use('/api/auth', auth)
  app.use('/api', requireAuth)
  app.use('/api/accounts', accounts)
  app.use('/api/platforms', platforms)
  app.use('/api/config', config)
  app.use('/api/monitoring', monitoring)
  app.use('/api/history', history)
  app.use('/api/logs', logs)
  app.use('/api/recordings', recordings)
  app.use('/api/notifications', notifications)

  app.use((req, res, next) => next(new HttpError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan.')))

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Body bukan JSON yang valid.' } })
    if (err instanceof HttpError) return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
    console.error(err)
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } })
  })

  return app
}
