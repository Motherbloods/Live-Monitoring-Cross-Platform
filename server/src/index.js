import 'dotenv/config'
import { createApp } from './app.js'
import { assertAuthConfig } from './services/auth.js'
import { loadState, persistNow } from './store/db.js'
import { closeBrowser } from './services/browser.js'
import { startSubscriptionJobs, stopSubscriptionJobs } from './services/subscriptionJobs.js'
import { startSubscriberBot, stopSubscriberBot } from './services/subscriberBot.js'
import { startScheduler } from './services/monitor.js'

assertAuthConfig()
loadState()
startScheduler()
startSubscriberBot()
startSubscriptionJobs()

const port = Number(process.env.PORT) || 4000
const server = createApp().listen(port, () => {
  console.log(`Live Monitor server berjalan di http://localhost:${port}`)
})

const shutdown = async () => {
  stopSubscriberBot()
  stopSubscriptionJobs()
  persistNow()
  await closeBrowser()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1500).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
