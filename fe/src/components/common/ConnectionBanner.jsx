import { WifiOff } from 'lucide-react'
import { API_URL } from '../../api/client.js'
import { useAppStore } from '../../store/appStore.js'

export default function ConnectionBanner() {
  const { connection, hydrate } = useAppStore()
  if (connection !== 'offline') return null
  return (
    <div className="conn-banner" role="alert">
      <WifiOff size={15} aria-hidden />
      <span>Server di {API_URL} tidak terjangkau. Data yang tampil bisa kedaluwarsa.</span>
      <button className="btn btn-small" onClick={hydrate}>Coba lagi</button>
    </div>
  )
}
