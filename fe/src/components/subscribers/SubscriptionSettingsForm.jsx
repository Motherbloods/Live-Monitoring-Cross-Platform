import { useMemo, useState } from 'react'
import { PLATFORMS } from '../../config/defaults.js'
import { serverApi } from '../../api/serverApi.js'

const OFFERED = ['tiktok', 'bigo', 'twitch', 'youtube']

const toForm = (s) => ({ ...s, blocklistText: s.blocklist.join('\n'), caps: Object.fromEntries(OFFERED.map((id) => [id, s.platformCaps[id] ?? ''])) })

export default function SubscriptionSettingsForm({ settings, run }) {
  const initial = useMemo(() => toForm(settings), [settings])
  const [form, setForm] = useState(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const toggle = (id) => set({ allowedPlatforms: form.allowedPlatforms.includes(id) ? form.allowedPlatforms.filter((x) => x !== id) : [...form.allowedPlatforms, id] })

  const save = (e) => {
    e.preventDefault()
    const caps = Object.fromEntries(Object.entries(form.caps).filter(([, v]) => v !== '').map(([id, v]) => [id, Number(v)]))
    run(() => serverApi.patchSubscriptionSettings({
      allowedPlatforms: form.allowedPlatforms,
      defaultMaxAccounts: Number(form.defaultMaxAccounts),
      defaultDurationDays: Number(form.defaultDurationDays),
      changesPerWeek: Number(form.changesPerWeek),
      platformCaps: caps,
      blocklist: form.blocklistText.split('\n').map((l) => l.trim()).filter(Boolean),
      contactText: form.contactText
    }), 'Pengaturan langganan disimpan.')
  }

  return (
    <form onSubmit={save} noValidate className="sub-settings">
      <div className="form-grid">
        <label className="field"><span>Jatah akun bawaan per kode</span><input type="number" min="1" max="50" value={form.defaultMaxAccounts} onChange={(e) => set({ defaultMaxAccounts: e.target.value })} /></label>
        <label className="field"><span>Masa aktif bawaan (hari)</span><input type="number" min="1" max="3650" value={form.defaultDurationDays} onChange={(e) => set({ defaultDurationDays: e.target.value })} /></label>
        <label className="field"><span>Batas penggantian akun per minggu</span><input type="number" min="0" max="50" value={form.changesPerWeek} onChange={(e) => set({ changesPerWeek: e.target.value })} /><small>0 berarti tanpa batas.</small></label>
      </div>

      <div className="field"><span>Platform yang boleh dipilih pembeli</span>
        <div className="checks">
          {OFFERED.map((id) => <label className="check" key={id}><input type="checkbox" checked={form.allowedPlatforms.includes(id)} onChange={() => toggle(id)} /> {PLATFORMS.find((p) => p.id === id).short}</label>)}
        </div>
      </div>

      <div className="form-grid">
        {OFFERED.filter((id) => form.allowedPlatforms.includes(id)).map((id) => (
          <label className="field" key={id}><span>Kapasitas total {PLATFORMS.find((p) => p.id === id).short}</span><input type="number" min="1" max="1000" value={form.caps[id]} onChange={(e) => set({ caps: { ...form.caps, [id]: e.target.value } })} /><small>Jumlah akun aktif maksimum di platform ini.</small></label>
        ))}
      </div>

      <label className="field"><span>Daftar blokir (satu per baris, bentuk platform:username)</span><textarea rows={3} value={form.blocklistText} onChange={(e) => set({ blocklistText: e.target.value })} placeholder="tiktok:nama_akun" /></label>
      <label className="field"><span>Teks di bot saat pembeli menekan Start</span><textarea rows={3} maxLength={500} value={form.contactText} onChange={(e) => set({ contactText: e.target.value })} /></label>

      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={!dirty}>Simpan pengaturan</button>
        <button className="btn" type="button" disabled={!dirty} onClick={() => setForm(initial)}>Batalkan perubahan</button>
      </div>
    </form>
  )
}
