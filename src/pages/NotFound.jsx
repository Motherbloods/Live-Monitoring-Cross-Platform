import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty">
        <strong>Halaman tidak ditemukan</strong>
        <p>Alamat yang Anda buka tidak ada di Live Monitor.</p>
        <Link className="btn btn-small" to="/">Kembali ke Overview</Link>
      </div>
    </div>
  )
}
