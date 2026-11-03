import { tiktokChecker } from './tiktok.js'
import { twitchChecker } from './twitch.js'
import { youtubeChecker } from './youtube.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const dummyChecker = async (account, previous) => {
  await sleep(200 + Math.random() * 400)
  if (Math.random() < 0.08) throw new Error('Pemeriksaan tersimulasi gagal')
  const stayLive = previous?.lastStatus === 'live' && Math.random() < 0.85
  const goLive = previous?.lastStatus !== 'live' && Math.random() < 0.15
  if (stayLive || goLive) {
    return { status: 'live', live: previous?.live || { title: 'Sesi live contoh', startedAt: new Date().toISOString(), viewers: Math.round(30 + Math.random() * 800), simulated: true } }
  }
  return { status: 'offline', live: null }
}

const youtube = (account, previous) => (process.env.YOUTUBE_CHECKER === 'dummy' ? dummyChecker(account, previous) : youtubeChecker(account, previous))

const twitch = (account, previous) => (process.env.TWITCH_CHECKER === 'dummy' ? dummyChecker(account, previous) : twitchChecker(account, previous))

const tiktok = (account, previous) => (process.env.TIKTOK_CHECKER === 'dummy' ? dummyChecker(account, previous) : tiktokChecker(account, previous))

export const checkerModes = () => ({ tiktok: process.env.TIKTOK_CHECKER === 'dummy' ? 'dummy' : 'real', shopee: 'dummy', youtube: process.env.YOUTUBE_CHECKER === 'dummy' ? 'dummy' : 'real', instagram: 'dummy', twitch: process.env.TWITCH_CHECKER === 'dummy' ? 'dummy' : 'real' })

export const checkers = {
  tiktok,
  shopee: dummyChecker,
  youtube,
  instagram: dummyChecker,
  twitch
}
