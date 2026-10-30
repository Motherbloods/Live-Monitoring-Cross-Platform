import { PLATFORMS } from '../../config/defaults.js'
import { useAppStore } from '../../store/appStore.js'
import { dateTime, minutes } from '../../utils/formatters.js'

const LABEL = { queued: 'Queued', recording: 'Recording', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled' }
const TONE = { queued: 'checking', recording: 'live', completed: 'online', failed: 'error', cancelled: 'disabled' }

export default function RecordingTable({ rows }) {
  const setRecordingStatus = useAppStore((s) => s.setRecordingStatus)
  return (
    <div className="atable drow-table" style={{ '--cols': 'minmax(180px,1.4fr) 110px 120px 80px 80px minmax(150px,1.2fr) 110px' }}>
      <div className="drow ahead"><span>Account</span><span>Status</span><span>Mulai</span><span>Durasi</span><span>Ukuran</span><span>Output</span><span className="right">Actions</span></div>
      {rows.map((r) => {
        const p = PLATFORMS.find((x) => x.id === r.platformId)
        return (
          <div className="drow" key={r.id} style={{ '--accent': p.color }}>
            <div className="acell acct" data-label="Account"><span className="svc-mark" aria-hidden /><div><strong>{r.displayName}</strong><small>{p.short}</small></div></div>
            <div className="acell" data-label="Status"><span className={`badge badge-${TONE[r.status]}`}>{LABEL[r.status]}</span></div>
            <div className="acell" data-label="Mulai">{dateTime(r.startedAt)}</div>
            <div className="acell" data-label="Durasi">{r.durationMinutes ? minutes(r.durationMinutes) : '—'}</div>
            <div className="acell" data-label="Ukuran">{r.sizeMb ? `${r.sizeMb} MB` : '—'}</div>
            <div className="acell" data-label="Output">{r.file ? <><span className="file">{r.file}</span><small>data contoh, bukan file nyata</small></> : '—'}</div>
            <div className="acell right" data-label="Actions">
              {(r.status === 'queued' || r.status === 'recording') && <button className="btn btn-small" onClick={() => setRecordingStatus(r.id, 'cancelled')}>Cancel</button>}
              {r.status === 'failed' && <button className="btn btn-small" onClick={() => setRecordingStatus(r.id, 'queued')}>Retry</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
