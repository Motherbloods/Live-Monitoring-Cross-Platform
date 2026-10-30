import { mockAccounts } from './mockAccounts.js'

const rows = [
  ['acc_001', 5, 94, 'ended'], ['acc_001', 30, 140, 'ended'], ['acc_001', 52, 75, 'interrupted'],
  ['acc_002', 7, 38, 'ended'], ['acc_002', 28, 210, 'ended'],
  ['acc_003', 20, 65, 'ended'], ['acc_003', 70, 180, 'ended'],
  ['acc_004', 33, 25, 'ended'], ['acc_007', 6, 51, 'ended'], ['acc_007', 54, 120, 'ended'],
  ['acc_008', 26, 45, 'ended'], ['acc_009', 9, 17, 'ended'], ['acc_011', 4, 126, 'ended'],
  ['acc_011', 47, 300, 'ended'], ['acc_012', 31, 90, 'ended'], ['acc_013', 52, 58, 'ended'],
  ['acc_016', 18, 40, 'interrupted'], ['acc_018', 44, 33, 'ended'], ['acc_020', 8, 203, 'ended'],
  ['acc_020', 35, 150, 'ended'], ['acc_021', 12, 85, 'ended'], ['acc_023', 6, 66, 'ended'],
  ['acc_023', 60, 240, 'ended']
]

export const mockHistory = rows.map(([accountId, hoursAgo, minutes, status], i) => {
  const a = mockAccounts.find((x) => x.id === accountId)
  const endAt = Date.now() - (hoursAgo * 60 - minutes) * 60000 + 0
  const startAt = Date.now() - hoursAgo * 60 * 60000
  return {
    id: `h${i + 1}`,
    accountId,
    displayName: a.displayName,
    username: a.username,
    platformId: a.platformId,
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(Math.min(endAt, Date.now() - 60000)).toISOString(),
    status,
    url: a.profileUrl
  }
})
