import { useEffect, useId, useRef, useState } from 'react'

// A box that scrolls sideways on narrow screens (wide tables on the
// References page). It is a focusable, labelled region, so it can be scrolled
// with the keyboard, and when there is more to the right a visible line says
// so (audit Nov 2026, U7; the calendar's Table view does the same, L14).
export default function ScrollRegion({ label, className = 'ref-scroll', children }) {
  const ref = useRef(null)
  const cueId = useId()
  const [overflows, setOverflows] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const check = () => setOverflows(el.scrollWidth > el.clientWidth + 1)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    if (ro) ro.observe(el)
    window.addEventListener('resize', check)
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', check) }
  }, [])
  return (
    <>
      {overflows && (
        <p id={cueId} className="scroll-cue">
          More columns are to the right: scroll the table sideways <span aria-hidden="true">→</span>
        </p>
      )}
      <div ref={ref} className={className} role="region" aria-label={label} tabIndex={0}
        aria-describedby={overflows ? cueId : undefined}>
        {children}
      </div>
    </>
  )
}
