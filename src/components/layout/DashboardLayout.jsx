import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import Toasts from '../common/Toasts.jsx'
import { useAppStore } from '../../store/appStore.js'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const refresh = useAppStore((s) => s.refreshDashboard)
  const seconds = useAppStore((s) => s.config.global.dashboardRefreshIntervalSeconds)
  const compactMode = useAppStore((s) => s.config.global.compactMode)
  const { pathname } = useLocation()

  useEffect(() => {
    if (!seconds) return undefined
    const t = setInterval(refresh, seconds * 1000)
    return () => clearInterval(t)
  }, [seconds, refresh])

  useEffect(() => setOpen(false), [pathname])

  return (
    <div className={`shell ${collapsed ? 'shell-collapsed' : ''} ${compactMode ? 'compact' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <main>
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  )
}
