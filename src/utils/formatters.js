export const ago = (iso, now = Date.now()) => {
  if (!iso) return 'Belum pernah'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s} dtk lalu`
  if (s < 3600) return `${Math.round(s / 60)} mnt lalu`
  if (s < 86400) return `${Math.round(s / 3600)} jam lalu`
  return `${Math.round(s / 86400)} hari lalu`
}

export const duration = (fromIso, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - new Date(fromIso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}j ${m}m` : `${m}m`
}

let activeTimezone = 'Asia/Jakarta'

export const setTimezone = (tz) => {
  activeTimezone = tz
}

export const clock = (iso) => new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: activeTimezone })

export const interval = (sec) => (sec >= 120 && sec % 60 === 0 ? `${sec / 60} mnt` : `${sec} dtk`)

export const compact = (n) => new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(n)
