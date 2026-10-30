import { createBrowserRouter } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout.jsx'
import Overview from '../pages/Overview.jsx'
import LiveAccounts from '../pages/LiveAccounts.jsx'
import Platforms from '../pages/Platforms.jsx'
import PlatformDetails from '../pages/PlatformDetails.jsx'
import Settings from '../pages/Settings.jsx'
import Upcoming from '../pages/Upcoming.jsx'

const upcoming = (title, stage) => ({ element: <Upcoming title={title} stage={stage} /> })

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'accounts', element: <LiveAccounts /> },
      { path: 'platforms', element: <Platforms /> },
      { path: 'platforms/:platformId', element: <PlatformDetails /> },
      { path: 'history', ...upcoming('Live History', 6) },
      { path: 'recordings', ...upcoming('Recordings', 6) },
      { path: 'notifications', ...upcoming('Notifications', 6) },
      { path: 'settings', element: <Settings /> }
    ]
  }
])
