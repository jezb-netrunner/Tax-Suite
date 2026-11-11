// Audit Nov 11, 2026: a notice on every page, and on every printout, once the
// rulebook is more than STALE_AFTER_DAYS days old (src/lib/rulesAge.js).
import { useManilaToday } from '../lib/useManilaToday.js'
import { rulesAge, staleRulesText } from '../lib/rulesAge.js'

export default function StaleRulesNotice() {
  const today = useManilaToday()
  const text = staleRulesText(rulesAge(today))
  if (!text) return null
  return (
    <div className="wrap stale-rules" style={{ marginTop: '18px' }}>
      <div className="mini-warn" role="note" style={{ marginTop: 0, fontSize: '13px', fontWeight: 600 }}>{text}</div>
    </div>
  )
}
