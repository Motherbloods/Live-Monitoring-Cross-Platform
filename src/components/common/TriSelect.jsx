const toValue = (v) => (v === undefined || v === null ? 'inherit' : v ? 'on' : 'off')

export default function TriSelect({ value, onChange, label }) {
  return (
    <select value={toValue(value)} aria-label={label} onChange={(e) => onChange(e.target.value === 'inherit' ? undefined : e.target.value === 'on')}>
      <option value="inherit">Ikut global</option>
      <option value="on">Aktif</option>
      <option value="off">Mati</option>
    </select>
  )
}
