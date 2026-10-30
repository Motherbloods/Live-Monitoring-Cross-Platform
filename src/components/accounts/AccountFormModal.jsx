import { useMemo, useState } from 'react'
import { LIMITS, PLATFORMS } from '../../config/defaults.js'
import { useAppStore } from '../../store/appStore.js'
import { validateAccount } from '../../utils/validators.js'
import { interval } from '../../utils/formatters.js'
import Switch from '../common/Switch.jsx'
import TriSelect from '../common/TriSelect.jsx'

const blank = { platformId: 'tiktok', profileUrl: '', username: '', displayName: '', monitoringEnabled: true, useCustomCheckInterval: false, customCheckIntervalSeconds: '', autoRecording: null, notifyEnabled: null, notifyOnStart: null, notifyOnEnd: null, notes: '' }

const fromAccount = (a) => ({ ...blank, ...a, customCheckIntervalSeconds: a.customCheckIntervalSeconds ?? '', autoRecording: a.autoRecording ?? null, notifyEnabled: a.notifyEnabled ?? null, notifyOnStart: a.notifyOnStart ?? null, notifyOnEnd: a.notifyOnEnd ?? null })

export default function AccountFormModal({ account, defaultPlatform, onClose }) {
  const { accounts, config, addAccount, updateAccount } = useAppStore()
  const initial = useMemo(() => (account ? fromAccount(account) : { ...blank, platformId: defaultPlatform || 'tiktok' }), [account, defaultPlatform])
  const [form, setForm] = useState(initial)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const inherited = config.platforms[form.platformId].checkIntervalSeconds || config.global.defaultCheckIntervalSeconds
  const inheritedFrom = config.platforms[form.platformId].checkIntervalSeconds ? 'platform' : 'global'

  const submit = async (e) => {
    e.preventDefault()
    const { errors: found, username } = validateAccount(form, accounts, account?.id)
    setErrors(found)
    if (Object.keys(found).length) return
    setSaving(true)
    if (account) {
      await updateAccount(account.id, {
        platformId: form.platformId,
        username,
        displayName: form.displayName.trim() || username,
        profileUrl: form.profileUrl.trim() || account.profileUrl,
        monitoringEnabled: form.monitoringEnabled,
        useCustomCheckInterval: form.useCustomCheckInterval,
        customCheckIntervalSeconds: form.useCustomCheckInterval ? Number(form.customCheckIntervalSeconds) : null,
        autoRecording: form.autoRecording,
        notifyEnabled: form.notifyEnabled,
        notifyOnStart: form.notifyOnStart,
        notifyOnEnd: form.notifyOnEnd,
        notes: form.notes.trim()
      })
    } else {
      await addAccount(form, username)
    }
    setSaving(false)
    onClose()
  }

  const row = (label, name, input, hint) => (
    <label className="field">
      <span>{label}</span>
      {input}
      {errors[name] ? <small className="field-err">{errors[name]}</small> : hint && <small>{hint}</small>}
    </label>
  )

  return (
    <div className="modal-wrap" role="dialog" aria-modal="true" aria-labelledby="acc-title">
      <form className="modal modal-wide" onSubmit={submit} noValidate>
        <div className="modal-top">
          <h3 id="acc-title">{account ? 'Edit akun' : 'Tambah akun'}</h3>
          {dirty && <span className="dirty">Belum disimpan</span>}
        </div>
        <div className="form-grid">
          {row('Platform', 'platformId', <select value={form.platformId} onChange={(e) => set({ platformId: e.target.value })}>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
          {row('Username', 'username', <input value={form.username} onChange={(e) => set({ username: e.target.value })} placeholder="mis. nadia.putri" />, 'Boleh dikosongkan jika profile URL diisi.')}
          {row('Profile URL', 'profileUrl', <input value={form.profileUrl} onChange={(e) => set({ profileUrl: e.target.value })} placeholder="https://" />)}
          {row('Nama tampilan', 'displayName', <input value={form.displayName} onChange={(e) => set({ displayName: e.target.value })} />)}
        </div>

        <div className="toggles">
          <div><span>Monitoring aktif</span><Switch checked={form.monitoringEnabled} onChange={(v) => set({ monitoringEnabled: v })} label="Monitoring aktif" /></div>
          <div><span>Rekam otomatis</span><TriSelect value={form.autoRecording} onChange={(v) => set({ autoRecording: v ?? null })} label="Rekam otomatis" /></div>
          <div><span>Notifikasi</span><TriSelect value={form.notifyEnabled} onChange={(v) => set({ notifyEnabled: v ?? null })} label="Notifikasi" /></div>
          <div><span>Saat live mulai</span><TriSelect value={form.notifyOnStart} onChange={(v) => set({ notifyOnStart: v ?? null })} label="Notifikasi live mulai" /></div>
          <div><span>Saat live berakhir</span><TriSelect value={form.notifyOnEnd} onChange={(v) => set({ notifyOnEnd: v ?? null })} label="Notifikasi live berakhir" /></div>
          <div><span>Interval khusus</span><Switch checked={form.useCustomCheckInterval} onChange={(v) => set({ useCustomCheckInterval: v })} label="Interval khusus" /></div>
        </div>

        {form.useCustomCheckInterval
          ? row('Interval pemeriksaan (detik)', 'customCheckIntervalSeconds', <input type="number" min={LIMITS.interval.min} max={LIMITS.interval.max} value={form.customCheckIntervalSeconds} onChange={(e) => set({ customCheckIntervalSeconds: e.target.value })} />, `Mengalahkan interval ${inheritedFrom} (${interval(inherited)}).`)
          : <p className="note">Interval efektif: {interval(inherited)}, diwarisi dari {inheritedFrom}.</p>}

        {row('Catatan', 'notes', <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} />)}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || (account && !dirty)}>{saving ? 'Menyimpan…' : account ? 'Save changes' : 'Add account'}</button>
        </div>
      </form>
    </div>
  )
}
