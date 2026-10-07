// C07 (follow-up): two tabs open on the SAME estimator mode. Each tab used to
// save its whole (stale) set of figures for that mode, so figures typed in the
// other tab were undone, and an idle tab never showed the other tab's
// figures. Now a tab saves only the fields it changed, merged onto the newest
// stored figures, and shows the stored figures again when another tab
// changes them and it has nothing of its own waiting to be saved.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createInputSaver, figuresToShow } from '../../src/lib/inputSaver.js'
import { createBackend, LS_KEY } from '../../src/lib/backend.js'
import { withChangedInputs } from '../../src/engine/profile.js'
import { memoryStorage } from './backend-fakes.js'

const ana = { id: 'ana', name: 'Ana Freelancer', type: 'individual', inputs: { individual: { gross: 480000, expenses: 180000 }, employee: { monthlyBasic: 1 } } }

function twoTabs() {
  const storage = memoryStorage({ [LS_KEY]: JSON.stringify([ana]) })
  const tab = () => {
    const be = createBackend({ storage })
    return createInputSaver({
      save: changes => be.updateProfile(null, 'ana', p => withChangedInputs(p, 'individual', changes)),
      onError: e => { throw e },
      win: new EventTarget(), doc: new EventTarget(),
    })
  }
  return { A: tab(), B: tab(), figures: () => JSON.parse(storage.getItem(LS_KEY))[0].inputs.individual }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('C07 two tabs on the same estimator mode (review re-run)', () => {
  it('tab A types gross 900,000, then the stale tab B types expenses 200,000: both are kept', async () => {
    const { A, B, figures } = twoTabs()
    A.schedule({ gross: 900000 })
    await vi.advanceTimersByTimeAsync(900)
    expect(figures()).toEqual({ gross: 900000, expenses: 180000 })
    B.schedule({ expenses: 200000 }) // B still shows gross 480,000; it did not change it
    await vi.advanceTimersByTimeAsync(900)
    expect(figures()).toEqual({ gross: 900000, expenses: 200000 })
  })

  it('withChangedInputs changes only the given fields of inputs[key]; null clears a field; other modes kept', () => {
    expect(withChangedInputs(ana, 'individual', { expenses: 200000, cwt: null })).toEqual({
      ...ana, inputs: { individual: { gross: 480000, expenses: 200000, cwt: null }, employee: { monthlyBasic: 1 } },
    })
    expect(withChangedInputs({ id: 'x' }, 'corporation', { grossSales: 5 })).toEqual({ id: 'x', inputs: { corporation: { grossSales: 5 } } })
    expect(ana.inputs.individual).toEqual({ gross: 480000, expenses: 180000 }) // not mutated
  })
})

describe('C07 the saver sends the fields changed since the last save', () => {
  it('changes to different boxes before the save are sent together; later changes alone', async () => {
    const save = vi.fn(async () => {})
    const s = createInputSaver({ save, onError: () => {}, win: new EventTarget(), doc: new EventTarget() })
    s.schedule({ gross: 900000 })
    s.schedule({ expenses: 1 })
    s.schedule({ expenses: 12 })
    await vi.advanceTimersByTimeAsync(900)
    s.schedule({ cwt: 5000 })
    await vi.advanceTimersByTimeAsync(900)
    expect(save.mock.calls).toEqual([[{ gross: 900000, expenses: 12 }], [{ cwt: 5000 }]])
  })

  it('busy() is true while changes wait or are being saved, false once saved', async () => {
    let finish
    const s = createInputSaver({ save: () => new Promise(r => { finish = r }), onError: () => {}, win: new EventTarget(), doc: new EventTarget() })
    expect(s.busy()).toBe(false)
    s.schedule({ gross: 1 })
    expect(s.busy()).toBe(true)
    await vi.advanceTimersByTimeAsync(900)
    expect(s.busy()).toBe(true) // sent, not finished
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(s.busy()).toBe(false)
  })
})

describe('C07 an open estimator shows figures another tab saved', () => {
  it('nothing waiting: the stored figures are shown', () => {
    const shown = { gross: 480000, expenses: 180000 }
    expect(figuresToShow(shown, { gross: 900000, expenses: 180000 }, false)).toEqual({ gross: 900000, expenses: 180000 })
  })
  it('a field cleared in the other tab is cleared here too', () => {
    expect(figuresToShow({ gross: 1, cwt: 5 }, { gross: 1 }, false)).toEqual({ gross: 1 })
    expect(figuresToShow({ gross: 1 }, undefined, false)).toEqual({})
  })
  it('this tab still saving its own changes: what it shows is kept', () => {
    const shown = { gross: 480000, expenses: 200000 }
    expect(figuresToShow(shown, { gross: 900000, expenses: 180000 }, true)).toBe(shown)
  })
  it('the same figures: the same object (no re-render)', () => {
    const shown = { gross: 1, expenses: 2 }
    expect(figuresToShow(shown, { expenses: 2, gross: 1 }, false)).toBe(shown)
  })
})
