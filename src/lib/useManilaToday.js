// React hook: today's calendar date in Manila (see manilaToday in
// src/engine/dates.js), kept current on screens left open: it updates at the
// next Manila midnight and whenever the tab becomes visible or regains focus
// (timers are paused in background tabs and on sleeping devices).
// Returns the same Date object until the Manila date actually changes.

import { useEffect, useState } from 'react'
import { manilaToday, msUntilManilaMidnight, iso } from '../engine/dates.js'

export function useManilaToday() {
  const [day, setDay] = useState(() => manilaToday())

  useEffect(() => {
    let timer = null
    const refresh = () => setDay(prev => {
      const now = manilaToday()
      return iso(now) === iso(prev) ? prev : now
    })
    const schedule = () => {
      clearTimeout(timer)
      // A little past midnight so the new date is certain when it fires.
      timer = setTimeout(() => { refresh(); schedule() }, msUntilManilaMidnight() + 500)
    }
    const wake = () => {
      if (document.visibilityState === 'hidden') return
      refresh()
      schedule()
    }
    schedule()
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [])

  return day
}
