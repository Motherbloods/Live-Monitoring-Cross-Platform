import { PLATFORMS } from '../../config/defaults.js'

const BUILD = {
  liveStart: (p) => [`${p.short} Live Started`, ['Account: @sample_creator', `Platform: ${p.short}`, 'Started At: 20:15', 'Live URL: Sample URL']],
  liveEnd: (p) => [`${p.short} Live Ended`, ['Account: @sample_creator', `Platform: ${p.short}`, 'Ended At: 21:40', 'Duration: 1j 25m']],
  serviceFail: (p) => [`${p.short} Service Failed`, [`Platform: ${p.short}`, 'Error: Request timeout', 'Retry: 3 dari 3']],
  serviceRecover: (p) => [`${p.short} Service Recovered`, [`Platform: ${p.short}`, 'Status: Online']],
  recordingStart: (p) => [`${p.short} Recording Started`, ['Account: @sample_creator', 'Format: TS']],
  recordingFail: (p) => [`${p.short} Recording Failed`, ['Account: @sample_creator', 'Reason: Stream tidak dapat diakses']]
}

export default function NotificationPreview({ platformId, event }) {
  const p = PLATFORMS.find((x) => x.id === platformId)
  const [title, lines] = (BUILD[event] || BUILD.liveStart)(p)
  return (
    <div className="tg-preview" aria-label="Contoh notifikasi">
      <strong>{title}</strong>
      {lines.map((l) => <span key={l}>{l}</span>)}
      <small>Contoh tampilan. Tidak terhubung ke Telegram.</small>
    </div>
  )
}
