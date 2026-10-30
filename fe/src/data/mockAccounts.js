const min = 60000
const ago = (m) => new Date(Date.now() - m * min).toISOString()

const rows = [
  ['tiktok', 'nadia.putri', 'Nadia Putri', 'live', 94, 'Bahas outfit minggu ini', 5400],
  ['tiktok', 'rizky_gadget', 'Rizky Gadget', 'live', 38, 'Unboxing headset murah', 12400],
  ['tiktok', 'dapur.mama.sari', 'Dapur Mama Sari', 'offline'],
  ['tiktok', 'bima.fit', 'Bima Fit', 'offline'],
  ['tiktok', 'laras.skincare', 'Laras Skincare', 'error'],
  ['tiktok', 'arkan.gaming', 'Arkan Gaming', 'disabled'],
  ['shopee', 'toko_batik_solo', 'Toko Batik Solo', 'live', 51, 'Flash sale batik tulis', 8200],
  ['shopee', 'gadgetmurah.id', 'Gadget Murah ID', 'offline'],
  ['shopee', 'sepatu.lokal', 'Sepatu Lokal', 'live', 17, 'Diskon sepatu kulit', 3100],
  ['shopee', 'kopi.nusantara', 'Kopi Nusantara', 'unknown'],
  ['youtube', 'WarungTekno', 'Warung Tekno', 'live', 126, 'Ngobrol santai soal laptop', 21800],
  ['youtube', 'CeritaMalam', 'Cerita Malam', 'offline'],
  ['youtube', 'BelajarCoding', 'Belajar Coding', 'offline'],
  ['youtube', 'RadioKampus', 'Radio Kampus', 'unknown'],
  ['youtube', 'MasakEnak', 'Masak Enak', 'disabled'],
  ['instagram', 'ayu.travel', 'Ayu Travel', 'offline'],
  ['instagram', 'fotografi.dimas', 'Dimas Fotografi', 'unknown'],
  ['instagram', 'tari.studio', 'Tari Studio', 'offline'],
  ['instagram', 'bengkel.motor.jaya', 'Bengkel Motor Jaya', 'disabled'],
  ['twitch', 'pixel_raka', 'Pixel Raka', 'live', 203, 'Speedrun santai', 640],
  ['twitch', 'senja_plays', 'Senja Plays', 'offline'],
  ['twitch', 'komar_stream', 'Komar Stream', 'offline'],
  ['twitch', 'gita.codes', 'Gita Codes', 'live', 66, 'Bangun bot Discord', 95],
  ['twitch', 'old_school_dewa', 'Old School Dewa', 'error']
]

const slug = { tiktok: 'tiktok.com/@', shopee: 'shopee.co.id/', youtube: 'youtube.com/@', instagram: 'instagram.com/', twitch: 'twitch.tv/' }

export const mockAccounts = rows.map((r, i) => ({
  id: `acc_${String(i + 1).padStart(3, '0')}`,
  platformId: r[0],
  username: r[1],
  displayName: r[2],
  profileUrl: `https://${slug[r[0]]}${r[1]}`,
  monitoringEnabled: r[3] !== 'disabled',
  useCustomCheckInterval: i === 0 || i === 10,
  customCheckIntervalSeconds: i === 0 ? 15 : i === 10 ? 20 : null,
  autoRecording: i % 4 === 0 ? true : null,
  notifyEnabled: null,
  notifyOnStart: null,
  notifyOnEnd: null,
  notes: ''
}))

export const mockRuntime = Object.fromEntries(
  rows.map((r, i) => {
    const id = mockAccounts[i].id
    const status = r[3]
    const lastStatus = status === 'disabled' ? 'offline' : status
    const base = {
      checking: false,
      lastStatus,
      lastChecked: ago(1 + (i % 6)),
      lastSuccess: status === 'error' ? ago(180 + i) : status === 'unknown' ? ago(900 + i * 7) : ago(1 + (i % 6)),
      lastError: status === 'error' ? 'Permintaan melewati batas waktu' : null,
      live: null
    }
    if (status === 'live') base.live = { title: r[5], startedAt: ago(r[4]), viewers: r[6], simulated: true }
    return [id, base]
  })
)

export const mockPlatformRuntime = {
  tiktok: { status: 'degraded', lastSuccess: ago(2), lastError: 'Rate limit tersimulasi pada 3 permintaan', retryCount: 2 },
  shopee: { status: 'online', lastSuccess: ago(1), lastError: null, retryCount: 0 },
  youtube: { status: 'online', lastSuccess: ago(1), lastError: null, retryCount: 0 },
  instagram: { status: 'offline', lastSuccess: ago(47), lastError: 'Service tersimulasi tidak merespons', retryCount: 3 },
  twitch: { status: 'online', lastSuccess: ago(1), lastError: null, retryCount: 0 }
}

export const mockActivities = [
  { id: 'a1', type: 'live_started', platformId: 'youtube', text: 'Warung Tekno mulai live', at: ago(126), level: 'info' },
  { id: 'a2', type: 'live_started', platformId: 'tiktok', text: 'Nadia Putri mulai live', at: ago(94), level: 'info' },
  { id: 'a3', type: 'service_failed', platformId: 'instagram', text: 'Service Instagram berhenti merespons', at: ago(47), level: 'error' },
  { id: 'a4', type: 'live_started', platformId: 'shopee', text: 'Toko Batik Solo mulai live', at: ago(51), level: 'info' },
  { id: 'a5', type: 'went_offline', platformId: 'twitch', text: 'Senja Plays selesai live', at: ago(33), level: 'info' },
  { id: 'a6', type: 'service_degraded', platformId: 'tiktok', text: 'Service TikTok melambat, mencoba ulang', at: ago(12), level: 'warn' },
  { id: 'a7', type: 'recording_failed', platformId: 'tiktok', text: 'Rekaman Laras Skincare gagal dimulai', at: ago(9), level: 'error' },
  { id: 'a8', type: 'config_updated', platformId: null, text: 'Interval TikTok diubah menjadi 30 dtk', at: ago(180), level: 'info' }
]
