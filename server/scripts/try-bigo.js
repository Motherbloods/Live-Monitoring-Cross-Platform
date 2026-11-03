import 'dotenv/config'
import { bigoSessionAvailable, fetchBigoInfo } from '../src/services/bigo.js'
import { closeBrowser } from '../src/services/browser.js'

const username = (process.argv[2] || '').replace(/^@/, '')

if (!username) {
  console.error('Pemakaian: npm run try-bigo -- <id bigo>')
  process.exit(1)
}

if (!bigoSessionAvailable()) {
  console.error('File sesi Bigo tidak ditemukan atau tidak valid. Periksa BIGO_SESSION_FILE di .env.')
  process.exit(1)
}

try {
  const info = await fetchBigoInfo(username)
  const scalars = Object.fromEntries(Object.entries(info).filter(([k, v]) => ['alive', 'needLogin', 'roomId'].includes(k) && typeof v !== 'object'))
  console.log('Nilai penting:', JSON.stringify({ ...scalars, adaUrlStream: Boolean(info.hls_src || (Array.isArray(info.cdn_src) && info.cdn_src.length)) }))
  console.log('Nama field yang dikirim Bigo:', Object.keys(info).join(', '))
  console.log(info.needLogin ? 'Sesi login KEDALUWARSA.' : info.alive === 1 ? 'Status: LIVE.' : 'Status: tidak live.')
} catch (error) {
  console.error('Gagal:', error.message)
  process.exitCode = 1
} finally {
  await closeBrowser()
}
