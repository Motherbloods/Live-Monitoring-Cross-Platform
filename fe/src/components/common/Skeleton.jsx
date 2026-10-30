export default function PageSkeleton() {
  return (
    <div className="page" aria-busy="true" aria-label="Memuat halaman">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="sk-strip">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk sk-stat" />)}
      </div>
      <div className="sk-grid">
        {[0, 1, 2].map((i) => <div key={i} className="sk sk-card" />)}
      </div>
    </div>
  )
}
