// Saving the figures typed into the estimator (M06).
//
//   const saver = createInputSaver({ save, onError })
//   saver.schedule(values)   // after each change
//   saver.dispose()          // when the estimator is left
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

export function createInputSaver({ save, onError, delay = SAVE_DELAY_MS, win = globalThis.window, doc = globalThis.document }) {
  let pending = null // { values } waiting to be saved
  let timer = null

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
    let result
    try {
      result = save(values)
    } catch (e) {
      report(e)
      return
    }
    Promise.resolve(result).catch(report)
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
    schedule(values) {
      pending = { values }
      clearTimeout(timer)
      timer = setTimeout(flush, delay)
    },
    flush,
    dispose() {
      flush()
      if (listening.win) win.removeEventListener('pagehide', onPageHide)
      if (listening.doc) doc.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
