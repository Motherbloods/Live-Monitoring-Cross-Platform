import { useMemo, useState } from 'react'
import { ExternalLink, History } from 'lucide-react'
import { useAppStore } from '../store/appStore.js'
import { PLATFORMS } from '../config/defaults.js'
import { dateTime, minutes } from '../utils/formatters.js'

const mins = (h) => Math.round((new Date(h.endAt) - new Date(h.startAt)) / 60000)
const RANGES = { all: [0, Infinity], short: [0, 30], mid: [30, 120], long: [120, Infinity] }

export default function LiveHistory() {
  const history = useAppStore((s) => s.history)
  const [platform, setPlatform] = useState('all')
  const [account, setAccount] = useState('all')
  const [status, setStatus] = useState('all')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const people = useMemo(() => [...new Map(history.map((h) => [h.accountId, h.displayName])).entries()], [history])

  const rows = useMemo(() => {
    const [lo, hi] = RANGES[range]
    return history
      .filter((h) => {
        const m = mins(h)
        if (platform !== 'all' && h.platformId !== platform) return false
        if (account !== 'all' && h.accountId !== account) return false
        if (status !== 'all' && h.status !== status) return false
        if (m < lo || m >= hi) return false
        if (from && new Date(h.startAt) < new Date(`${from}T00:00:00`)) return false
        if (to && new Date(h.startAt) > new Date(`${to}T23:59:59`)) return false
        return true
      })
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt))
  }, [history, platform, account, status, range, from, to])

  const total = rows.reduce((n, h) => n + mins(h), 0)
  const longest = rows.reduce((m, h) => Math.max(m, mins(h)), 0)
  const byPlatform = rows.reduce((acc, h) => ({ ...acc, [h.platformId]: (acc[h.platformId] || 0) + 1 }), {})
  const top = Object.entries(byPlatform).sort((a, b) => b[1] - a[1])[0]

  const items = [
    ['Total sessions', rows.length],
    ['Total live duration', minutes(total)],
    ['Longest session', rows.length ? minutes(longest) : '—'],
    ['Most active platform', top ? PLATFORMS.find((p) => p.id === top[0]).short : '—']
  ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Live history</h1>
          <p>Riwayat sesi live. Tetap tersimpan walau monitoring akun dimatikan atau akunnya dihapus. Data contoh.</p>
        </div>
      </header>

      <section className="stats stats-4" aria-label="Ringkasan">
        {items.map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
            <small>sesuai filter</small>
          </div>
        ))}
      </section>

      <div className="filters">
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
          <option value="all">All platforms</option>
          {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
        </select>
        <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Akun">
          <option value="all">Semua akun</option>
          {people.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Durasi">
          <option value="all">Semua durasi</option>
          <option value="short">Kurang dari 30 mnt</option>
          <option value="mid">30 mnt – 2 jam</option>
          <option value="long">Lebih dari 2 jam</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status akhir">
          <option value="all">Semua status</option>
          <option value="ended">Ended</option>
          <option value="interrupted">Interrupted</option>
        </select>
        <input type="date" className="date-input" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
        <input type="date" className="date-input" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
      </div>

      {rows.length ? (
        <div className="atable" style={{ '--cols': 'minmax(180px,1.5fr) 130px 130px 90px 110px 90px' }}>
          <div className="drow ahead"><span>Account</span><span>Mulai</span><span>Selesai</span><span>Durasi</span><span>Status akhir</span><span className="right">Live URL</span></div>
          {rows.map((h) => {
            const p = PLATFORMS.find((x) => x.id === h.platformId)
            return (
              <div className="drow" key={h.id} style={{ '--accent': p.color }}>
                <div className="acell acct" data-label="Account"><span className="svc-mark" aria-hidden /><div><strong>{h.displayName}</strong><small>@{h.username} · {p.short}</small></div></div>
                <div className="acell" data-label="Mulai">{dateTime(h.startAt)}</div>
                <div className="acell" data-label="Selesai">{dateTime(h.endAt)}</div>
                <div className="acell" data-label="Durasi">{minutes(mins(h))}</div>
                <div className="acell" data-label="Status akhir"><span className={`badge ${h.status === 'ended' ? '' : 'badge-degraded'}`}>{h.status === 'ended' ? 'Ended' : 'Interrupted'}</span></div>
                <div className="acell right" data-label="Live URL"><a className="icon-btn" href={h.url} target="_blank" rel="noreferrer" aria-label={`Buka profil ${h.displayName}`}><ExternalLink size={15} /></a></div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <History size={22} aria-hidden />
          <strong>Tidak ada sesi yang cocok</strong>
          <p>Ubah filter untuk melihat sesi lain.</p>
        </div>
      )}
    </div>
  )
}
