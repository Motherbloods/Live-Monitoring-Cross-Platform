import { useMemo, useRef, useState } from 'react'
import { RotateCcw, Upload } from 'lucide-react'
import { useAppStore } from '../store/appStore.js'
import { LIMITS } from '../config/defaults.js'
import { importConfig, resetToDefaults, validateConfig } from '../config/configurationManager.js'
import { diffConfig } from '../config/configDiff.js'
import { resolveEffectiveConfig } from '../utils/effectiveConfig.js'
import { clock } from '../utils/formatters.js'
import Switch from '../components/common/Switch.jsx'
import ConfigurationStatus from '../components/configuration/ConfigurationStatus.jsx'
import ConfigurationDiff from '../components/configuration/ConfigurationDiff.jsx'
import IntervalInput from '../components/configuration/IntervalInput.jsx'
import ImportConfigurationModal from '../components/configuration/ImportConfigurationModal.jsx'
import ExportConfigurationButton from '../components/configuration/ExportConfigurationButton.jsx'

const ZONES = [['Asia/Jakarta', 'WIB (Jakarta)'], ['Asia/Makassar', 'WITA (Makassar)'], ['Asia/Jayapura', 'WIT (Jayapura)'], ['UTC', 'UTC']]
const REFRESH = [[0, 'Manual'], [5, '5 detik'], [15, '15 detik'], [30, '30 detik'], [60, '60 detik']]

const sourceCount = (accounts, config) => {
  const out = { account: 0, platform: 0, global: 0 }
  accounts.forEach((a) => {
    out[resolveEffectiveConfig(a, config).intervalSource] += 1
  })
  return out
}

function NumberField({ label, value, onChange, limit, suffix }) {
  const bad = !Number.isFinite(value) || value < limit.min || value > limit.max
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))} />
      {bad ? <small className="field-err">Isi antara {limit.min} dan {limit.max}{suffix}.</small> : null}
    </label>
  )
}

function Row({ label, hint, children }) {
  return (
    <div className="set-row">
      <div>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  )
}

