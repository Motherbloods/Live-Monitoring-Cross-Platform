import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Topbar from './Topbar.jsx'
import ConnectionBanner from '../common/ConnectionBanner.jsx'
import { API_MODE } from '../../api/client.js'
import ErrorBoundary from '../common/ErrorBoundary.jsx'
import PageSkeleton from '../common/Skeleton.jsx'
import Toasts from '../common/Toasts.jsx'
import { useAppStore } from '../../store/appStore.js'

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const refresh = useAppStore((s) => s.refreshDashboard)
  const hydrate = useAppStore((s) => s.hydrate)
  const ready = useAppStore((s) => s.ready)
  const seconds = useAppStore((s) => s.config.global.dashboardRefreshIntervalSeconds)
  const compactMode = useAppStore((s) => s.config.global.compactMode)
  const { pathname } = useLocation()
  const appName = useAppStore((s) => s.config.global.appName)

  useEffect(() => {
    document.title = appName
  }, [appName])

  useEffect(() => {
    if (!seconds) return undefined
    const t = setInterval(refresh, seconds * 1000)
    return () => clearInterval(t)
  }, [seconds, refresh])

  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (API_MODE === 'http') hydrate()
  }, [hydrate])

  useEffect(() => {
    if (API_MODE === 'http') return undefined
    const t = setTimeout(() => setLoading(false), 650)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className={`shell ${collapsed ? 'shell-collapsed' : ''} ${compactMode ? 'compact' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} open={open} onNavigate={() => setOpen(false)} />
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <Topbar onMenu={() => setOpen(true)} />
        <ConnectionBanner />
        <main key={pathname} className="page-enter">
          <ErrorBoundary resetKey={pathname}>{(API_MODE === 'http' ? !ready : loading) ? <PageSkeleton /> : <Outlet />}</ErrorBoundary>
        </main>
      </div>
      <Toasts />
    </div>
  )
}
