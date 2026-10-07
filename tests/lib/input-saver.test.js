// M06: estimator figures were saved only 0.9 s after typing stopped, so a
// reload or a closed tab within that time lost the last figures, and a failed
// save was swallowed (.catch(() => {})). Pending figures are now saved at once
// when the page is hidden or closed (visibilitychange, pagehide) and when the
// estimator is left; a failed save becomes "Couldn't save your figures." with
// the original error as its cause.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createInputSaver, FIGURES_NOT_SAVED } from '../../src/lib/inputSaver.js'
import { createBackend, LS_KEY } from '../../src/lib/backend.js'
import { withInputs } from '../../src/engine/profile.js'
import { saveProblemText } from '../../src/components/SaveNotice.jsx'
import { memoryStorage } from './backend-fakes.js'

function fakePage() {
  const win = new EventTarget()
  const doc = new EventTarget()
  doc.visibilityState = 'visible'
  return {
    win, doc,
    hide() { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')) },
    show() { doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')) },
    close() { win.dispatchEvent(new Event('pagehide')) },
  }
}

// A local-mode backend with one saved profile, as in the audit (profile Ana).
function anaBackend() {
  const storage = memoryStorage({ [LS_KEY]: JSON.stringify([{ id: 'ana', name: 'Ana Freelancer', type: 'individual', inputs: { individual: { gross: 480000, expenses: 180000 } } }]) })
  const be = createBackend({ storage })
  const saved = () => JSON.parse(storage.getItem(LS_KEY))[0].inputs.individual
  const save = values => be.updateProfile(null, 'ana', p => withInputs(p, 'individual', values))
  return { be, saved, save, storage }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('M06 figures are saved when typing stops, and at once when the page goes away', () => {
  it('saves once, 0.9 s after the last change, with the newest figures', () => {
    const page = fakePage()
    const save = vi.fn(async () => {})
    const s = createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    s.schedule({ expenses: 1 })
    vi.advanceTimersByTime(500)
    s.schedule({ expenses: 12 })
    vi.advanceTimersByTime(899)
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(save.mock.calls).toEqual([[{ expenses: 12 }]])
  })

  it('reload 300 ms after typing (audit case): the page is hidden and the figure is already in storage', () => {
    const page = fakePage()
    const { saved, save } = anaBackend()
    const s = createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    s.schedule({ gross: 480000, expenses: 123456 })
    vi.advanceTimersByTime(300)
    page.hide() // no await: the browser may unload right after this event
    expect(saved()).toEqual({ gross: 480000, expenses: 123456 })
  })

  it('closing the tab (pagehide) saves the pending figures at once', () => {
    const page = fakePage()
    const { saved, save } = anaBackend()
    const s = createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    s.schedule({ gross: 480000, expenses: 222222 })
    page.close()
    expect(saved()).toEqual({ gross: 480000, expenses: 222222 })
  })

  it('leaving the estimator (dispose) saves the pending figures and stops listening', () => {
    const page = fakePage()
    const save = vi.fn(async () => {})
    const s = createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    s.schedule({ expenses: 345678 })
    s.dispose()
    expect(save.mock.calls).toEqual([[{ expenses: 345678 }]])
    page.hide(); page.close()
    vi.advanceTimersByTime(2000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('nothing pending: hiding or closing the page saves nothing, and a save is never repeated', () => {
    const page = fakePage()
    const save = vi.fn(async () => {})
    createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    page.hide(); page.show(); page.close()
    expect(save).not.toHaveBeenCalled()
    const s2 = createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    s2.schedule({ gross: 1 })
    page.hide()
    vi.advanceTimersByTime(2000)
    page.close()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('a page shown again does not save', () => {
    const page = fakePage()
    const save = vi.fn(async () => {})
    const s = createInputSaver({ save, onError: () => {}, win: page.win, doc: page.doc })
    s.schedule({ gross: 1 })
    page.show()
    expect(save).not.toHaveBeenCalled()
  })
})

describe('M06 a failed save is reported, not swallowed', () => {
  it('storage full: "Couldn\'t save your figures." with the original error as the cause', async () => {
    const page = fakePage()
    const { be, storage } = anaBackend()
    storage.setItem = () => { throw new Error('QuotaExceededError') }
    const onError = vi.fn()
    const s = createInputSaver({ save: v => be.updateProfile(null, 'ana', p => withInputs(p, 'individual', v)), onError, win: page.win, doc: page.doc })
    s.schedule({ expenses: 1 })
    page.hide()
    await vi.runAllTimersAsync()
    expect(onError).toHaveBeenCalledTimes(1)
    const err = onError.mock.calls[0][0]
    expect(FIGURES_NOT_SAVED).toBe("Couldn't save your figures.")
    expect(err.message).toBe("Couldn't save your figures.")
    expect(err.cause.message).toBe('This browser refused to save the profile (storage may be full or blocked in private browsing). Your changes were not kept.')
    expect(saveProblemText(err)).toBe("Couldn't save your figures. This browser refused to save the profile (storage may be full or blocked in private browsing). Your changes were not kept.")
  })

  it('profile deleted in another window: the notice says so', async () => {
    const page = fakePage()
    const { be } = anaBackend()
    await be.deleteProfile(null, 'ana')
    const onError = vi.fn()
    const s = createInputSaver({ save: v => be.updateProfile(null, 'ana', p => withInputs(p, 'individual', v)), onError, win: page.win, doc: page.doc })
    s.schedule({ expenses: 1 })
    vi.advanceTimersByTime(900)
    await vi.runAllTimersAsync()
    expect(saveProblemText(onError.mock.calls[0][0])).toBe("Couldn't save your figures. This profile was deleted in another window.")
  })

  it('a save function that throws at once is reported too', () => {
    const onError = vi.fn()
    const boom = new Error('boom')
    const s = createInputSaver({ save: () => { throw boom }, onError, win: undefined, doc: undefined })
    s.schedule({ expenses: 1 })
    s.flush()
    expect(onError.mock.calls[0][0].message).toBe("Couldn't save your figures.")
    expect(onError.mock.calls[0][0].cause).toBe(boom)
  })
})
