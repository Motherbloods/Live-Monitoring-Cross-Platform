import { useState } from 'react'
import { useAppStore } from '../../store/appStore.js'
import { clock } from '../../utils/formatters.js'

export default function ServiceLogs({ platformId }) {
  const logs = useAppStore((s) => s.logs)
  const [level, setLevel] = useState('all')
  const [q, setQ] = useState('')
  const list = logs.filter((l) => l.platformId === platformId && (level === 'all' || l.level === level) && l.message.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div>
      <div className="filters">
        <input className="log-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari log" aria-label="Cari log" />
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Level log">
          <option value="all">Semua level</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
      </div>
      {list.length ? (
        <ul className="logs">
          {list.map((l) => (
            <li key={l.id}>
              <time>{clock(l.at)}</time>
              <span className={`lv lv-${l.level}`}>{l.level}</span>
              <span>{l.message}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note">Tidak ada log yang cocok.</p>
      )}
    </div>
  )
}
