import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { NOTIFICATION_EVENTS, PLATFORMS } from '../../config/defaults.js'
import { useAppStore } from '../../store/appStore.js'
import Switch from '../common/Switch.jsx'
import TriSelect from '../common/TriSelect.jsx'
import NotificationPreview from './NotificationPreview.jsx'

const snapshot = (config) => ({
  defaults: config.global.notificationDefaults,
  overrides: Object.fromEntries(PLATFORMS.map((p) => [p.id, config.platforms[p.id].notificationOverrides || {}]))
})

export default function NotificationSettingsForm() {
  const { config, saveConfigSection, sendTestNotification } = useAppStore()
  const initial = useMemo(() => snapshot(config), [config])
  const [form, setForm] = useState(initial)
  const [platformId, setPlatformId] = useState('tiktok')
  const [event, setEvent] = useState('liveStart')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const ov = form.overrides[platformId]

  const setOverride = (key, value) =>
    setForm((f) => {
      const next = { ...f.overrides[platformId] }
      if (value === undefined) delete next[key]
      else next[key] = value
      return { ...f, overrides: { ...f.overrides, [platformId]: next } }
    })

  const save = async () => {
    setSaving(true)
    await saveConfigSection(
      (cfg) => ({
        ...cfg,
        global: { ...cfg.global, notificationDefaults: form.defaults },
        platforms: Object.fromEntries(Object.entries(cfg.platforms).map(([id, pc]) => [id, { ...pc, notificationOverrides: form.overrides[id] }]))
      }),
      'Pengaturan notifikasi disimpan'
    )
    setSaving(false)
  }

  const test = async () => {
    setTesting(true)
    await sendTestNotification()
    setTesting(false)
  }

  return (
    <div className="two-col">
      <div>
        <section className="section">
          <div className="section-head"><h3>Preferensi global</h3>{dirty && <span className="dirty">Belum disimpan</span>}</div>
          <div className="toggles toggles-one">
            {NOTIFICATION_EVENTS.map(([key, label]) => (
              <div key={key} className={key !== 'enabled' && !form.defaults.enabled ? 'is-dim' : ''}>
                <span>{label}</span>
                <Switch checked={form.defaults[key]} disabled={key !== 'enabled' && !form.defaults.enabled} label={label} onChange={(v) => setForm((f) => ({ ...f, defaults: { ...f.defaults, [key]: v } }))} />
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h3>Override per platform</h3>
            <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} aria-label="Platform">
              {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
            </select>
          </div>
          <ul className="mini-list">
            {NOTIFICATION_EVENTS.map(([key, label]) => (
              <li key={key}><span>{label}</span><TriSelect value={ov[key]} label={`${label} untuk ${platformId}`} onChange={(v) => setOverride(key, v)} /></li>
            ))}
          </ul>
          <p className="note">Pengaturan notifikasi pada form akun mengalahkan platform dan global untuk event live mulai dan berakhir.</p>
        </section>

        <div className="actions">
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Menyimpan…' : 'Save settings'}</button>
          <button className="btn" onClick={() => setForm(initial)} disabled={!dirty}>Discard changes</button>
        </div>
      </div>

      <section className="section">
        <div className="section-head"><h3>Preview</h3></div>
        <div className="filters">
          <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Jenis notifikasi">
            {NOTIFICATION_EVENTS.filter(([k]) => k !== 'enabled').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <NotificationPreview platformId={platformId} event={event} />
        <button className="btn" onClick={test} disabled={testing} style={{ marginTop: 14 }}>
          <Send size={15} aria-hidden /> {testing ? 'Mengirim…' : 'Test notification'}
        </button>
        <p className="note" style={{ marginTop: 12 }}>Token Telegram tidak disimpan di frontend. Saat backend tersedia, token dikelola di sisi server.</p>
      </section>
    </div>
  )
}
