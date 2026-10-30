import { useMemo, useState } from 'react'
import { LIMITS } from '../../config/defaults.js'
import { useAppStore } from '../../store/appStore.js'
import Switch from '../common/Switch.jsx'

const FIELDS = [
  { key: 'checkIntervalSeconds', label: 'Check interval (detik)', limit: LIMITS.interval, globalKey: 'defaultCheckIntervalSeconds' },
  { key: 'retryAttempts', label: 'Retry attempts', limit: LIMITS.retryAttempts, globalKey: 'defaultRetryAttempts', hint: 'Dipakai saat pemeriksaan gagal, bukan saat akun terdeteksi offline.' },
  { key: 'retryDelaySeconds', label: 'Retry delay (detik)', limit: LIMITS.retryDelay, globalKey: 'defaultRetryDelaySeconds' },
  { key: 'requestTimeoutMs', label: 'Request timeout (ms)', limit: LIMITS.timeoutMs, globalKey: 'defaultRequestTimeoutMs' },
  { key: 'maxConcurrentChecks', label: 'Max concurrent checks', limit: LIMITS.concurrency, globalKey: 'maxConcurrentChecks' }
]

const toForm = (pc) => ({ monitoringEnabled: pc.monitoringEnabled, ...Object.fromEntries(FIELDS.map((f) => [f.key, pc[f.key] ?? ''])) })

export default function ServiceConfigurationForm({ platformId }) {
  const { config, savePlatformConfig } = useAppStore()
  const saved = config.platforms[platformId]
  const initial = useMemo(() => toForm(saved), [saved])
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)

  const submit = async (e) => {
    e.preventDefault()
    const found = {}
    const patch = { monitoringEnabled: form.monitoringEnabled }
    for (const f of FIELDS) {
      if (form[f.key] === '' || form[f.key] === null) {
        patch[f.key] = null
        continue
      }
      const n = Number(form[f.key])
      if (!Number.isFinite(n) || n < f.limit.min || n > f.limit.max) found[f.key] = `Isi angka ${f.limit.min}–${f.limit.max}, atau kosongkan untuk mengikuti global.`
      patch[f.key] = n
    }
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    await savePlatformConfig(platformId, patch)
    setSaving(false)
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="cfg-head">
        <span>{dirty ? <span className="dirty">Belum disimpan</span> : <small>Tersimpan lokal · belum diterapkan ke server</small>}</span>
      </div>
      <div className="toggles toggles-one">
        <div><span>Monitoring platform aktif</span><Switch checked={form.monitoringEnabled} onChange={(v) => setForm((f) => ({ ...f, monitoringEnabled: v }))} label="Monitoring platform aktif" /></div>
      </div>
      <div className="form-grid">
        {FIELDS.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.label}</span>
            <input type="number" value={form[f.key]} placeholder={`Ikut global (${config.global[f.globalKey]})`} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
            {errors[f.key] ? <small className="field-err">{errors[f.key]}</small> : f.hint && <small>{f.hint}</small>}
          </label>
        ))}
      </div>
      <div className="modal-actions left">
        <button type="submit" className="btn btn-primary" disabled={!dirty || saving}>{saving ? 'Menyimpan…' : 'Save configuration'}</button>
        <button type="button" className="btn" disabled={!dirty} onClick={() => { setForm(initial); setErrors({}) }}>Discard changes</button>
      </div>
    </form>
  )
}
