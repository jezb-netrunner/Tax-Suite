// Small per-profile marks (deadlines marked filed, ticked checklist items),
// saved through the app's normal profile save.
//
//   const { profile, update, error } = useProfileMarks(app)
//   update(p => withFiled(p, key, true, today))
//
// `profile` is the active profile with any not-yet-saved marks applied, so a
// click shows at once. Saves run one after another, each built on the newest
// marks, so two quick clicks never undo each other.
//
// C07: each save applies the change to the newest STORED profile
// (app.updateProfile), not to this tab's copy, so figures typed or settings
// changed in another tab are never undone, and a profile deleted there is not
// re-created.

import { useCallback, useRef, useState } from 'react'

export function useProfileMarks(app) {
  const active = app.active
  const activeRef = useRef(active)
  activeRef.current = active
  const pendingRef = useRef(null) // { id, profile } not yet saved
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  const chain = useRef(Promise.resolve())

  const update = useCallback(change => {
    const cur = activeRef.current
    if (!cur) return
    const base = pendingRef.current && pendingRef.current.id === cur.id ? pendingRef.current.profile : cur
    const next = change(base)
    pendingRef.current = { id: cur.id, profile: next }
    setPending(pendingRef.current)
    setError(null)
    chain.current = chain.current
      .then(() => app.updateProfile(cur.id, change))
      .then(() => {
        if (pendingRef.current && pendingRef.current.profile === next) {
          pendingRef.current = null
          setPending(null)
        }
      })
      .catch(e => {
        pendingRef.current = null
        setPending(null)
        setError((e && e.message) || 'Could not save this change.')
      })
  }, [app])

  const profile = pending && active && pending.id === active.id ? pending.profile : active
  return { profile, update, error }
}
