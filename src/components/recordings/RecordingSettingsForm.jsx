import { useMemo, useState } from 'react'
import { LIMITS, PLATFORMS } from '../../config/defaults.js'
import { useAppStore } from '../../store/appStore.js'
import Switch from '../common/Switch.jsx'
import TriSelect from '../common/TriSelect.jsx'

const snapshot = (config) => ({
  defaults: config.global.recordingDefaults,
  overrides: Object.fromEntries(PLATFORMS.map((p) => [p.id, config.platforms[p.id].recordingOverrides || {}]))
})

export default function RecordingSettingsForm() {
  const { config, saveConfigSection } = useAppStore()
  const initial = useMemo(() => snapshot(config), [config])
  const [form, setForm] = useState(initial)
  const [platformId, setPlatformId] = useState('tiktok')
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const d = form.defaults
  const ov = form.overrides[platformId]
  const setD = (patch) => setForm((f) => ({ ...f, defaults: { ...f.defaults, ...patch } }))
  const setO = (key, value) =>
    setForm((f) => {
      const next = { ...f.overrides[platformId] }
      if (value === undefined || value === '' || Number.isNaN(value)) delete next[key]
      else next[key] = value
      return { ...f, overrides: { ...f.overrides, [platformId]: next } }
    })

  const bad = (v, l) => !Number.isFinite(v) || v < l.min || v > l.max

  const save = async () => {
    setSaving(true)
    await saveConfigSection(
      (cfg) => ({
        ...cfg,
        global: { ...cfg.global, recordingDefaults: form.defaults },
        platforms: Object.fromEntries(Object.entries(cfg.platforms).map(([id, pc]) => [id, { ...pc, recordingOverrides: form.overrides[id] }]))
      }),
      'Pengaturan rekaman disimpan'
    )
    setSaving(false)
  }

  return (
    <div className="two-col">
      <div>
        <div className="section-head"><h3>Pengaturan global</h3>{dirty && <span className="dirty">Belum disimpan</span>}</div>
        <div className="toggles toggles-one">
          <div><span>Auto recording</span><Switch checked={d.autoRecording} onChange={(v) => setD({ autoRecording: v })} label="Auto recording" /></div>
          <div><span>Retry saat gagal</span><Switch checked={d.retryOnFailure} onChange={(v) => setD({ retryOnFailure: v })} label="Retry saat gagal" /></div>
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label className="field"><span>Output directory</span><input value={d.outputDirectory} onChange={(e) => setD({ outputDirectory: e.target.value })} />{!d.outputDirectory.trim() && <small className="field-err">Wajib diisi.</small>}</label>
          <label className="field"><span>Output format</span><select value={d.outputFormat} onChange={(e) => setD({ outputFormat: e.target.value })}><option value="ts">TS</option><option value="mp4">MP4</option></select></label>
          <label className="field"><span>Durasi maksimum (menit)</span><input type="number" value={Number.isFinite(d.maxDurationMinutes) ? d.maxDurationMinutes : ''} onChange={(e) => setD({ maxDurationMinutes: e.target.value === '' ? NaN : Number(e.target.value) })} />{bad(d.maxDurationMinutes, LIMITS.recordingDuration) && <small className="field-err">Isi {LIMITS.recordingDuration.min}–{LIMITS.recordingDuration.max}.</small>}</label>
          <label className="field"><span>Maks. rekaman bersamaan</span><input type="number" value={Number.isFinite(d.maxConcurrentRecordings) ? d.maxConcurrentRecordings : ''} onChange={(e) => setD({ maxConcurrentRecordings: e.target.value === '' ? NaN : Number(e.target.value) })} />{bad(d.maxConcurrentRecordings, LIMITS.recordingConcurrent) && <small className="field-err">Isi {LIMITS.recordingConcurrent.min}–{LIMITS.recordingConcurrent.max}.</small>}</label>
        </div>
      </div>

      <div>
        <div className="section-head">
          <h3>Override per platform</h3>
          <select value={platformId} onChange={(e) => setPlatformId(e.target.value)} aria-label="Platform">
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.short}</option>)}
          </select>
        </div>
        <ul className="mini-list">
          <li><span>Auto recording</span><TriSelect value={ov.autoRecording} label="Auto recording platform" onChange={(v) => setO('autoRecording', v)} /></li>
          <li><span>Retry saat gagal</span><TriSelect value={ov.retryOnFailure} label="Retry platform" onChange={(v) => setO('retryOnFailure', v)} /></li>
          <li>
            <span>Output format</span>
            <select value={ov.outputFormat || ''} aria-label="Format platform" onChange={(e) => setO('outputFormat', e.target.value)}>
              <option value="">Ikut global</option><option value="ts">TS</option><option value="mp4">MP4</option>
            </select>
          </li>
          <li>
            <span>Durasi maks. (menit)</span>
            <input className="set-input short" type="number" placeholder="Ikut global" value={ov.maxDurationMinutes ?? ''} onChange={(e) => setO('maxDurationMinutes', e.target.value === '' ? '' : Number(e.target.value))} />
          </li>
        </ul>
        <p className="note">Pengaturan Auto recording pada form akun mengalahkan platform dan global.</p>
        <div className="actions" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving || !d.outputDirectory.trim() || bad(d.maxDurationMinutes, LIMITS.recordingDuration) || bad(d.maxConcurrentRecordings, LIMITS.recordingConcurrent)}>{saving ? 'Menyimpan…' : 'Save settings'}</button>
          <button className="btn" onClick={() => setForm(initial)} disabled={!dirty}>Discard changes</button>
        </div>
      </div>
    </div>
  )
}
