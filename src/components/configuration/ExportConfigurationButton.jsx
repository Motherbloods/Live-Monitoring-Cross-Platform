import { Download } from 'lucide-react'
import { exportConfig } from '../../config/configurationManager.js'
import { useAppStore } from '../../store/appStore.js'

export default function ExportConfigurationButton() {
  const config = useAppStore((s) => s.config)
  const pushToast = useAppStore((s) => s.pushToast)

  const download = () => {
    const blob = new Blob([exportConfig(config)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `live-monitor-config-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('Konfigurasi diekspor. Berisi pengaturan saja, tanpa status runtime atau rahasia.', 'ok')
  }

  return (
    <button className="btn" onClick={download}>
      <Download size={15} aria-hidden /> Export configuration
    </button>
  )
}
