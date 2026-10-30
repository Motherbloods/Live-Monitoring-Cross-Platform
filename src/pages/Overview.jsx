import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, Plus, RefreshCw, ScanSearch, Tv } from 'lucide-react'
import { useAppStore } from '../store/appStore.js'
import { PLATFORMS } from '../config/defaults.js'
import { computeStats, getEligibility, getPlatformSummary, getGlobalStatus, resolveEffectiveConfig } from '../utils/effectiveConfig.js'
import { ago, clock, compact, duration, interval } from '../utils/formatters.js'
import StatusBadge from '../components/common/StatusBadge.jsx'

const platformOf = (id) => PLATFORMS.find((p) => p.id === id)
const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()

function ConfirmCheckAll({ count, onCancel, onConfirm }) {
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="modal">
        <h3 id="confirm-title">Periksa {count} akun sekarang?</h3>
        <p>Pemeriksaan ini hanya simulasi di frontend. Tidak ada permintaan jaringan ke platform mana pun.</p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Batal</button>
          <button className="btn btn-primary" onClick={onConfirm}>Periksa semua</button>
        </div>
      </div>
    </div>
  )
}

function LiveCard({ account, live }) {
  const p = platformOf(account.platformId)
  return (
    <article className="live-card" style={{ '--accent': p.color }}>
      <div className="live-thumb">
        <span className="live-flag">
          <span className="pulse" />
          LIVE
        </span>
        <span className="live-time">{duration(live.startedAt)}</span>
      </div>
      <div className="live-body">
        <div className="live-who">
          <span className="avatar-lg">{initials(account.displayName)}</span>
          <div>
            <strong>{account.displayName}</strong>
            <small>@{account.username} · {p.short}</small>
          </div>
        </div>
        <p className="live-title">{live.title}</p>
        <div className="live-foot">
          <span title="Jumlah penonton tersimulasi">{compact(live.viewers)} penonton <em>simulasi</em></span>
          <a className="btn btn-small" href={account.profileUrl} target="_blank" rel="noreferrer">
            Open live <ExternalLink size={12} aria-hidden />
          </a>
        </div>
      </div>
    </article>
  )
}

