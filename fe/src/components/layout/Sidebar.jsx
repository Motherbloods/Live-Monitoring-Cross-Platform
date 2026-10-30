import { NavLink } from 'react-router-dom'
import { Activity, Bell, Clapperboard, History, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Radio, Server, Settings, Users } from 'lucide-react'
import { useAppStore } from '../../store/appStore.js'
import { computeStats, getGlobalStatus } from '../../utils/effectiveConfig.js'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Live Accounts', icon: Users },
  { to: '/platforms', label: 'Platforms', icon: Server },
  { to: '/history', label: 'Live History', icon: History },
  { to: '/recordings', label: 'Recordings', icon: Clapperboard },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings }
]

const GLOBAL_LABEL = { running: 'Running', partial: 'Partially running', stopped: 'Stopped', starting: 'Starting' }

export default function Sidebar({ collapsed, onToggle, open, onNavigate }) {
  const { accounts, runtime, platformRuntime, config } = useAppStore()
  const stats = computeStats(accounts, runtime, platformRuntime, config)
  const global = getGlobalStatus(config, platformRuntime)
  const platformErrors = stats.degradedServices + (stats.activeServices < 5 - stats.disabledServices ? 1 : 0)

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${open ? 'is-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark">
          <Radio size={16} aria-hidden />
        </span>
        <span className="brand-name">{config.global.appName}</span>
      </div>

      <nav aria-label="Navigasi utama">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="nav-item" data-tip={label} onClick={onNavigate}>
            <Icon size={17} aria-hidden />
            <span className="nav-label">{label}</span>
            {to === '/platforms' && platformErrors > 0 && <span className="nav-badge">{platformErrors}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sys">
        <div className="sys-head">
          <Activity size={14} aria-hidden />
          <span className="sys-title">System status</span>
        </div>
        <dl className="sys-list">
          <div>
            <dt>Global</dt>
            <dd className={`tone-${global}`}>{GLOBAL_LABEL[global]}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{stats.activeServices}</dd>
          </div>
          <div>
            <dt>Degraded</dt>
            <dd>{stats.degradedServices}</dd>
          </div>
          <div>
            <dt>Disabled</dt>
            <dd>{stats.disabledServices}</dd>
          </div>
        </dl>
      </div>

      <button className="collapse-btn" onClick={onToggle} aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}>
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        <span className="nav-label">Ciutkan</span>
      </button>
    </aside>
  )
}
