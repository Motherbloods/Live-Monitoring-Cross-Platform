import { useState } from 'react'
import { Ticket } from 'lucide-react'
import { API_MODE } from '../api/client.js'
import { useAppStore } from '../store/appStore.js'
import useSubscription from '../hooks/useSubscription.js'
import CodeCreateForm from '../components/subscribers/CodeCreateForm.jsx'
import CodesTable from '../components/subscribers/CodesTable.jsx'
import NewCodesModal from '../components/subscribers/NewCodesModal.jsx'
import SubscribersTable from '../components/subscribers/SubscribersTable.jsx'
import SubscriptionSettingsForm from '../components/subscribers/SubscriptionSettingsForm.jsx'
import ErrorState from '../components/common/ErrorState.jsx'

export default function Subscribers() {
  const { data, loading, error, reload, run } = useSubscription()
  const pushToast = useAppStore((s) => s.pushToast)
  const copyBotLink = async (name) => {
    try {
      await navigator.clipboard.writeText(`https://t.me/${name}`)
      pushToast('Tautan bot disalin.', 'ok')
    } catch {
      pushToast(`Tautan bot: https://t.me/${name}`, 'info')
    }
  }
  const [newCodes, setNewCodes] = useState(null)

  if (API_MODE !== 'http') {
    return (
      <div className="page">
        <div className="empty"><Ticket size={22} aria-hidden /><strong>Fitur ini butuh server</strong><p>Isi VITE_API_URL agar halaman Subscribers terhubung ke server.</p></div>
      </div>
    )
  }
  if (loading) return <div className="page"><p className="note">Memuat…</p></div>
  if (error && !data) return <ErrorState title="Data langganan tidak bisa dimuat" message={error} onRetry={reload} />

  const { settings, codes, subscribers, stats, bot } = data
  const items = [
    ['Kode belum dipakai', stats.unusedCodes],
    ['Pelanggan aktif', stats.activeSubscribers],
    ['Akun dipantau pelanggan', stats.followedAccounts],
    ['Kode terpakai', stats.redeemedCodes]
  ]

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Subscribers</h1>
          <p>Kode langganan dan pelanggan Telegram.</p>
        </div>
      </header>

      <div className={`bot-line ${bot.running ? 'is-ok' : 'is-warn'}`}>
        {bot.running
          ? <><span>Bot pembeli aktif: <strong>@{bot.username}</strong></span><button className="btn btn-small" onClick={() => copyBotLink(bot.username)}>Salin tautan bot</button></>
          : <span>{bot.configured ? `Bot pembeli belum berjalan: ${bot.lastError || 'sedang memulai'}` : 'Bot pembeli belum aktif. Isi SUBSCRIBER_BOT_TOKEN di server/.env lalu restart server.'}</span>}
        {bot.running && bot.lastError && <small className="field-err">{bot.lastError}</small>}
      </div>

      <section className="stats stats-4" aria-label="Ringkasan langganan">
        {items.map(([label, value]) => (
          <div key={label} className="stat"><span className="stat-value">{value}</span><span className="stat-label">{label}</span><small>&nbsp;</small></div>
        ))}
      </section>

      <section className="section">
        <div className="section-head"><h3>Buat kode</h3></div>
        <CodeCreateForm settings={settings} run={run} onCreated={setNewCodes} />
      </section>

      <section className="section">
        <div className="section-head"><h3>Kode</h3></div>
        <CodesTable codes={codes} run={run} />
      </section>

      <section className="section">
        <div className="section-head"><h3>Pelanggan</h3></div>
        <SubscribersTable subscribers={subscribers} settings={settings} run={run} />
      </section>

      <section className="section">
        <details>
          <summary className="section-summary">Pengaturan langganan</summary>
          <SubscriptionSettingsForm settings={settings} run={run} />
        </details>
      </section>

      {newCodes && <NewCodesModal codes={newCodes} botUsername={bot.running ? bot.username : null} onClose={() => setNewCodes(null)} />}
    </div>
  )
}
