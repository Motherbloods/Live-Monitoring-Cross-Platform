import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Radio } from 'lucide-react'
import { API_MODE, API_URL } from '../api/client.js'
import { PLATFORMS } from '../config/defaults.js'
import { useAppStore } from '../store/appStore.js'

export default function Login() {
  const { auth, connection, login, checkSession } = useAppStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (auth === 'checking') checkSession()
  }, [auth, checkSession])

  if (API_MODE !== 'http' || auth === 'authenticated') return <Navigate to="/" replace />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Isi username dan kata sandi.')
      return
    }
    setBusy(true)
    const result = await login(username.trim(), password)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      setPassword('')
    }
  }

  return (
    <div className="login">
      <aside className="login-side" aria-hidden>
        <div className="login-bars">
          {PLATFORMS.map((p) => <span key={p.id} style={{ background: p.color }} />)}
        </div>
        <p>Pantau semua live dari satu tempat.</p>
      </aside>

      <main className="login-main">
        <form onSubmit={submit} noValidate>
          <div className="brand">
            <span className="brand-mark"><Radio size={16} aria-hidden /></span>
            <span className="brand-name">Live Monitor</span>
          </div>
          <h1>Masuk</h1>
          <p className="login-sub">Dashboard ini hanya untuk admin.</p>

          {connection === 'offline' && <p className="login-error" role="alert">Server di {API_URL} tidak terjangkau.</p>}

          <label className="field">
            <span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus maxLength={100} />
          </label>
          <label className="field">
            <span>Kata sandi</span>
            <div className="pw">
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={200} />
              <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="btn btn-primary login-submit" type="submit" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
        </form>
      </main>
    </div>
  )
}
