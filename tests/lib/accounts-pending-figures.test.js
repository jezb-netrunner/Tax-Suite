// M06 (follow-up, accounts mode only): saving to the account is a network
// read and then a conditional write, which cannot finish while the page is
// being reloaded or closed. So when the page is hidden or closed with figures
// not yet saved, they are first written at once to this browser
// (pv.pendingFigures.v1, so "Erase all data on this device" removes them),
// and the next load after sign-in saves them through updateProfile and
// removes them. A save that fails then shows the usual "Couldn't save your
// figures." notice. Local mode needs none of this: its save is already
// finished inside the event.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createInputSaver, figuresNotSaved, FIGURES_NOT_SAVED } from '../../src/lib/inputSaver.js'
import { createBackend, PENDING_FIGURES_KEY, LOCAL_PREFIX, LS_KEY, PROFILE_GONE_MESSAGE } from '../../src/lib/backend.js'
import { withChangedInputs } from '../../src/engine/profile.js'
import { saveProblemText } from '../../src/components/SaveNotice.jsx'
import { memoryStorage, mockClient } from './backend-fakes.js'

const USER = '11111111-1111-1111-1111-111111111111'
const OTHER = '22222222-2222-2222-2222-222222222222'
const T1 = '2026-10-07T01:00:00.000+00:00'
const isUpdate = ops => ops.some(o => o[0] === 'update')
const updateOf = ops => ops.find(o => o[0] === 'update')[1]
const row = { id: 'r1', data: { name: 'Ana', type: 'individual', inputs: { individual: { gross: 480000, expenses: 180000 } } }, updated_at: T1 }

