import { Bell, LogOut, Menu, Pause, Play, RefreshCw, Search } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore.js'
import { clock } from '../../utils/formatters.js'
import { getGlobalStatus } from '../../utils/effectiveConfig.js'
import { API_MODE } from '../../api/client.js'
import { PLATFORM_IDS } from '../../config/defaults.js'

const TITLES = { '/': 'Overview', '/accounts': 'Live Accounts', '/platforms': 'Platforms', '/history': 'Live History', '/recordings': 'Recordings', '/notifications': 'Notifications', '/settings': 'Settings' }
const LABEL = { running: 'Running', partial: 'Partially running', stopped: 'Stopped', starting: 'Starting' }

export default function Topbar({ onMenu }) {
  const { config, platformRuntime, lastRefresh, refreshDashboard, toggleGlobalMonitoring, user, logout } = useAppStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const submitSearch = (e) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q').toString().trim()
    if (q) navigate(`/accounts?q=${encodeURIComponent(q)}`)
  }
  const status = getGlobalStatus(config, platformRuntime)
  const enabled = PLATFORM_IDS.filter((id) => config.platforms[id].serviceEnabled).length
  const title = TITLES[pathname] || 'Platforms'

  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Buka menu">
        <Menu size={18} />
      </button>
      <h2 className="topbar-title">{title}</h2>

      <form className="search" onSubmit={submitSearch} role="search">
        <Search size={15} aria-hidden />
        <input type="search" name="q" placeholder="Cari akun lalu tekan Enter" aria-label="Cari akun" />
      </form>

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
        <Link className="icon-btn" to="/notifications" aria-label="Pengaturan notifikasi">
          <Bell size={16} />
        </Link>
        <span className="avatar" title={user?.username || 'Admin'} aria-hidden>
          {(user?.username || 'AD').slice(0, 2).toUpperCase()}
        </span>
        {API_MODE === 'http' && (
          <button className="icon-btn" onClick={logout} aria-label="Keluar" title="Keluar">
            <LogOut size={16} />
          </button>
        )}
      </div>
    </header>
  )
}
