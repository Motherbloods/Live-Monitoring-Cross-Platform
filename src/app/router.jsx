import { createBrowserRouter } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout.jsx'
import Overview from '../pages/Overview.jsx'
import LiveAccounts from '../pages/LiveAccounts.jsx'
import Platforms from '../pages/Platforms.jsx'
import PlatformDetails from '../pages/PlatformDetails.jsx'
import Settings from '../pages/Settings.jsx'
import LiveHistory from '../pages/LiveHistory.jsx'
import Recordings from '../pages/Recordings.jsx'
import Notifications from '../pages/Notifications.jsx'
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
      { path: 'history', element: <LiveHistory /> },
      { path: 'recordings', element: <Recordings /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'settings', element: <Settings /> }
    ]
  }
])
