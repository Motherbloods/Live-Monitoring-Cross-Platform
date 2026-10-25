import { Bell, Menu, Pause, Play, RefreshCw, Search } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore.js'
import { clock } from '../../utils/formatters.js'
import { getGlobalStatus } from '../../utils/effectiveConfig.js'
import { PLATFORM_IDS } from '../../config/defaults.js'

const TITLES = { '/': 'Overview', '/accounts': 'Live Accounts', '/platforms': 'Platforms', '/history': 'Live History', '/recordings': 'Recordings', '/notifications': 'Notifications', '/settings': 'Settings' }
const LABEL = { running: 'Running', partial: 'Partially running', stopped: 'Stopped', starting: 'Starting' }

export default function Topbar({ onMenu }) {
  const { config, platformRuntime, lastRefresh, refreshDashboard, toggleGlobalMonitoring } = useAppStore()
  const { pathname } = useLocation()
  const status = getGlobalStatus(config, platformRuntime)
  const enabled = PLATFORM_IDS.filter((id) => config.platforms[id].serviceEnabled).length
  const title = TITLES[pathname] || 'Platforms'

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Buka menu">
        <Menu size={18} />
      </button>
      <h2 className="topbar-title">{title}</h2>

      <label className="search">
        <Search size={15} aria-hidden />
        <input type="search" placeholder="Cari akun atau platform" aria-label="Cari" />
      </label>

      <div className="topbar-right">
        <div className={`global-pill tone-${status}`}>
          <span className="dot" />
          <div>
            <strong>{LABEL[status]}</strong>
            <small>{enabled} dari 5 service aktif</small>
          </div>
          <Link to="/platforms" className="pill-link">
            Platform
          </Link>
          <button className="icon-btn" onClick={toggleGlobalMonitoring} aria-label={config.global.globalMonitoringEnabled ? 'Jeda monitoring' : 'Lanjutkan monitoring'}>
            {config.global.globalMonitoringEnabled ? <Pause size={14} /> : <Play size={14} />}
          </button>
        </div>
        <span className="updated">Diperbarui {clock(lastRefresh)}</span>
        <button className="icon-btn" onClick={refreshDashboard} aria-label="Refresh tampilan">
          <RefreshCw size={16} />
        </button>
        <button className="icon-btn" aria-label="Notifikasi">
          <Bell size={16} />
        </button>
        <span className="avatar" aria-hidden>
          AD
        </span>
      </div>
    </header>
  )
}
