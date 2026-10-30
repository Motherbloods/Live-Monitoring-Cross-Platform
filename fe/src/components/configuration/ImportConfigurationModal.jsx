import { useState } from 'react'
import ConfigurationDiff from './ConfigurationDiff.jsx'

export default function ImportConfigurationModal({ title, description, rows, confirmLabel, onCancel, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    await onConfirm()
    setBusy(false)
  }
  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="cfg-modal-title">
      <div className="modal modal-wide">
        <h3 id="cfg-modal-title">{title}</h3>
        <p>{description}</p>
        <ConfigurationDiff rows={rows} />
        <p className="note">Riwayat live dan data akun tidak ikut berubah.</p>
        <div className="modal-actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={go} disabled={busy || !rows.length}>{busy ? 'Menerapkan…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
