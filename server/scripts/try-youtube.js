import 'dotenv/config'
import { youtubeChecker, youtubeConfigured, youtubeUsage } from '../src/services/youtube.js'

const username = (process.argv[2] || '').replace(/^@/, '')

if (!username) {
  console.error('Pemakaian: npm run try-youtube -- <handle atau ID channel UC...>')
  process.exit(1)
}

if (!youtubeConfigured()) {
  console.error('YOUTUBE_API_KEY belum diisi di .env.')
  process.exit(1)
}

try {
  console.log('Hasil:', JSON.stringify(await youtubeChecker({ username }, null), null, 2))
} catch (error) {
  console.error('Gagal:', error.message)
  process.exitCode = 1
}
console.log(`Unit kuota terpakai oleh percobaan ini: ${youtubeUsage().units}`)
