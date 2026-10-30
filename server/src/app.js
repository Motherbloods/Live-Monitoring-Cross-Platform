import cors from 'cors'
import express from 'express'
import accounts from './routes/accounts.js'
import platforms from './routes/platforms.js'
import config from './routes/config.js'
import monitoring from './routes/monitoring.js'
import { history, logs, notifications, recordings } from './routes/data.js'
import { HttpError } from './utils/http.js'

export const createApp = () => {
  const app = express()
  const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim())
  app.disable('x-powered-by')
  app.use(cors({ origin: origins }))
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (req, res) => res.json({ ok: true }))
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
