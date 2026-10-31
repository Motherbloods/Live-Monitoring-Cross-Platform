import * as cheerio from 'cheerio'
import { fetchPageHtml } from './browser.js'

const USERNAME = /^[A-Za-z0-9._]{2,24}$/

let pageFetcher = (username) => fetchPageHtml(`https://www.tiktok.com/@${username}/live`, { selector: '#SIGI_STATE' })

export const setPageFetcher = (fn) => {
  pageFetcher = fn
}

export const parseTiktokLive = (html) => {
  const raw = cheerio.load(html)('#SIGI_STATE').html()
  if (!raw) throw new Error('Data halaman TikTok tidak ditemukan (kemungkinan diblokir atau halaman berubah).')
  let state
  try {
    state = JSON.parse(raw)
  } catch {
    throw new Error('Data halaman TikTok tidak bisa dibaca.')
  }
  if (!state || typeof state.LiveRoom !== 'object' || state.LiveRoom === null) {
    throw new Error('Struktur data TikTok tidak dikenali.')
  }
  const room = state.LiveRoom.liveRoomUserInfo?.liveRoom
  if (!room || typeof room.status !== 'number') return { state: 'offline', live: null }
  if (room.status !== 2) return { state: 'offline', live: null }
  const viewers = room.liveRoomStats?.userCount ?? room.userCount
  return {
    state: 'live',
    live: {
      title: typeof room.title === 'string' && room.title.trim() ? room.title.trim() : 'Live TikTok',
      startedAt: Number(room.startTime) > 0 ? new Date(Number(room.startTime) * 1000).toISOString() : null,
      viewers: Number.isFinite(Number(viewers)) ? Number(viewers) : null,
      simulated: false
    }
  }
}

export const tiktokChecker = async (account, previous) => {
  if (!USERNAME.test(account.username)) throw new Error('Username TikTok tidak valid.')
  let html = await pageFetcher(account.username)
  if (!html.includes('SIGI_STATE')) html = await pageFetcher(account.username)
  const result = parseTiktokLive(html)
  if (result.state === 'offline') return { status: 'offline', live: null }
  return {
    status: 'live',
    live: { ...result.live, startedAt: result.live.startedAt || previous?.live?.startedAt || new Date().toISOString() }
  }
}
