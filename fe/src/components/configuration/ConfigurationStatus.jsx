import { API_MODE } from '../../api/client.js'
import { clock } from '../../utils/formatters.js'

export default function ConfigurationStatus({ dirty, savedAt, recovered }) {
  return (
    <div className="cfg-status">
      <span className={`cfg-pill ${dirty ? 'is-dirty' : 'is-saved'}`}>{dirty ? 'Unsaved changes' : API_MODE === 'http' ? 'Saved to server' : 'Saved locally'}</span>
      {API_MODE !== 'http' && <span className="cfg-pill">Pending backend integration</span>}
      <small>{savedAt ? `Disimpan ${clock(savedAt)}` : 'Memakai default bawaan'}</small>
      {recovered && <small className="field-err">Data lokal rusak, default dipulihkan.</small>}
    </div>
  )
}