export default function Settings() {
  const { config, draft, accounts, savedAt, recovered, setDraftGlobal, saveDraft, discardDraft, resetConfig, applyImportedConfig, pushToast } = useAppStore()
  const g = draft.global
  const [saving, setSaving] = useState(false)
  const [pending, setPending] = useState(null)
  const fileRef = useRef(null)

  const changes = useMemo(() => diffConfig(config, draft), [config, draft])
  const dirty = changes.length > 0
  const errors = validateConfig(draft)
  const saved = useMemo(() => sourceCount(accounts, config), [accounts, config])
  const preview = useMemo(() => sourceCount(accounts, draft), [accounts, draft])

  const save = async () => {
    setSaving(true)
    await saveDraft()
    setSaving(false)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const result = importConfig(await file.text())
    if (!result.ok) {
      pushToast(result.errors[0], 'warn')
      return
    }
    setPending({
      kind: 'import',
      title: 'Terapkan konfigurasi dari file?',
      description: `${file.name} akan menggantikan konfigurasi aktif. Perubahan:`,
      config: result.config,
      confirmLabel: 'Import configuration'
    })
  }

  const startReset = () =>
    setPending({
      kind: 'reset',
      title: 'Kembalikan ke konfigurasi default?',
      description: 'Semua pengaturan global dan platform akan kembali ke nilai awal. Perubahan:',
      config: resetToDefaults(),
      confirmLabel: 'Reset configuration'
    })

  const confirmPending = async () => {
    const ok = pending.kind === 'import' ? await applyImportedConfig(pending.config) : await resetConfig()
    if (ok) setPending(null)
  }

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Pengaturan global. Konfigurasi per platform ada di halaman detail platform.</p>
        </div>
        <ConfigurationStatus dirty={dirty} savedAt={savedAt} recovered={recovered} />
      </header>

      <section className="set-section">
        <h3>General</h3>
        <Row label="Nama aplikasi" hint="Tampil di sidebar dan judul tab.">
          <input className="set-input" value={g.appName} maxLength={40} onChange={(e) => setDraftGlobal({ appName: e.target.value })} aria-label="Nama aplikasi" />
        </Row>
        <Row label="Zona waktu" hint="Dipakai untuk menampilkan jam.">
          <select value={g.timezone} onChange={(e) => setDraftGlobal({ timezone: e.target.value })} aria-label="Zona waktu">
            {ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
        <Row label="Tema" hint="Saat ini hanya tersedia mode gelap.">
          <select disabled aria-label="Tema"><option>Dark</option></select>
        </Row>
      </section>

      <section className="set-section">
        <h3>Global monitoring</h3>
        <Row label="Global monitoring aktif" hint="Jika mati, pemeriksaan otomatis dijeda dan status terakhir mungkin tidak aktual.">
          <Switch checked={g.globalMonitoringEnabled} onChange={(v) => setDraftGlobal({ globalMonitoringEnabled: v })} label="Global monitoring aktif" />
        </Row>
        <div className="set-grid">
          <IntervalInput label="Default check interval" valueSeconds={g.defaultCheckIntervalSeconds} onChange={(v) => setDraftGlobal({ defaultCheckIntervalSeconds: v })} hint="Dipakai akun tanpa override platform atau akun." />
          <NumberField label="Default retry attempts" value={g.defaultRetryAttempts} limit={LIMITS.retryAttempts} onChange={(v) => setDraftGlobal({ defaultRetryAttempts: v })} />
          <NumberField label="Default retry delay (detik)" value={g.defaultRetryDelaySeconds} limit={LIMITS.retryDelay} suffix=" detik" onChange={(v) => setDraftGlobal({ defaultRetryDelaySeconds: v })} />
          <NumberField label="Default request timeout (ms)" value={g.defaultRequestTimeoutMs} limit={LIMITS.timeoutMs} suffix=" ms" onChange={(v) => setDraftGlobal({ defaultRequestTimeoutMs: v })} />
          <NumberField label="Maximum concurrent checks" value={g.maxConcurrentChecks} limit={LIMITS.concurrency} onChange={(v) => setDraftGlobal({ maxConcurrentChecks: v })} />
        </div>
        <p className="note">Batas angka adalah batas aplikasi ini, bukan batas resmi platform mana pun. Retry hanya dipakai saat pemeriksaan gagal, bukan saat akun terdeteksi offline.</p>
        <div className="preview">
          <strong>Sumber interval {accounts.length} akun</strong>
          <p>
            Tersimpan: {saved.account} khusus akun · {saved.platform} dari platform · {saved.global} dari global
            {dirty && (preview.global !== saved.global || preview.platform !== saved.platform) && <> → draft: {preview.account} · {preview.platform} · {preview.global}</>}
          </p>
        </div>
      </section>

      <section className="set-section">
        <h3>Dashboard</h3>
        <Row label="Dashboard refresh interval" hint="Hanya memperbarui tampilan, tidak memicu pemeriksaan akun.">
          <select value={g.dashboardRefreshIntervalSeconds} onChange={(e) => setDraftGlobal({ dashboardRefreshIntervalSeconds: Number(e.target.value) })} aria-label="Dashboard refresh interval">
            {REFRESH.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Row>
        <Row label="Tampilkan akun offline" hint="Berlaku di tabel Live Accounts saat filter status = semua.">
          <Switch checked={g.showOfflineAccounts} onChange={(v) => setDraftGlobal({ showOfflineAccounts: v })} label="Tampilkan akun offline" />
        </Row>
        <Row label="Tampilkan akun unknown atau error">
          <Switch checked={g.showUnknownAccounts} onChange={(v) => setDraftGlobal({ showUnknownAccounts: v })} label="Tampilkan akun unknown" />
        </Row>
        <Row label="Compact mode" hint="Merapatkan jarak pada Overview.">
          <Switch checked={g.compactMode} onChange={(v) => setDraftGlobal({ compactMode: v })} label="Compact mode" />
        </Row>
      </section>

      <section className="set-section">
        <h3>Configuration management</h3>
        {dirty && (
          <div className="preview">
            <strong>{changes.length} perubahan belum disimpan</strong>
            <ConfigurationDiff rows={changes} />
          </div>
        )}
        <div className="actions">
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving || errors.length > 0}>{saving ? 'Menyimpan…' : 'Save configuration'}</button>
          <button className="btn" onClick={discardDraft} disabled={!dirty}>Discard changes</button>
          <ExportConfigurationButton />
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={15} aria-hidden /> Import configuration</button>
          <button className="btn" onClick={startReset}><RotateCcw size={15} aria-hidden /> Reset configuration</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        {errors.length > 0 && <p className="field-err">{errors[0]}</p>}
      </section>

      <section className="set-section">
        <h3>System information</h3>
        <dl className="health">
          <div><dt>Configuration storage</dt><dd>Local (browser)</dd></div>
          <div><dt>Backend connection</dt><dd>Not configured</dd></div>
          <div><dt>Monitoring engine</dt><dd>Mock mode</dd></div>
          <div><dt>Last local configuration save</dt><dd>{savedAt ? clock(savedAt) : 'Belum pernah'}</dd></div>
        </dl>
      </section>

      {pending && (
        <ImportConfigurationModal
          title={pending.title}
          description={pending.description}
          rows={diffConfig(config, pending.config)}
          confirmLabel={pending.confirmLabel}
          onCancel={() => setPending(null)}
          onConfirm={confirmPending}
        />
      )}
    </div>
  )
}
