import fs from 'node:fs'
import path from 'node:path'

const URL_STUDIO = 'https://ta.bigo.tv/official_website/studio/getInternalStudioInfo'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const USERNAME = /^[A-Za-z0-9_]{2,40}$/
const COOKIE_NAME = /^[\w!#$%&'*+.^`|~-]+$/

const sessionPath = () => path.resolve(process.env.BIGO_SESSION_FILE || 'data/bigo-session.json')

let cache = { path: '', mtimeMs: 0, header: '' }

const loadCookieHeader = () => {
  const file = sessionPath()
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    throw new Error('File sesi Bigo tidak ditemukan. Salin bigo-session.json ke server (lihat BIGO_SESSION_FILE di .env).')
  }
  if (cache.path === file && cache.mtimeMs === stat.mtimeMs) return cache.header
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    throw new Error('File sesi Bigo rusak (bukan JSON yang valid).')
  }
  const cookies = (Array.isArray(parsed?.cookies) ? parsed.cookies : []).filter((c) => !c.domain || /bigo/i.test(c.domain))
  if (!cookies.length) throw new Error('File sesi Bigo tidak berisi cookie Bigo.')
  const valid = cookies.every((c) => COOKIE_NAME.test(String(c.name || '')) && typeof c.value === 'string' && !/[\r\n;]/.test(c.value))
  if (!valid) throw new Error('File sesi Bigo berisi cookie yang tidak valid.')
  cache = { path: file, mtimeMs: stat.mtimeMs, header: cookies.map((c) => `${c.name}=${c.value}`).join('; ') }
  return cache.header
}

export const bigoSessionAvailable = () => {
  try {
    loadCookieHeader()
    return true
  } catch {
    return false
  }
}

export const resetBigoCache = () => {
  cache = { path: '', mtimeMs: 0, header: '' }
}

export const fetchBigoInfo = async (username) => {
  if (!USERNAME.test(String(username || ''))) throw new Error('Username Bigo tidak valid (2-40 karakter: huruf, angka, garis bawah).')
  const cookie = loadCookieHeader()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  let response
  try {
    response = await fetch(URL_STUDIO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: 'https://www.bigo.tv/',
        Accept: 'application/json, text/plain, */*',
        'User-Agent': USER_AGENT,
        Cookie: cookie
      },
      body: new URLSearchParams({ verify: '', isEncrypt: '0', siteId: username, mk: '', token: '', supportHevc: '0' }),
      signal: controller.signal
    })
  } catch (error) {
    throw new Error(error.name === 'AbortError' ? 'Bigo tidak merespons (timeout).' : 'Tidak dapat menghubungi Bigo.')
  } finally {
    clearTimeout(timer)
  }
  if (!response.ok) throw new Error(`Bigo menjawab HTTP ${response.status}.`)
  const body = await response.json().catch(() => null)
  const info = body?.data
  if (!info || typeof info !== 'object') throw new Error('Respons Bigo tidak dikenali (kemungkinan Bigo mengubah sistemnya).')
  return info
}

export const bigoChecker = async (account, previous) => {
  const info = await fetchBigoInfo(account.username)
  if (info.needLogin) throw new Error('Sesi login Bigo kedaluwarsa. Login ulang (login_bigo_manual.js), lalu salin bigo-session.json yang baru ke server.')
  if (info.alive !== 1) return { status: 'offline', live: null }
  return {
    status: 'live',
    live: { title: 'Live Bigo', startedAt: previous?.live?.startedAt || new Date().toISOString(), viewers: null, roomId: info.roomId ?? null, simulated: false }
  }
}
