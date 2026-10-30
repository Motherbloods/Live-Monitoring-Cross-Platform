import { Hammer } from 'lucide-react'

export default function Upcoming({ title, stage }) {
  return (
    <div className="page">
      <header className="page-head">
        <h1>{title}</h1>
      </header>
      <div className="empty">
        <Hammer size={22} aria-hidden />
        <strong>Halaman ini belum dikerjakan</strong>
        <p>Dijadwalkan pada tahap {stage} dari rencana implementasi. Rute dan navigasinya sudah aktif.</p>
      </div>
    </div>
  )
}
