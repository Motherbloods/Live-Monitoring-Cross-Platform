import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { serverApi } from '../../api/serverApi.js'

export default function CodeCreateForm({ settings, run, onCreated }) {
  const [form, setForm] = useState({ label: '', maxAccounts: settings.defaultMaxAccounts, durationDays: settings.defaultDurationDays, count: 1 })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setForm((f) => ({ ...f, maxAccounts: settings.defaultMaxAccounts, durationDays: settings.defaultDurationDays }))
  }, [settings.defaultMaxAccounts, settings.defaultDurationDays])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const result = await run(() => serverApi.createCodes({ label: form.label, maxAccounts: Number(form.maxAccounts), durationDays: Number(form.durationDays), count: Number(form.count) }))
    setBusy(false)
    if (result && result.codes) {
      onCreated(result.codes)
      setForm((f) => ({ ...f, label: '', count: 1 }))
    }
  }

  return (
    <form className="code-form" onSubmit={submit} noValidate>
      <label className="field"><span>Catatan (nama pembeli)</span><input value={form.label} onChange={set('label')} maxLength={80} placeholder="mis. Budi, order #12" /></label>
      <label className="field"><span>Jatah akun</span><input type="number" min="1" max="50" value={form.maxAccounts} onChange={set('maxAccounts')} /></label>
      <label className="field"><span>Masa aktif (hari)</span><input type="number" min="1" max="3650" value={form.durationDays} onChange={set('durationDays')} /></label>
      <label className="field"><span>Jumlah kode</span><input type="number" min="1" max="50" value={form.count} onChange={set('count')} /></label>
      <button className="btn btn-primary" type="submit" disabled={busy}><Plus size={15} aria-hidden /> {busy ? 'Membuat…' : 'Buat kode'}</button>
    </form>
  )
}
