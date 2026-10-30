import { useAppStore } from '../store/appStore.js'
import { resolveAccountNotifications } from '../utils/effectiveConfig.js'
import NotificationSettingsForm from '../components/notifications/NotificationSettingsForm.jsx'

export default function Notifications() {
  const { accounts, config } = useAppStore()
  const active = accounts.filter((a) => resolveAccountNotifications(a, config).enabled).length

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Notifications</h1>
          <p>Telegram. {active} dari {accounts.length} akun memiliki notifikasi aktif.</p>
        </div>
      </header>
      <NotificationSettingsForm />
    </div>
  )
}