function fakePage() {
  const win = new EventTarget()
  const doc = new EventTarget()
  doc.visibilityState = 'visible'
  return {
    win, doc,
    hide() { doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')) },
    close() { win.dispatchEvent(new Event('pagehide')) },
  }
}

// An accounts-mode estimator tab: saves go to the (mock) account; the
// browser copy is the backend's stash.
function accountsTab({ respond, storage = memoryStorage() } = {}) {
  const client = mockClient({ respond: respond || (() => new Promise(() => {})) }) // default: the request never finishes (page unloading)
  const be = createBackend({ client, storage })
  const page = fakePage()
  const onError = vi.fn()
  const where = { userId: USER, profileId: 'r1', key: 'individual' }
  const saver = createInputSaver({
    save: changes => be.updateProfile(USER, 'r1', p => withChangedInputs(p, 'individual', changes)),
    onError,
    stash: { write: values => be.stashFigures({ ...where, values }), clear: stamp => be.clearStashedFigures({ ...where, stamp }) },
    win: page.win, doc: page.doc,
  })
  const pending = () => JSON.parse(storage.getItem(PENDING_FIGURES_KEY) || 'null')
  return { client, be, page, saver, storage, pending, onError }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('M06 accounts mode: figures not yet saved are kept in this browser when the page goes away', () => {
  it('review case: typed 123456, reloaded after 250 ms: written to this browser inside the event', () => {
    const t = accountsTab()
    t.saver.schedule({ expenses: 123456 })
    vi.advanceTimersByTime(250)
    t.page.close() // no await: the page unloads right after this event
    expect(t.pending()).toEqual([{ userId: USER, profileId: 'r1', key: 'individual', values: { expenses: 123456 }, stamp: expect.any(String) }])
  })

  it('a save already sent but not finished is kept too, with later changes merged', async () => {
    const t = accountsTab()
    t.saver.schedule({ expenses: 222222 })
    await vi.advanceTimersByTimeAsync(900) // sent; the account never answers
    t.saver.schedule({ gross: 500000 })
    t.page.hide()
    expect(t.pending()[0].values).toEqual({ expenses: 222222, gross: 500000 })
  })

  it('page hidden but still open: the save finishes and the browser copy is removed', async () => {
    const t = accountsTab({
      respond: ops => (isUpdate(ops) ? { data: [{ id: 'r1', updated_at: T1 }], error: null } : { data: [row], error: null }),
    })
    t.saver.schedule({ expenses: 444444 })
    t.page.hide()
    expect(t.pending()[0].values).toEqual({ expenses: 444444 })
    await vi.runAllTimersAsync()
    expect(t.storage.getItem(PENDING_FIGURES_KEY)).toBe(null)
    expect(t.onError).not.toHaveBeenCalled()
  })

  it('nothing waiting: nothing is written', () => {
    const t = accountsTab()
    t.page.hide(); t.page.close()
    expect(t.storage.getItem(PENDING_FIGURES_KEY)).toBe(null)
  })

  it('local mode: no browser copy (the local save is already done inside the event)', () => {
    const storage = memoryStorage({ [LS_KEY]: JSON.stringify([{ id: 'ana', inputs: {} }]) })
    const be = createBackend({ storage })
    expect(be.stashFigures({ userId: null, profileId: 'ana', key: 'individual', values: { expenses: 1 } })).toBe(null)
    expect(storage.getItem(PENDING_FIGURES_KEY)).toBe(null)
  })
})

describe('M06 accounts mode: the next load after sign-in saves the kept figures', () => {
  const kept = (extra = []) => memoryStorage({
    [PENDING_FIGURES_KEY]: JSON.stringify([{ userId: USER, profileId: 'r1', key: 'individual', values: { expenses: 123456 }, stamp: 's1' }, ...extra]),
  })

  it('replays them through updateProfile onto the newest stored figures, then removes them', async () => {
    const storage = kept()
    const client = mockClient({
      respond: ops => (isUpdate(ops) ? { data: [{ id: 'r1', updated_at: T1 }], error: null } : { data: [row], error: null }),
    })
    const be = createBackend({ client, storage })
    const r = await be.replayStashedFigures(USER)
    expect(r).toEqual({ saved: 1, problems: [] })
    const sent = client.queries.filter(isUpdate).map(updateOf)
    expect(sent).toEqual([{ data: { id: undefined, name: 'Ana', type: 'individual', inputs: { individual: { gross: 480000, expenses: 123456 } } } }])
    expect(storage.getItem(PENDING_FIGURES_KEY)).toBe(null)
  })

  it('only the signed-in user\'s figures are sent; another user\'s stay for them', async () => {
    const storage = kept([{ userId: OTHER, profileId: 'r9', key: 'corporation', values: { grossSales: 1 }, stamp: 's2' }])
    const client = mockClient({
      respond: ops => (isUpdate(ops) ? { data: [{ id: 'r1', updated_at: T1 }], error: null } : { data: [row], error: null }),
    })
    const be = createBackend({ client, storage })
    await be.replayStashedFigures(USER)
    expect(client.queries.every(q => !q.some(o => o[0] === 'eq' && o[2] === 'r9'))).toBe(true)
    expect(JSON.parse(storage.getItem(PENDING_FIGURES_KEY)).map(e => e.userId)).toEqual([OTHER])
  })

  it('save fails: kept for the next load, and reported as "Couldn\'t save your figures."', async () => {
    const storage = kept()
    const client = mockClient({ respond: () => ({ data: null, error: { code: '08006', message: 'network' } }) })
    const be = createBackend({ client, storage })
    const r = await be.replayStashedFigures(USER)
    expect(r.saved).toBe(0)
    expect(saveProblemText(figuresNotSaved(r.problems[0]))).toBe("Couldn't save your figures. The profile could not be saved. Please try again.")
    expect(FIGURES_NOT_SAVED).toBe("Couldn't save your figures.")
    expect(JSON.parse(storage.getItem(PENDING_FIGURES_KEY))).toHaveLength(1)
  })

  it('profile deleted in the meantime: the kept figures are dropped, and that is reported', async () => {
    const storage = kept()
    const client = mockClient({ respond: () => ({ data: [], error: null }) })
    const be = createBackend({ client, storage })
    const r = await be.replayStashedFigures(USER)
    expect(r.problems[0].message).toBe(PROFILE_GONE_MESSAGE)
    expect(storage.getItem(PENDING_FIGURES_KEY)).toBe(null)
  })

  it('nothing kept: no request', async () => {
    const client = mockClient()
    const be = createBackend({ client, storage: memoryStorage() })
    expect(await be.replayStashedFigures(USER)).toEqual({ saved: 0, problems: [] })
    expect(client.queries).toEqual([])
  })
})

describe('M06 the kept figures are this app\'s browser data', () => {
  it('the key starts with pv., so "Erase all data on this device" removes it', () => {
    expect(PENDING_FIGURES_KEY.startsWith(LOCAL_PREFIX)).toBe(true)
    const storage = memoryStorage({ [PENDING_FIGURES_KEY]: '[]', [LS_KEY]: '[]', 'other.site': 'x' })
    createBackend({ storage }).eraseLocalData()
    expect(storage.keys()).toEqual(['other.site'])
  })
})
