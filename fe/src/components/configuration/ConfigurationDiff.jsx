export default function ConfigurationDiff({ rows }) {
  if (!rows.length) return <p className="note">Tidak ada perbedaan dengan konfigurasi saat ini.</p>
  return (
    <ul className="diff">
      {rows.map((r) => (
        <li key={r.label}>
          <span>{r.label}</span>
          <span className="diff-before">{r.before}</span>
          <span aria-hidden>→</span>
          <strong>{r.after}</strong>
        </li>
      ))}
    </ul>
  )
}
