import { useState } from 'react'
import { LIMITS } from '../../config/defaults.js'

export default function IntervalInput({ label, valueSeconds, onChange, hint }) {
  const [unit, setUnit] = useState(valueSeconds >= 120 && valueSeconds % 60 === 0 ? 60 : 1)
  const { min, max } = LIMITS.interval
  const shown = Number.isFinite(valueSeconds) ? valueSeconds / unit : ''
  const invalid = !Number.isFinite(valueSeconds) || valueSeconds < min || valueSeconds > max

  return (
    <div className="field">
      <span>{label}</span>
      <div className="unit-input">
        <input type="number" min="0" value={shown} onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value) * unit)} aria-label={label} />
        <select value={unit} onChange={(e) => setUnit(Number(e.target.value))} aria-label="Satuan">
          <option value={1}>detik</option>
          <option value={60}>menit</option>
        </select>
      </div>
      {invalid ? <small className="field-err">Isi antara {min} dan {max} detik.</small> : hint && <small>{hint}</small>}
    </div>
  )
}
