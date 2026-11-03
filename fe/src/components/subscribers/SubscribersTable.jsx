import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PLATFORMS } from '../../config/defaults.js'
import { serverApi } from '../../api/serverApi.js'
import { dateOnly, daysLeft } from '../../utils/formatters.js'
import StatusBadge from '../common/StatusBadge.jsx'

const short = (id) => PLATFORMS.find((p) => p.id === id)?.short || id

function Detail({ sub, settings, run, askDelete }) {
  const [platformId, setPlatformId] = useState(settings.allowedPlatforms[0] || 'tiktok')
  const [username, setUsername] = useState('')
  const [slots, setSlots] = useState(sub.maxAccounts)

  const add = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    const ok = await run(() => serverApi.addSubscriberAccount(sub.id, { platformId, username: username.trim() }), 'Akun ditambahkan.')
    if (ok) setUsername('')
  }

  return (
    <div className="sub-detail">
      <div>
        <h4>Akun dipantau ({sub.selections.length} dari {sub.maxAccounts})</h4>
        {sub.selections.length ? (
          <ul className="mini-list">
            {sub.selections.map((x) => (
              <li key={x.accountId}>
                <div><strong>{x.displayName || x.username || 'Akun dihapus'}</strong><small>{x.platformId ? `${short(x.platformId)} · @${x.username}` : ''}</small></div>
                <div className="row-actions">
                  {x.liveStatus && <StatusBadge status={x.liveStatus} />}
                  <button className="btn btn-small" onClick={() => run(() => serverApi.removeSubscriberAccount(sub.id, x.accountId), 'Akun dilepas.')}>Hapus</button>
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="note">Belum memilih akun.</p>}
        <form className="filters" onSubmit={add}>
          <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} aria-label="Platform">
            {settings.allowedPlatforms.map((id) => <option key={id} value={id}>{short(id)}</option>)}
          </select>
          <input className="log-search" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" aria-label="Username" />
          <button className="btn btn-small" type="submit">Tambah akun</button>
        </form>
      </div>
      <div className="sub-actions">
        <h4>Kelola</h4>
        <div className="actions">
          <button className="btn btn-small" onClick={() => run(() => serverApi.patchSubscriber(sub.id, { extendDays: 30 }), 'Diperpanjang 30 hari.')}>+30 hari</button>
          {sub.status === 'revoked'
            ? <button className="btn btn-small" onClick={() => run(() => serverApi.patchSubscriber(sub.id, { status: 'active' }), 'Langganan diaktifkan lagi.')}>Aktifkan</button>
            : <button className="btn btn-small" onClick={() => run(() => serverApi.patchSubscriber(sub.id, { status: 'revoked' }), 'Langganan dihentikan.')}>Hentikan</button>}
          <button className="btn btn-small btn-danger" onClick={() => askDelete(sub)}>Hapus data</button>
        </div>
        <div className="filters">
          <label className="inline-field">Jatah akun <input className="set-input short" type="number" min="1" max="50" value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
          <button className="btn btn-small" onClick={() => run(() => serverApi.patchSubscriber(sub.id, { maxAccounts: Number(slots) }), 'Jatah diubah.')} disabled={Number(slots) === sub.maxAccounts}>Simpan</button>
        </div>
      </div>
    </div>
  )
}

export default function SubscribersTable({ subscribers, settings, run }) {
  const [open, setOpen] = useState(null)
  const [removing, setRemoving] = useState(null)

  if (!subscribers.length) return <div className="empty"><strong>Belum ada pelanggan</strong><p>Pelanggan muncul di sini setelah menukarkan kode lewat bot Telegram.</p></div>

  return (
    <>
      <div className="atable" style={{ '--cols': 'minmax(180px,1.5fr) 120px 150px 110px 40px' }}>
        <div className="drow ahead"><span>Pelanggan</span><span>Status</span><span>Berlaku sampai</span><span>Akun</span><span /></div>
        {subscribers.map((s) => {
          const left = daysLeft(s.expiresAt)
          const state = s.status === 'revoked' ? ['Dihentikan', 'disabled'] : s.active ? ['Aktif', 'online'] : ['Habis', 'degraded']
          return (
            <div key={s.id}>
              <div className="drow">
                <div className="acell" data-label="Pelanggan"><strong>{s.name || 'Tanpa nama'}</strong><small>{s.telegramUsername ? `@${s.telegramUsername}` : `chat ${s.chatId}`}{s.note ? ` · ${s.note}` : ''}</small></div>
                <div className="acell" data-label="Status"><span className={`badge badge-${state[1]}`}>{state[0]}</span></div>
                <div className="acell" data-label="Berlaku sampai">{dateOnly(s.expiresAt)}<small>{s.active ? `${left} hari lagi` : 'sudah lewat'}</small></div>
                <div className="acell" data-label="Akun">{s.selections.length} / {s.maxAccounts}</div>
                <div className="acell right"><button className="icon-btn" onClick={() => setOpen(open === s.id ? null : s.id)} aria-label={open === s.id ? 'Tutup rincian' : 'Buka rincian'}>{open === s.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button></div>
              </div>
              {open === s.id && <Detail sub={s} settings={settings} run={run} askDelete={setRemoving} />}
            </div>
          )
        })}
      </div>

      {removing && (
        <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="del-sub">
          <div className="modal">
            <h3 id="del-sub">Hapus data {removing.name || 'pelanggan'}?</h3>
            <p>Langganan dan daftar akun pelanggan ini dihapus. Notifikasi ke pelanggan berhenti. Kode yang sudah dipakai tidak bisa dipakai lagi.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setRemoving(null)}>Batal</button>
              <button className="btn btn-danger" onClick={async () => { await run(() => serverApi.deleteSubscriber(removing.id), 'Data pelanggan dihapus.'); setRemoving(null) }}>Hapus data</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
