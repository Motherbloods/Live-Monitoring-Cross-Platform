import 'dotenv/config'
import { twitchChecker, twitchConfigured } from '../src/services/twitch.js'

const username = (process.argv[2] || '').replace(/^@/, '')

if (!username) {
  console.error('Pemakaian: npm run try-twitch -- <username>')
  process.exit(1)
}

if (!twitchConfigured()) {
  console.error('TWITCH_CLIENT_ID dan TWITCH_CLIENT_SECRET belum diisi di .env.')
  process.exit(1)
}

try {
  console.log('Hasil:', JSON.stringify(await twitchChecker({ username }, null), null, 2))
} catch (error) {
  console.error('Gagal:', error.message)
  process.exitCode = 1
}