export default function Overview() {
  const { accounts, runtime, platformRuntime, config, activities, savedAt, busy, checkAllEnabled, refreshDashboard } = useAppStore()
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('recent')
  const [confirming, setConfirming] = useState(false)

  const stats = computeStats(accounts, runtime, platformRuntime, config)
  const global = getGlobalStatus(config, platformRuntime)

  const liveList = useMemo(() => {
    const list = accounts
      .filter((a) => runtime[a.id]?.lastStatus === 'live' && runtime[a.id]?.live && a.monitoringEnabled)
      .filter((a) => filter === 'all' || a.platformId === filter)
      .map((a) => ({ account: a, live: runtime[a.id].live }))
    const by = {
      recent: (x, y) => new Date(y.live.startedAt) - new Date(x.live.startedAt),
      longest: (x, y) => new Date(x.live.startedAt) - new Date(y.live.startedAt),
      viewers: (x, y) => y.live.viewers - x.live.viewers
    }
    return list.sort(by[sort])
  }, [accounts, runtime, filter, sort])

  const staleLive = stats.live < liveList.length

  const statItems = [
    { label: 'Total accounts', value: stats.total, note: `${stats.enabled} dipantau` },
    { label: 'Currently live', value: stats.live, note: 'status terpercaya', tone: 'live' },
    { label: 'Offline', value: stats.offline, note: 'terkonfirmasi' },
    { label: 'Unknown / error', value: stats.unknown, note: `${stats.disabled} monitoring off`, tone: stats.unknown ? 'warn' : '' },
    { label: 'Active services', value: `${stats.activeServices}/5`, note: `${stats.disabledServices} disabled` }
  ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Live overview</h1>
          <p>Monitor your favorite creators across every platform.</p>
        </div>
        <div className="actions">
          <Link className="btn" to="/accounts?new=1">
            <Plus size={15} aria-hidden /> Add account
          </Link>
          <button className="btn" onClick={refreshDashboard}>
            <RefreshCw size={15} aria-hidden /> Refresh dashboard
          </button>
          <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={busy.checkAll}>
            <ScanSearch size={15} aria-hidden /> {busy.checkAll ? 'Checking…' : 'Check all enabled accounts'}
          </button>
        </div>
      </header>

      <section className="stats" aria-label="Statistik">
        {statItems.map((s) => (
          <div key={s.label} className={`stat ${s.tone ? `stat-${s.tone}` : ''}`}>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
            <small>{s.note}</small>
          </div>
        ))}
      </section>

      <section className="section" aria-labelledby="live-h">
        <div className="section-head">
          <h3 id="live-h">Currently live</h3>
          <div className="controls">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter platform">
              <option value="all">All platforms</option>
              {PLATFORMS.map((p) => (
                <option key={p.id} value={p.id}>{p.short}</option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
              <option value="recent">Recently started</option>
              <option value="longest">Longest live</option>
              <option value="viewers">Most viewers</option>
            </select>
          </div>
        </div>
        {liveList.length ? (
          <>
            {(staleLive || !config.global.globalMonitoringEnabled) && (
              <p className="note">Sebagian status berasal dari pemeriksaan terakhir dan belum tentu aktual.</p>
            )}
            <div className="live-grid">
              {liveList.map(({ account, live }) => (
                <LiveCard key={account.id} account={account} live={live} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <Tv size={22} aria-hidden />
            <strong>Tidak ada akun yang sedang live</strong>
            <p>Jalankan pemeriksaan atau ganti filter platform untuk melihat akun lain.</p>
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="section" aria-labelledby="svc-h">
          <div className="section-head">
            <h3 id="svc-h">Platform services</h3>
          </div>
          <ul className="svc-list">
            {PLATFORMS.map((p) => {
              const pc = config.platforms[p.id]
              const rt = platformRuntime[p.id]
              const own = accounts.filter((a) => a.platformId === p.id)
              const { live, unable } = getPlatformSummary(p.id, accounts, runtime, platformRuntime, config)
              const status = !pc.serviceEnabled ? 'svcDisabled' : rt.status === 'offline' ? 'svcOffline' : rt.status
              const sample = own[0] ? resolveEffectiveConfig(own[0], config).checkIntervalSeconds : config.global.defaultCheckIntervalSeconds
              const platformInterval = pc.checkIntervalSeconds || config.global.defaultCheckIntervalSeconds
              return (
                <li key={p.id} style={{ '--accent': p.color }} className={!pc.serviceEnabled ? 'is-dim' : ''}>
                  <span className="svc-mark" aria-hidden />
                  <div className="svc-main">
                    <div className="svc-top">
                      <strong>{p.name}</strong>
                      <StatusBadge status={status} />
                    </div>
                    <p className="svc-meta">
                      {own.length} akun · {live} live · {unable} tidak dapat diperiksa · tiap {interval(platformInterval)}
                    </p>
                    <p className="svc-meta">
                      Sukses terakhir {ago(rt.lastSuccess)}
                      {rt.lastError && <span className="svc-err"> · {rt.lastError}</span>}
                    </p>
                  </div>
                  <Link className="btn btn-small" to={`/platforms/${p.id}`} data-sample={sample}>
                    View details
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        <div className="stack">
          <section className="section" aria-labelledby="act-h">
            <div className="section-head">
              <h3 id="act-h">Recent activity</h3>
              <button className="link-btn" disabled>View all activity</button>
            </div>
            <ol className="timeline">
              {activities.slice(0, 7).map((a) => (
                <li key={a.id} className={`lvl-${a.level}`}>
                  <span className="tl-dot" />
                  <div>
                    <p>{a.text}</p>
                    <small>{platformOf(a.platformId)?.short || 'Sistem'} · {ago(a.at)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="section" aria-labelledby="health-h">
            <div className="section-head">
              <h3 id="health-h">System health</h3>
            </div>
            <dl className="health">
              <div><dt>Global monitoring</dt><dd className={`tone-${global}`}>{{ running: 'Running', partial: 'Partially running', stopped: 'Stopped', starting: 'Starting' }[global]}</dd></div>
              <div><dt>Platform services aktif</dt><dd>{stats.activeServices} dari 5</dd></div>
              <div><dt>Akun memenuhi syarat monitoring</dt><dd>{stats.eligible} dari {stats.total}</dd></div>
              <div><dt>Akun live sekarang</dt><dd>{stats.live}</dd></div>
              <div><dt>Error terbaru</dt><dd>{activities.filter((a) => a.level === 'error').length}</dd></div>
              <div><dt>Konfigurasi terakhir disimpan</dt><dd>{savedAt ? clock(savedAt) : 'Default bawaan'}</dd></div>
            </dl>
            <p className="note">Mode mock: tidak ada backend terhubung. Jadwal dan status bersifat simulasi.</p>
          </section>
        </div>
      </div>

      {confirming && (
        <ConfirmCheckAll
          count={accounts.filter((a) => getEligibility(a, config).eligible).length}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            checkAllEnabled()
          }}
        />
      )}
    </div>
  )
}
