import fs from 'node:fs'
import path from 'node:path'
import { fetchPageResponse } from './browser.js'

const USERNAME = /^[A-Za-z0-9_]{2,40}$/
const COOKIE_NAME = /^[\w!#$%&'*+.^`|~-]+$/

const sessionPath = () => path.resolve(process.env.BIGO_SESSION_FILE || 'data/bigo-session.json')

let cache = { path: '', mtimeMs: 0, cookies: [] }

const toBrowserCookie = (c) => {
  const cookie = { name: c.name, value: c.value, domain: c.domain || '.bigo.tv', path: c.path || '/' }
  const expires = c.expires ?? c.expirationDate
  if (typeof expires === 'number' && expires > 0) cookie.expires = expires
  if (typeof c.httpOnly === 'boolean') cookie.httpOnly = c.httpOnly
  if (typeof c.secure === 'boolean') cookie.secure = c.secure
  const sameSite = String(c.sameSite || '').toLowerCase()
  if (sameSite === 'strict') cookie.sameSite = 'Strict'
  else if (sameSite === 'lax') cookie.sameSite = 'Lax'
  else if (sameSite === 'none' || sameSite === 'no_restriction') {
    cookie.sameSite = 'None'
    cookie.secure = true
  }
  return cookie
}

const loadCookies = () => {
  const file = sessionPath()
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    throw new Error('File sesi Bigo tidak ditemukan. Salin bigo-session.json ke server (lihat BIGO_SESSION_FILE di .env).')
  }
  if (cache.path === file && cache.mtimeMs === stat.mtimeMs) return cache.cookies
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
  cache = { path: file, mtimeMs: stat.mtimeMs, cookies: cookies.map(toBrowserCookie) }
  return cache.cookies
}

export const bigoSessionAvailable = () => {
  try {
    loadCookies()
    return true
  } catch {
    return false
  }
}

export const resetBigoCache = () => {
  cache = { path: '', mtimeMs: 0, cookies: [] }
}

let studioFetcher = (username, cookies) => fetchPageResponse(`https://www.bigo.tv/${username}`, { urlIncludes: 'getInternalStudioInfo', cookies })

export const setBigoFetcher = (fn) => {
  studioFetcher = fn
}

export const fetchBigoInfo = async (username) => {
  if (!USERNAME.test(String(username || ''))) throw new Error('Username Bigo tidak valid (2-40 karakter: huruf, angka, garis bawah).')
  const cookies = loadCookies()
  let result
  try {
    result = await studioFetcher(username, cookies)
  } catch (error) {
    if (error?.name === 'TimeoutError') throw new Error('Bigo tidak merespons (timeout).')
    if (/belum terpasang/.test(String(error?.message))) throw error
    throw new Error('Tidak dapat menghubungi Bigo.')
  }
  if (result?.status && (result.status < 200 || result.status >= 300)) throw new Error(`Bigo menjawab HTTP ${result.status}.`)
  const info = result?.body?.data
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
