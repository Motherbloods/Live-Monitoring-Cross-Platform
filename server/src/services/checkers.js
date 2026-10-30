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

export const checkers = {
  tiktok: dummyChecker,
  shopee: dummyChecker,
  youtube: dummyChecker,
  instagram: dummyChecker,
  twitch: dummyChecker
}
