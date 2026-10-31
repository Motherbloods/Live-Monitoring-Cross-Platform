import { writeFileSync } from 'node:fs'
import { closeBrowser, fetchPageHtml } from '../src/services/browser.js'
import { parseTiktokLive } from '../src/services/tiktok.js'

const username = (process.argv[2] || '').replace(/^@/, '')
const dump = process.argv.includes('--dump')

if (!username) {
  console.error('Pemakaian: npm run try-tiktok -- <username> [--dump]')
  process.exit(1)
}

try {
  const html = await fetchPageHtml(`https://www.tiktok.com/@${username}/live`, { selector: '#SIGI_STATE' })
  console.log(`Halaman diambil: ${html.length} karakter, SIGI_STATE ${html.includes('SIGI_STATE') ? 'ada' : 'TIDAK ada'}`)
  if (dump) {
    writeFileSync('tiktok-dump.html', html)
    console.log('Halaman disimpan ke tiktok-dump.html')
  }
  console.log('Hasil:', JSON.stringify(parseTiktokLive(html), null, 2))
} catch (error) {
  console.error('Gagal:', error.message)
  process.exitCode = 1
} finally {
  await closeBrowser()
}
