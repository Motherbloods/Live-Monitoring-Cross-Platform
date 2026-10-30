import { TriangleAlert } from 'lucide-react'

export default function ErrorState({ title = 'Terjadi masalah saat menampilkan halaman', message = 'Coba muat ulang halaman ini. Pengaturan Anda tidak terpengaruh.', onRetry }) {
  return (
    <div className="page">
      <div className="empty">
        <TriangleAlert size={22} aria-hidden />
        <strong>{title}</strong>
        <p>{message}</p>
        {onRetry && <button className="btn btn-small" onClick={onRetry}>Coba lagi</button>}
      </div>
    </div>
  )
}
