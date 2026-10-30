import { LIMITS, PLATFORMS } from '../config/defaults.js'

export const usernameFromUrl = (url) => {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return (parts[0] || '').replace(/^@/, '')
  } catch {
    return ''
  }
}

export const validateAccount = (form, accounts, editingId = null) => {
  const errors = {}
  const platform = PLATFORMS.find((p) => p.id === form.platformId)
  const url = form.profileUrl.trim()
  const username = (form.username.trim() || usernameFromUrl(url)).replace(/^@/, '')

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
  if (form.useCustomCheckInterval) {
    const n = Number(form.customCheckIntervalSeconds)
    const { min, max } = LIMITS.interval
    if (!Number.isFinite(n) || n < min || n > max) errors.customCheckIntervalSeconds = `Isi angka antara ${min} dan ${max} detik.`
  }
  const duplicate = accounts.some((a) => a.id !== editingId && a.platformId === form.platformId && a.username.toLowerCase() === username.toLowerCase())
  if (!errors.username && duplicate) errors.username = 'Akun ini sudah ada di platform tersebut.'
  return { errors, username }
}
