import { LIMITS, PLATFORMS } from '../config/defaults.js'

export const usernameFromUrl = (url, platformId) => {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    if (platformId === 'youtube') {
      if (parts[0] === 'channel') return parts[1] || ''
      return parts[0]?.startsWith('@') ? parts[0].slice(1) : ''
    }
    return (parts[0] || '').replace(/^@/, '')
  } catch {
    return ''
  }
}

export const validateAccount = (form, accounts, editingId = null) => {
  const errors = {}
  const platform = PLATFORMS.find((p) => p.id === form.platformId)
  const url = form.profileUrl.trim()
  const username = (form.username.trim() || usernameFromUrl(url, form.platformId)).replace(/^@/, '')

  if (!platform) errors.platformId = 'Pilih platform.'
  if (!url && !form.username.trim()) errors.username = 'Isi username atau profile URL.'
  if (form.username.trim() && !/^[A-Za-z0-9._-]{2,40}$/.test(form.username.trim().replace(/^@/, ''))) {
    errors.username = 'Username 2–40 karakter: huruf, angka, titik, garis bawah, atau strip.'
  }
  if (url) {
    try {
      const host = new URL(url).hostname
      if (platform && !host.includes(platform.hostHint)) errors.profileUrl = `URL harus berasal dari ${platform.hostHint}.`
    } catch {
      errors.profileUrl = 'Format URL tidak valid. Contoh: https://...'
    }
  }
  const shown = form.username.trim().replace(/^@/, '') || username
  if (!errors.username && shown) {
    if (form.platformId === 'twitch' && !/^[A-Za-z0-9_]{4,25}$/.test(shown)) errors.username = 'Username Twitch 4–25 karakter: huruf, angka, atau garis bawah.'
    if (form.platformId === 'youtube' && !/^(UC[A-Za-z0-9_-]{22}|[A-Za-z0-9._-]{3,30})$/.test(shown)) errors.username = 'Username YouTube: handle 3–30 karakter, atau ID channel yang diawali UC.'
    if (form.platformId === 'bigo' && !/^[A-Za-z0-9_]{2,40}$/.test(shown)) errors.username = 'Username Bigo 2–40 karakter: huruf, angka, atau garis bawah.'
    if (form.platformId === 'tiktok' && !/^[A-Za-z0-9._]{2,24}$/.test(shown)) errors.username = 'Username TikTok 2–24 karakter: huruf, angka, titik, atau garis bawah.'
  }
  if (form.useCustomCheckInterval) {
    const n = Number(form.customCheckIntervalSeconds)
    const { min, max } = LIMITS.interval
    if (!Number.isFinite(n) || n < min || n > max) errors.customCheckIntervalSeconds = `Isi angka antara ${min} dan ${max} detik.`
  }
  const duplicate = accounts.some((a) => a.id !== editingId && a.platformId === form.platformId && a.username.toLowerCase() === username.toLowerCase())
  if (!errors.username && duplicate) errors.username = 'Akun ini sudah ada di platform tersebut.'
  return { errors, username }
}
