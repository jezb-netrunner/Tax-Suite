// A small notice for a background save that failed (estimator figures, filed
// marks), e.g. "This profile was deleted in another window." Shown on every
// page until dismissed, because the save may fail after the user has left the
// page where the figures were typed.
import { useApp } from '../state/AppState.jsx'

// The text shown for a failed save: its message, then its cause's message.
export function saveProblemText(err) {
  if (!err) return ''
  const parts = [err.message, err.cause && err.cause.message].filter(Boolean)
  return parts.join(' ')
}

export default function SaveNotice() {
  const app = useApp()
  const err = app && app.saveProblem
  if (!err) return null
  return (
    <div className="wrap" style={{ marginTop: '18px' }}>
      {/* #943b2c on the notice background: 6.0:1 (WCAG AA). */}
      <div className="form-err" role="alert" style={{ display: 'flex', gap: '12px', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 0, color: '#943b2c' }}>
        <span>{saveProblemText(err)}</span>
        <button className="linkbtn" type="button" style={{ color: 'inherit', textDecoration: 'underline', minHeight: '24px', padding: '2px 4px' }} onClick={() => app.clearSaveProblem()}>Dismiss</button>
      </div>
    </div>
  )
}
