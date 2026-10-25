import { createBrowserRouter } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout.jsx'
import Overview from '../pages/Overview.jsx'
import Upcoming from '../pages/Upcoming.jsx'

const upcoming = (title, stage) => ({ element: <Upcoming title={title} stage={stage} /> })

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'accounts', ...upcoming('Live Accounts', 3) },
      { path: 'platforms', ...upcoming('Platforms', 4) },
      { path: 'platforms/:platformId', ...upcoming('Platform Details', 4) },
      { path: 'history', ...upcoming('Live History', 6) },
      { path: 'recordings', ...upcoming('Recordings', 6) },
      { path: 'notifications', ...upcoming('Notifications', 6) },
      { path: 'settings', ...upcoming('Settings', 5) }
    ]
  }
])
