import { mockAccounts } from './mockAccounts.js'

const ago = (m) => new Date(Date.now() - m * 60000).toISOString()
const who = (id) => mockAccounts.find((a) => a.id === id)

const rows = [
  ['acc_001', 'recording', 94, 94, 0, 'nadia.putri'],
  ['acc_009', 'recording', 17, 17, 0, 'sepatu.lokal'],
  ['acc_005', 'failed', 190, 0, 0, 'laras.skincare'],
  ['acc_013', 'completed', 360, 58, 412, 'BelajarCoding'],
  ['acc_017', 'completed', 520, 40, 301, 'fotografi.dimas'],
  ['acc_021', 'completed', 700, 85, 640, 'senja_plays'],
  ['acc_001', 'completed', 1800, 140, 1180, 'nadia.putri'],
  ['acc_011', 'queued', 2, 0, 0, 'WarungTekno'],
  ['acc_005', 'cancelled', 900, 3, 11, 'laras.skincare'],
  ['acc_009', 'completed', 1300, 30, 220, 'sepatu.lokal']
]

export const mockRecordings = rows.map(([accountId, status, startedMinAgo, minutes, sizeMb, slug], i) => {
  const a = who(accountId)
  return {
    id: `rec_${i + 1}`,
    accountId,
    displayName: a.displayName,
    platformId: a.platformId,
    status,
    startedAt: ago(startedMinAgo),
    durationMinutes: minutes,
    sizeMb,
    file: status === 'completed' || status === 'cancelled' ? `${a.platformId}/${slug}/sesi-${i + 1}.ts` : null
  }
})
