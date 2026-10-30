import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore.js'

export default function AuthGate({ children }) {
  const auth = useAppStore((s) => s.auth)
  const checkSession = useAppStore((s) => s.checkSession)

  useEffect(() => {
    if (auth === 'checking') checkSession()
  }, [auth, checkSession])

  if (auth === 'checking') return <div className="splash" aria-busy="true">Memeriksa sesi…</div>
  if (auth === 'anonymous') return <Navigate to="/login" replace />
  return children
}
