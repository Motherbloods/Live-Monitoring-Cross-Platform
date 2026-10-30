import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Power, RotateCw, ScanSearch } from 'lucide-react'
import { useAppStore } from '../store/appStore.js'
import { PLATFORMS } from '../config/defaults.js'
import { getDisplayStatus, getEligibility, getPlatformSummary, getServiceStatus, resolveEffectiveConfig } from '../utils/effectiveConfig.js'
import { ago, interval } from '../utils/formatters.js'
import StatusBadge from '../components/common/StatusBadge.jsx'
import ServiceConfigurationForm from '../components/platforms/ServiceConfigurationForm.jsx'
import ServiceLogs from '../components/platforms/ServiceLogs.jsx'

export default function PlatformDetails() {
  const { platformId } = useParams()
  const { accounts, runtime, platformRuntime, config, setServiceEnabled, restartPlatform, checkPlatform } = useAppStore()
  const [busy, setBusy] = useState('')
  const platform = PLATFORMS.find((p) => p.id === platformId)

  if (!platform) {
    return (
      <div className="page">
        <div className="empty">
          <strong>Platform tidak ditemukan</strong>
          <Link className="btn btn-small" to="/platforms">Kembali ke Platforms</Link>
        </div>
      </div>
    )
  }

  const pc = config.platforms[platformId]
  const rt = platformRuntime[platformId]
  const sum = getPlatformSummary(platformId, accounts, runtime, platformRuntime, config)
  const own = accounts.filter((a) => a.platformId === platformId)
  const eff = pc.checkIntervalSeconds || config.global.defaultCheckIntervalSeconds
  const schedulable = config.global.globalMonitoringEnabled && pc.serviceEnabled && pc.monitoringEnabled && rt.status !== 'offline' && sum.eligible > 0

  const run = (name, fn) => async () => {
    setBusy(name)
    await fn()
    setBusy('')
  }

  return (
    <div className="page" style={{ '--accent': platform.color }}>
      <Link to="/platforms" className="back"><ArrowLeft size={14} aria-hidden /> Platforms</Link>
      <header className="page-head">
        <div className="detail-title">
          <span className="svc-mark tall" aria-hidden />
          <div>
            <h1>{platform.name}</h1>
            <StatusBadge status={getServiceStatus(platformId, platformRuntime, config)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={run('check', () => checkPlatform(platformId))} disabled={!!busy || !pc.serviceEnabled}>
            <ScanSearch size={15} aria-hidden /> {busy === 'check' ? 'Checking…' : 'Check now'}
          </button>
          <button className="btn" onClick={run('restart', () => restartPlatform(platformId))} disabled={!!busy || !pc.serviceEnabled}>
            <RotateCw size={15} className={busy === 'restart' ? 'spin' : ''} aria-hidden /> {busy === 'restart' ? 'Restarting…' : 'Restart service'}
          </button>
          <button className={`btn ${pc.serviceEnabled ? '' : 'btn-primary'}`} onClick={run('toggle', () => setServiceEnabled(platformId, !pc.serviceEnabled))} disabled={!!busy}>
            <Power size={15} aria-hidden /> {pc.serviceEnabled ? 'Disable service' : 'Enable service'}
          </button>
        </div>
      </header>

      {!pc.serviceEnabled && <p className="note">Service dinonaktifkan. Akun dan konfigurasi tetap tersimpan, tetapi tidak diperiksa dan statusnya ditampilkan Unknown.</p>}
      {pc.serviceEnabled && rt.status === 'offline' && <p className="note">Service offline. Status akun platform ini tidak bisa diperbarui dan ditampilkan Unknown, bukan Offline.</p>}

      <div className="two-col">
        <div>
          <section className="section">
            <div className="section-head"><h3>Service status</h3></div>
            <dl className="health">
              <div><dt>Status saat ini</dt><dd>{{ online: 'Online', degraded: 'Degraded', offline: 'Offline', starting: 'Starting' }[rt.status]}{!pc.serviceEnabled && ' (disabled)'}</dd></div>
              <div><dt>Monitoring platform</dt><dd>{pc.monitoringEnabled ? 'Enabled' : 'Disabled'}</dd></div>
              <div><dt>Sukses terakhir</dt><dd>{ago(rt.lastSuccess)}</dd></div>
              <div><dt>Error terakhir</dt><dd>{rt.lastError || '—'}</dd></div>
              <div><dt>Retry count</dt><dd>{rt.retryCount}</dd></div>
              <div><dt>Jadwal berikutnya</dt><dd>{schedulable ? `tiap ${interval(eff)} (simulasi)` : '—'}</dd></div>
              <div><dt>Akun memenuhi syarat</dt><dd>{sum.eligible} dari {sum.total}</dd></div>
            </dl>
          </section>

          <section className="section">
            <div className="section-head"><h3>Service configuration</h3></div>
            <ServiceConfigurationForm key={JSON.stringify(pc)} platformId={platformId} />
          </section>
        </div>

        <div>
          <section className="section">
            <div className="section-head">
              <h3>Accounts</h3>
              <Link className="btn btn-small" to={`/accounts?new=1&platform=${platformId}`}><Plus size={13} aria-hidden /> Add account</Link>
            </div>
            {own.length ? (
              <ul className="mini-list">
                {own.map((a) => (
                  <li key={a.id}>
                    <div>
                      <strong>{a.displayName}</strong>
                      <small>@{a.username} · {interval(resolveEffectiveConfig(a, config).checkIntervalSeconds)}{!getEligibility(a, config).eligible && a.monitoringEnabled ? ` · ${getEligibility(a, config).reason}` : ''}</small>
                    </div>
                    <StatusBadge status={getDisplayStatus(a, runtime, platformRuntime, config)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="note">Belum ada akun di platform ini.</p>
            )}
          </section>

          <section className="section">
            <div className="section-head"><h3>Service logs</h3></div>
            <ServiceLogs platformId={platformId} />
          </section>
        </div>
      </div>
    </div>
  )
}
