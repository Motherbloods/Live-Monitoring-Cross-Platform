import { useAppStore } from '../store/appStore.js'
import { resolveAccountRecording } from '../utils/effectiveConfig.js'
import { Film } from 'lucide-react'
import RecordingTable from '../components/recordings/RecordingTable.jsx'
import RecordingSettingsForm from '../components/recordings/RecordingSettingsForm.jsx'

export default function Recordings() {
  const { recordings, accounts, config } = useAppStore()
  const count = (s) => recordings.filter((r) => r.status === s).length
  const auto = accounts.filter((a) => resolveAccountRecording(a, config).autoRecording).length

  const items = [
    ['Total recordings', recordings.length, 'data contoh'],
    ['Currently recording', count('recording'), 'simulasi'],
    ['Completed', count('completed'), ''],
    ['Failed', count('failed'), ''],
    ['Akun auto recording', auto, 'efektif']
  ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Recordings</h1>
          <p>Persiapan antarmuka perekaman otomatis. Belum ada perekaman sungguhan yang berjalan.</p>
        </div>
      </header>

      <section className="stats" aria-label="Statistik rekaman">
        {items.map(([label, value, note]) => (
          <div key={label} className="stat">
            <span className="stat-value">{value}</span>
            <span className="stat-label">{label}</span>
            <small>{note || '\u00a0'}</small>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head"><h3>Daftar rekaman</h3></div>
        {recordings.length ? <RecordingTable rows={recordings} /> : (
          <div className="empty">
            <Film size={22} aria-hidden />
            <strong>Belum ada rekaman</strong>
            <p>Rekaman akan muncul di sini setelah fitur perekaman di server dikerjakan.</p>
          </div>
        )}
      </section>

      <section className="section">
        <RecordingSettingsForm />
      </section>
    </div>
  )
}
