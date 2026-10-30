import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pencil, Plus, ScanSearch, Search, Trash2, Users } from 'lucide-react'
import { useAppStore } from '../store/appStore.js'
import { PLATFORMS } from '../config/defaults.js'
import { getDisplayStatus, getEligibility, resolveEffectiveConfig } from '../utils/effectiveConfig.js'
import { ago, interval } from '../utils/formatters.js'
import StatusBadge from '../components/common/StatusBadge.jsx'
import Switch from '../components/common/Switch.jsx'
import AccountFormModal from '../components/accounts/AccountFormModal.jsx'

const PAGE_SIZE = 10
const ORDER = { live: 0, checking: 1, error: 2, unknown: 3, offline: 4, disabled: 5 }
const platformOf = (id) => PLATFORMS.find((p) => p.id === id)
const time = (iso) => (iso ? new Date(iso).getTime() : 0)

export default function LiveAccounts() {
  const { accounts, runtime, platformRuntime, config, setAccountMonitoring, checkAccount, deleteAccount } = useAppStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [platform, setPlatform] = useState(params.get('platform') || 'all')
  const [status, setStatus] = useState('all')
  const [monitoring, setMonitoring] = useState('all')
  const [sort, setSort] = useState('name')
  const [dir, setDir] = useState('asc')
  const [page, setPage] = useState(1)
  const [form, setForm] = useState(params.get('new') ? { account: null } : null)
  const [removing, setRemoving] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)

  useEffect(() => {
    if (params.get('new') || params.get('q')) setParams({}, { replace: true })
  }, [])

  const rows = useMemo(() => {
    const list = accounts
      .map((a) => ({
        a,
        st: getDisplayStatus(a, runtime, platformRuntime, config),
        eff: resolveEffectiveConfig(a, config),
        rt: runtime[a.id] || {}
      }))
      .filter(({ a, st }) => {
        const needle = q.trim().toLowerCase()
        if (!config.global.showOfflineAccounts && st === 'offline' && status === 'all') return false
        if (!config.global.showUnknownAccounts && (st === 'unknown' || st === 'error') && status === 'all') return false
        if (needle && !a.username.toLowerCase().includes(needle) && !a.displayName.toLowerCase().includes(needle)) return false
        if (platform !== 'all' && a.platformId !== platform) return false
        if (status !== 'all' && st !== status) return false
        if (monitoring !== 'all' && a.monitoringEnabled !== (monitoring === 'enabled')) return false
        return true
      })
    const keys = {
      name: (r) => r.a.displayName.toLowerCase(),
      platform: (r) => r.a.platformId,
      status: (r) => ORDER[r.st],
      checked: (r) => time(r.rt.lastChecked),
      interval: (r) => r.eff.checkIntervalSeconds
    }
    const k = keys[sort]
    return list.sort((x, y) => (k(x) > k(y) ? 1 : k(x) < k(y) ? -1 : 0) * (dir === 'asc' ? 1 : -1))
  }, [accounts, runtime, platformRuntime, config, q, platform, status, monitoring, sort, dir])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
  const reset = (fn) => (v) => {
    fn(v)
    setPage(1)
  }

  const confirmDelete = async () => {
    setBusyDelete(true)
    await deleteAccount(removing.id)
    setBusyDelete(false)
    setRemoving(null)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Live accounts</h1>
          <p>{rows.length} dari {accounts.length} akun ditampilkan.</p>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={() => setForm({ account: null })}>
            <Plus size={15} aria-hidden /> Add account
          </button>
        </div>
      </header>

      <div className="filters">
        <label className="search search-wide">
          <Search size={15} aria-hidden />
          <input type="search" value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Cari username atau nama" aria-label="Cari akun" />
        </label>
        <select value={platform} onChange={(e) => reset(setPlatform)(e.target.value)} aria-label="Platform">
          <option value="all">All platforms</option>
          {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
        </select>
        <select value={status} onChange={(e) => reset(setStatus)(e.target.value)} aria-label="Status live">
          <option value="all">Semua status</option>
          {['live', 'offline', 'checking', 'unknown', 'error', 'disabled'].map((s) => <option key={s} value={s}>{s === 'disabled' ? 'Monitoring off' : s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select value={monitoring} onChange={(e) => reset(setMonitoring)(e.target.value)} aria-label="Monitoring">
          <option value="all">Monitoring: semua</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
          <option value="name">Urut: Nama</option>
          <option value="platform">Urut: Platform</option>
          <option value="status">Urut: Status</option>
          <option value="checked">Urut: Last checked</option>
          <option value="interval">Urut: Interval</option>
        </select>
        <button className="btn btn-small" onClick={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))} aria-label="Balik urutan">{dir === 'asc' ? 'A–Z' : 'Z–A'}</button>
      </div>

      {visible.length ? (
        <div className="atable" role="table" aria-label="Daftar akun">
          <div className="arow ahead" role="row">
            <span>Account</span><span>Live status</span><span>Monitoring</span><span>Interval efektif</span><span>Last checked</span><span>Last success</span><span className="right">Actions</span>
          </div>
          {visible.map(({ a, st, eff, rt }) => {
            const p = platformOf(a.platformId)
            const elig = getEligibility(a, config)
            return (
              <div className="arow" role="row" key={a.id} style={{ '--accent': p.color }}>
                <div className="acell acct" data-label="Account">
                  <span className="svc-mark" aria-hidden />
                  <div><strong>{a.displayName}</strong><small>@{a.username} · {p.short}</small></div>
                </div>
                <div className="acell" data-label="Live status">
                  <StatusBadge status={st} />
                  {rt.lastError && st === 'error' && <small className="field-err">{rt.lastError}</small>}
                </div>
                <div className="acell" data-label="Monitoring">
                  <Switch checked={a.monitoringEnabled} onChange={(v) => setAccountMonitoring(a.id, v)} label={`Monitoring ${a.displayName}`} />
                  {!elig.eligible && a.monitoringEnabled && <small>{elig.reason}</small>}
                </div>
                <div className="acell" data-label="Interval efektif">{interval(eff.checkIntervalSeconds)}<small>dari {eff.intervalSource}</small></div>
                <div className="acell" data-label="Last checked">{ago(rt.lastChecked)}</div>
                <div className="acell" data-label="Last success">{ago(rt.lastSuccess)}</div>
                <div className="acell right" data-label="Actions">
                  <button className="icon-btn" title="Check now" aria-label={`Periksa ${a.displayName}`} disabled={rt.checking} onClick={() => checkAccount(a.id)}><ScanSearch size={16} className={rt.checking ? 'spin' : ''} /></button>
                  <button className="icon-btn" title="Edit" aria-label={`Edit ${a.displayName}`} onClick={() => setForm({ account: a })}><Pencil size={15} /></button>
                  <button className="icon-btn" title="Delete" aria-label={`Hapus ${a.displayName}`} onClick={() => setRemoving(a)}><Trash2 size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <Users size={22} aria-hidden />
          <strong>Tidak ada akun yang cocok</strong>
          <p>Ubah kata kunci atau filter, atau tambahkan akun baru.</p>
        </div>
      )}

      {rows.length > PAGE_SIZE && (
        <div className="pager">
          <button className="icon-btn" disabled={current === 1} onClick={() => setPage(current - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={16} /></button>
          <span>Halaman {current} dari {pages}</span>
          <button className="icon-btn" disabled={current === pages} onClick={() => setPage(current + 1)} aria-label="Halaman berikutnya"><ChevronRight size={16} /></button>
        </div>
      )}

      {form && <AccountFormModal account={form.account} defaultPlatform={platform !== 'all' ? platform : undefined} onClose={() => setForm(null)} />}

      {removing && (
        <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="modal">
            <h3 id="del-title">Hapus {removing.displayName}?</h3>
            <p>Akun dan konfigurasinya akan dihapus dari daftar. Riwayat live tidak ikut dihapus.</p>
            <p>Jika Anda hanya ingin berhenti memeriksa akun ini sementara, matikan monitoring saja. Konfigurasinya tetap tersimpan.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setRemoving(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={busyDelete}>{busyDelete ? 'Menghapus…' : 'Delete account'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
