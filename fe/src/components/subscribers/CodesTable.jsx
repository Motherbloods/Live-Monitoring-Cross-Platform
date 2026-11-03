import { useState } from 'react'
import { serverApi } from '../../api/serverApi.js'
import { dateOnly } from '../../utils/formatters.js'

const LABEL = { unused: 'Belum dipakai', redeemed: 'Dipakai', revoked: 'Dibatalkan' }
const TONE = { unused: 'online', redeemed: '', revoked: 'disabled' }
const LIMIT = 12

export default function CodesTable({ codes, run }) {
  const [all, setAll] = useState(false)
  const rows = all ? codes : codes.slice(0, LIMIT)
  if (!codes.length) return <div className="empty"><strong>Belum ada kode</strong><p>Buat kode di atas, lalu kirim ke pembeli setelah pembayaran masuk.</p></div>

  return (
    <>
      <div className="atable" style={{ '--cols': '120px minmax(120px,1.4fr) 130px 130px 110px 100px' }}>
        <div className="drow ahead"><span>Kode</span><span>Catatan</span><span>Paket</span><span>Dibuat</span><span>Status</span><span className="right">Actions</span></div>
        {rows.map((c) => (
          <div className="drow" key={c.id}>
            <div className="acell" data-label="Kode"><strong className="code-text">{c.prefix}-••••</strong></div>
            <div className="acell" data-label="Catatan">{c.label || '—'}</div>
            <div className="acell" data-label="Paket">{c.maxAccounts} akun · {c.durationDays} hari</div>
            <div className="acell" data-label="Dibuat">{dateOnly(c.createdAt)}</div>
            <div className="acell" data-label="Status"><span className={`badge ${TONE[c.status] ? `badge-${TONE[c.status]}` : ''}`}>{LABEL[c.status]}</span></div>
            <div className="acell right" data-label="Actions">
              {c.status === 'unused' && <button className="btn btn-small" onClick={() => run(() => serverApi.revokeCode(c.id), 'Kode dibatalkan.')}>Batalkan</button>}
            </div>
          </div>
        ))}
      </div>
      {codes.length > LIMIT && <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setAll((v) => !v)}>{all ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${codes.length})`}</button>}
    </>
  )
}
