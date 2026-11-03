import { useState } from 'react'
import { useAppStore } from '../../store/appStore.js'

export default function NewCodesModal({ codes, onClose }) {
  const pushToast = useAppStore((s) => s.pushToast)
  const [saved, setSaved] = useState(false)

  const copy = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text)
      pushToast(message, 'ok')
    } catch {
      pushToast('Tidak bisa menyalin otomatis. Salin manual dari daftar.', 'warn')
    }
  }

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="codes-title">
      <div className="modal modal-wide">
        <h3 id="codes-title">{codes.length} kode dibuat</h3>
        <p className="note">Kode hanya ditampilkan sekali ini. Server tidak menyimpan kode aslinya, jadi simpan atau kirim ke pembeli sebelum menutup jendela ini.</p>
        <ul className="code-list">
          {codes.map((c) => (
            <li key={c.id}>
              <strong className="code-text">{c.code}</strong>
              <small>{c.maxAccounts} akun · {c.durationDays} hari{c.label ? ` · ${c.label}` : ''}</small>
              <button className="btn btn-small" onClick={() => copy(c.code, 'Kode disalin.')}>Salin</button>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          {codes.length > 1 && <button className="btn" onClick={() => copy(codes.map((c) => c.code).join('\n'), 'Semua kode disalin.')}>Salin semua</button>}
          <label className="check"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> Sudah saya simpan</label>
          <button className="btn btn-primary" onClick={onClose} disabled={!saved}>Tutup</button>
        </div>
      </div>
    </div>
  )
}
