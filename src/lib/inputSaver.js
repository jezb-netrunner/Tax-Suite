// Saving the figures typed into the estimator (M06).
//
//   const saver = createInputSaver({ save, onError })
//   saver.schedule(changes)  // after each change: { field: newValue }
//   saver.busy()             // changes waiting or being saved
//   saver.dispose()          // when the estimator is left
//
// C07: the saver collects the fields changed since the last save and passes
// only those to save(changes), which merges them onto the newest stored
// figures (withChangedInputs), so a second tab on the same estimator never
// writes back its old copy of the fields it did not change.
//
// Figures are saved `delay` ms after the last change (no write on every
// keystroke), and at once when the page is hidden (switching apps or tabs,
// locking a phone), closed or reloaded ("pagehide"), or when the estimator is
// left. In local mode the browser-storage write happens inside that event, so
// it is done before the page goes away. A failed save is never swallowed:
// onError gets "Couldn't save your figures." with the original error as its
// cause.

export const FIGURES_NOT_SAVED = "Couldn't save your figures."

export const SAVE_DELAY_MS = 900

export function createInputSaver({ save, onError, onSettled, delay = SAVE_DELAY_MS, win = globalThis.window, doc = globalThis.document }) {
  let pending = null // { values }: the fields changed since the last save
  let timer = null
  let inFlight = 0 // saves started and not finished

  function report(cause) {
    const err = new Error(FIGURES_NOT_SAVED, { cause })
    if (err.cause !== cause) err.cause = cause // older browsers ignore the option
    if (onError) onError(err)
  }

  function flush() {
    clearTimeout(timer)
    timer = null
    if (!pending) return
    const { values } = pending
    pending = null
    inFlight++
    // After each save, ok or not (onSettled: e.g. show the stored figures again).
    const settle = () => { inFlight--; if (onSettled) onSettled() }
    let result
    try {
      result = save(values)
    } catch (e) {
      settle()
      report(e)
      return
    }
    Promise.resolve(result).then(settle, e => { settle(); report(e) })
  }

  const onPageHide = () => flush()
  const onVisibility = () => { if (doc.visibilityState === 'hidden') flush() }
  const listening = {
    win: Boolean(win && typeof win.addEventListener === 'function'),
    doc: Boolean(doc && typeof doc.addEventListener === 'function'),
  }
  if (listening.win) win.addEventListener('pagehide', onPageHide)
  if (listening.doc) doc.addEventListener('visibilitychange', onVisibility)

  return {
    schedule(changes) {
      pending = { values: { ...(pending ? pending.values : {}), ...changes } }
      clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
    busy: () => pending !== null || inFlight > 0,
    dispose() {
      flush()
      if (listening.win) win.removeEventListener('pagehide', onPageHide)
      if (listening.doc) doc.removeEventListener('visibilitychange', onVisibility)
    },
  }
}

// C07: what an open estimator shows after the stored figures for its mode
// changed (another tab saved them, or the profile list was reloaded): the
// stored figures, unless this tab has changes of its own waiting to be saved
// or being saved (busy), which win until they are stored. Returns `shown`
// itself when nothing differs, so nothing re-renders.
export function figuresToShow(shown, stored, busy) {
  if (busy) return shown
  const next = { ...(stored || {}) }
  const keys = new Set([...Object.keys(shown || {}), ...Object.keys(next)])
  for (const k of keys) {
    if (JSON.stringify(shown?.[k]) !== JSON.stringify(next[k])) return next
  }
  return shown
}
