import { getState, persist } from '../store/db.js'
import { notifySubscriber } from './subscriberNotifier.js'
import { pauseIfUnfollowed } from './subscription.js'

const DAY = 86400000
let timer = null

const dateText = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: getState().config.global.timezone })

export const sweep = (now = Date.now()) => {
  let changed = false
  for (const sub of getState().subscribers) {
    if (sub.status !== 'active') continue
    const expires = new Date(sub.expiresAt).getTime()
    if (expires <= now) {
      if (sub.expiredNoticeFor !== sub.expiresAt) {
        sub.expiredNoticeFor = sub.expiresAt
        sub.selections.forEach((x) => pauseIfUnfollowed(x.accountId))
        notifySubscriber(sub, 'Langganan Anda sudah berakhir dan notifikasi dihentikan. Daftar akun Anda tetap tersimpan. Kirim kode baru ke chat ini untuk mengaktifkannya lagi.')
        changed = true
      }
    } else if (expires - now <= 3 * DAY && sub.reminderFor !== sub.expiresAt && now - new Date(sub.lastRenewedAt || sub.createdAt).getTime() >= 12 * 3600000) {
      sub.reminderFor = sub.expiresAt
      const left = Math.ceil((expires - now) / DAY)
      notifySubscriber(sub, `Langganan Anda berakhir ${dateText(sub.expiresAt)} (${left} hari lagi). Untuk memperpanjang, kirim kode baru ke chat ini.`)
      changed = true
    }
  }
  if (changed) persist()
  return changed
}

export const startSubscriptionJobs = () => {
  sweep()
  timer = setInterval(() => sweep(), 10 * 60 * 1000)
  timer.unref?.()
}

export const stopSubscriptionJobs = () => clearInterval(timer)
