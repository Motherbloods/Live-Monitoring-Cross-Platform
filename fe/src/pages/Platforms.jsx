import { Link } from 'react-router-dom'
import { Pause, Play, ScanSearch } from 'lucide-react'
import { useAppStore } from '../store/appStore.js'
import { PLATFORMS } from '../config/defaults.js'
import { getGlobalStatus, getPlatformSummary, getServiceStatus } from '../utils/effectiveConfig.js'
import { ago, interval } from '../utils/formatters.js'
import StatusBadge from '../components/common/StatusBadge.jsx'

const GLOBAL_LABEL = { running: 'Running', partial: 'Partially running', stopped: 'Stopped', starting: 'Starting' }

export default function Platforms() {
  const { accounts, runtime, platformRuntime, config, busy, toggleGlobalMonitoring, checkAllEnabled } = useAppStore()
  const global = getGlobalStatus(config, platformRuntime)
  const enabled = config.global.globalMonitoringEnabled

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Platforms</h1>
          <p>Setiap platform punya service, konfigurasi, dan log sendiri.</p>
        </div>
      </header>

      <section className="gm" aria-label="Kontrol monitoring global">
        <div>
          <span className={`gm-state tone-${global}`}>{GLOBAL_LABEL[global]}</span>
          <p>
            {enabled
              ? 'Akun yang memenuhi syarat diperiksa otomatis sesuai intervalnya.'
              : 'Pemeriksaan otomatis dijeda. Status terakhir yang tampil belum tentu aktual.'}
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={toggleGlobalMonitoring}>
            {enabled ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
            {enabled ? 'Pause monitoring' : 'Resume monitoring'}
          </button>
          <button className="btn btn-primary" onClick={checkAllEnabled} disabled={busy.checkAll || !enabled}>
            <ScanSearch size={15} aria-hidden /> {busy.checkAll ? 'Checking…' : 'Check all enabled accounts'}
          </button>
        </div>
      </section>

      <ul className="plist">
        {PLATFORMS.map((p) => {
          const pc = config.platforms[p.id]
          const rt = platformRuntime[p.id]
          const sum = getPlatformSummary(p.id, accounts, runtime, platformRuntime, config)
          const eff = pc.checkIntervalSeconds || config.global.defaultCheckIntervalSeconds
          const schedulable = enabled && pc.serviceEnabled && pc.monitoringEnabled && rt.status !== 'offline' && sum.eligible > 0
          return (
            <li key={p.id} style={{ '--accent': p.color }} className={!pc.serviceEnabled ? 'is-dim' : ''}>
              <span className="svc-mark" aria-hidden />
              <div className="p-main">
                <div className="svc-top">
                  <strong>{p.name}</strong>
                  <StatusBadge status={getServiceStatus(p.id, platformRuntime, config)} />
                  {!pc.monitoringEnabled && pc.serviceEnabled && <span className="badge">Monitoring platform off</span>}
                </div>
                <p className="svc-meta">
                  Sukses terakhir {ago(rt.lastSuccess)} · Jadwal berikutnya: {schedulable ? `tiap ${interval(eff)} (simulasi)` : '—'}
                </p>
                {rt.lastError && <p className="svc-meta svc-err">{rt.lastError}</p>}
              </div>
              <dl className="p-nums">
                <div><dt>Akun</dt><dd>{sum.total}</dd></div>
                <div><dt>Aktif</dt><dd>{sum.enabled}</dd></div>
                <div><dt>Live</dt><dd>{sum.live}</dd></div>
                <div><dt>Unknown</dt><dd>{sum.unable}</dd></div>
                <div><dt>Interval</dt><dd>{interval(eff)}</dd></div>
              </dl>
              <Link className="btn btn-small" to={`/platforms/${p.id}`}>View details</Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
