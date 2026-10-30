const at = (m) => new Date(Date.now() - m * 60000).toISOString()

export const mockLogs = [
  { id: 'l1', platformId: 'tiktok', level: 'WARN', message: 'Respons lambat, mencoba ulang (2 dari 3)', at: at(3) },
  { id: 'l2', platformId: 'tiktok', level: 'ERROR', message: 'Rate limit tersimulasi pada 3 permintaan', at: at(5) },
  { id: 'l3', platformId: 'tiktok', level: 'INFO', message: 'Pemeriksaan 6 akun selesai', at: at(8) },
  { id: 'l4', platformId: 'shopee', level: 'INFO', message: 'Pemeriksaan 4 akun selesai', at: at(2) },
  { id: 'l5', platformId: 'shopee', level: 'INFO', message: 'Toko Batik Solo terdeteksi live', at: at(52) },
  { id: 'l6', platformId: 'youtube', level: 'INFO', message: 'Pemeriksaan 5 akun selesai', at: at(2) },
  { id: 'l7', platformId: 'youtube', level: 'INFO', message: 'Warung Tekno terdeteksi live', at: at(127) },
  { id: 'l8', platformId: 'instagram', level: 'ERROR', message: 'Service tidak merespons setelah 3 percobaan', at: at(47) },
  { id: 'l9', platformId: 'instagram', level: 'WARN', message: 'Timeout permintaan (15000 ms)', at: at(49) },
  { id: 'l10', platformId: 'instagram', level: 'INFO', message: 'Pemeriksaan 4 akun selesai', at: at(55) },
  { id: 'l11', platformId: 'twitch', level: 'INFO', message: 'Pemeriksaan 4 akun selesai', at: at(1) },
  { id: 'l12', platformId: 'twitch', level: 'INFO', message: 'Senja Plays selesai live', at: at(33) }
]
