import 'dotenv/config'
import { createApp } from './app.js'
import { assertAuthConfig } from './services/auth.js'
import { loadState, persistNow } from './store/db.js'
import { startScheduler } from './services/monitor.js'

assertAuthConfig()
loadState()
startScheduler()

const port = Number(process.env.PORT) || 4000
const server = createApp().listen(port, () => {
  console.log(`Live Monitor server berjalan di http://localhost:${port}`)
})

const shutdown = () => {
  persistNow()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
