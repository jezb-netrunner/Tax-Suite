// C07: with the app open in two tabs, a tab saving its figures must not write
// back its old copy of the whole profile. Saves of figures and marks re-read
// the latest stored profile and change only their own part; a profile deleted
// in another tab is never re-created; in accounts mode a save made against an
// older version of the row (updated_at changed) is not written over it.
//
// Two backends built on the same storage stand in for two browser tabs.
import { describe, it, expect, vi } from 'vitest'
import {
  createBackend, watchProfileChanges, LS_KEY, ACTIVE_KEY, PROFILE_GONE_MESSAGE, PROFILE_CONFLICT_MESSAGE,
} from '../../src/lib/backend.js'
import { withInputs } from '../../src/engine/profile.js'
import { withFiled, withChecked } from '../../src/engine/deadlines.js'
import { memoryStorage, mockClient } from './backend-fakes.js'

const USER = 'aaaaaaaa-0000-0000-0000-000000000001'
const ana = { id: 'ana', name: 'Ana Freelancer', type: 'individual', vatRegistered: false, regime: '8pct', inputs: {} }
const ben = {
  id: 'ben', name: 'Ben VAT Shop', type: 'individual', vatRegistered: true, regime: 'graduated_itemized',
  hasEmployees: false, inputs: { payroll: { basic: 25000 } },
}
const fox = { id: 'fox', name: 'Fox Corp', type: 'corporation', inputs: {} }

function twoTabs() {
  const storage = memoryStorage({ [LS_KEY]: JSON.stringify([ana, ben, fox]), [ACTIVE_KEY]: 'ben' })
  return { storage, A: createBackend({ storage }), B: createBackend({ storage }) }
}
const stored = storage => JSON.parse(storage.getItem(LS_KEY))

describe('C07 local mode: figures are saved onto the latest stored profile', () => {
  it('a rename made in tab A survives tab B saving estimator figures', async () => {
    const { storage, A, B } = twoTabs()
    const [, staleBen] = await B.listProfiles(null) // tab B's copy, loaded before the rename
    await A.updateProfile(null, 'ben', p => ({ ...p, name: 'Ben RENAMED IN A', hasEmployees: true }))
    const saved = await B.updateProfile(null, 'ben', p => withInputs(p, 'individual', { expenses: 777777 }))
    expect(staleBen.name).toBe('Ben VAT Shop')
    const after = stored(storage).find(p => p.id === 'ben')
    expect(after).toEqual({
      ...ben, name: 'Ben RENAMED IN A', hasEmployees: true,
      inputs: { payroll: { basic: 25000 }, individual: { expenses: 777777 } },
    })
    expect(saved).toEqual(after)
    expect(stored(storage).map(p => p.id)).toEqual(['ana', 'ben', 'fox'])
  })

  it('withInputs replaces only inputs[key] and keeps the other figures', () => {
    expect(withInputs(ben, 'individual', { gross: 480000 })).toEqual({
      ...ben, inputs: { payroll: { basic: 25000 }, individual: { gross: 480000 } },
    })
    expect(withInputs({ id: 'x', name: 'No inputs yet' }, 'employee', { monthly: 1 })).toEqual({
      id: 'x', name: 'No inputs yet', inputs: { employee: { monthly: 1 } },
    })
    expect(ben.inputs).toEqual({ payroll: { basic: 25000 } }) // not mutated
  })

  it('a deadline marked filed in tab A and figures typed in tab B are both kept', async () => {
    const { storage, A, B } = twoTabs()
    const today = new Date(2026, 9, 7)
    await A.updateProfile(null, 'ben', p => withFiled(p, '1701Q-2026-Q3', true, today))
    await B.updateProfile(null, 'ben', p => withInputs(p, 'individual', { gross: 900000 }))
    await A.updateProfile(null, 'ben', p => withChecked(p, 'bir-books', true, today))
    const after = stored(storage).find(p => p.id === 'ben')
    expect(after.filed).toEqual({ '1701Q-2026-Q3': '2026-10-07' })
    expect(after.checklistDone).toEqual({ 'bir-books': '2026-10-07' })
    expect(after.inputs).toEqual({ payroll: { basic: 25000 }, individual: { gross: 900000 } })
  })
})

describe('C07 local mode: a profile deleted in another tab is never re-created', () => {
  it('figures typed in tab B after tab A deleted the profile are refused', async () => {
    const { storage, A, B } = twoTabs()
    await A.deleteProfile(null, 'ben')
    await expect(B.updateProfile(null, 'ben', p => withInputs(p, 'individual', { expenses: 99999 })))
      .rejects.toThrow('This profile was deleted in another window.')
    expect(stored(storage).map(p => p.id)).toEqual(['ana', 'fox'])
  })

  it('a whole-profile save of the deleted profile is refused too', async () => {
    const { storage, A, B } = twoTabs()
    const [, staleBen] = await B.listProfiles(null)
    await A.deleteProfile(null, 'ben')
    await expect(B.saveProfile(null, { ...staleBen, inputs: { individual: { expenses: 99999 } } }))
      .rejects.toThrow('This profile was deleted in another window.')
    expect(stored(storage).map(p => p.id)).toEqual(['ana', 'fox'])
  })

  it('the refusal carries a code the app can recognise', async () => {
    const { A } = twoTabs()
    const err = await A.updateProfile(null, 'gone', p => p).catch(e => e)
    expect(err.message).toBe(PROFILE_GONE_MESSAGE)
    expect(err.code).toBe('profile-gone')
  })

  it('a new profile (no id yet) is still created', async () => {
    const { storage, B } = twoTabs()
    const saved = await B.saveProfile(null, { id: null, name: 'Cara New', type: 'employee', inputs: {} })
    expect(typeof saved.id).toBe('string')
    expect(saved.id.length > 0).toBe(true)
    expect(stored(storage).map(p => p.name)).toEqual(['Ana Freelancer', 'Ben VAT Shop', 'Fox Corp', 'Cara New'])
  })
})

// Accounts mode: read the row with its updated_at, write only if updated_at is
// still the same (the database trigger from migration 0002 changes it on every
// write), otherwise read again and re-apply the change.
const T1 = '2026-10-07T01:00:00.000001+00:00'
const T2 = '2026-10-07T01:00:05.000002+00:00'
const T3 = '2026-10-07T01:00:09.000003+00:00'
const isUpdate = ops => ops.some(o => o[0] === 'update')

describe('C07 accounts mode: optimistic concurrency on updated_at', () => {
  it('reads the latest row and writes only if updated_at is unchanged', async () => {
    const client = mockClient({
      respond: ops => (isUpdate(ops)
        ? { data: [{ id: 'r1', updated_at: T2 }], error: null }
        : { data: [{ id: 'r1', data: { name: 'Maria Santos', inputs: { mixed: { gross: 1 } } }, updated_at: T1 }], error: null }),
    })
    const be = createBackend({ client, storage: memoryStorage() })
    const saved = await be.updateProfile(USER, 'r1', p => withInputs(p, 'employee', { monthly: 30000 }))
    expect(saved).toEqual({ id: 'r1', name: 'Maria Santos', inputs: { mixed: { gross: 1 }, employee: { monthly: 30000 } } })
    expect(client.queries).toEqual([
      [['from', 'taxpayer_profiles'], ['select', 'id, data, updated_at'], ['eq', 'id', 'r1'], ['eq', 'user_id', USER]],
      [
        ['from', 'taxpayer_profiles'],
        ['update', { data: { id: undefined, name: 'Maria Santos', inputs: { mixed: { gross: 1 }, employee: { monthly: 30000 } } } }],
        ['eq', 'id', 'r1'], ['eq', 'user_id', USER], ['eq', 'updated_at', T1],
        ['select', 'id, updated_at'],
      ],
    ])
  })

  it('a stale write is not applied: the newer row is read again and the change re-applied', async () => {
    let reads = 0
    let writes = 0
    const client = mockClient({
      respond: ops => {
        if (isUpdate(ops)) {
          writes++
          // The first write finds updated_at changed by another device.
          return { data: writes === 1 ? [] : [{ id: 'r1', updated_at: T3 }], error: null }
        }
        reads++
        return reads === 1
          ? { data: [{ id: 'r1', data: { name: 'Maria Santos', vatRegistered: false, inputs: {} }, updated_at: T1 }], error: null }
          : { data: [{ id: 'r1', data: { name: 'Maria Santos', vatRegistered: true, inputs: {} }, updated_at: T2 }], error: null }
      },
    })
    const be = createBackend({ client, storage: memoryStorage() })
    const saved = await be.updateProfile(USER, 'r1', p => withInputs(p, 'mixed', { gross: 3200000 }))
    expect(saved).toEqual({ id: 'r1', name: 'Maria Santos', vatRegistered: true, inputs: { mixed: { gross: 3200000 } } })
    const writesSent = client.queries.filter(isUpdate)
    expect(writesSent.map(q => q.find(o => o[0] === 'eq' && o[1] === 'updated_at'))).toEqual([
      ['eq', 'updated_at', T1], ['eq', 'updated_at', T2],
    ])
    expect(writesSent[1][1]).toEqual(['update', { data: { id: undefined, name: 'Maria Santos', vatRegistered: true, inputs: { mixed: { gross: 3200000 } } } }])
  })

  it('a save that keeps losing to newer versions is rejected with a message', async () => {
    let n = 0
    const client = mockClient({
      respond: ops => (isUpdate(ops)
        ? { data: [], error: null }
        : { data: [{ id: 'r1', data: { name: 'Maria Santos' }, updated_at: `2026-10-07T01:00:0${++n}.000000+00:00` }], error: null }),
    })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.updateProfile(USER, 'r1', p => ({ ...p, name: 'Maria' }))).rejects.toThrow(PROFILE_CONFLICT_MESSAGE)
    expect(PROFILE_CONFLICT_MESSAGE).toBe(
      'This profile was changed in another window or on another device at the same time, so this change was not saved. Please try again.',
    )
    expect(client.queries.filter(isUpdate).length).toBe(3)
  })

  it('a row deleted elsewhere: "This profile was deleted in another window.", nothing written', async () => {
    const client = mockClient({ respond: () => ({ data: [], error: null }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.updateProfile(USER, 'r1', p => p)).rejects.toThrow('This profile was deleted in another window.')
    expect(client.queries.filter(isUpdate)).toEqual([])
  })

  it('a row deleted between the read and the write is reported as deleted', async () => {
    let reads = 0
    const client = mockClient({
      respond: ops => {
        if (isUpdate(ops)) return { data: [], error: null }
        reads++
        return { data: reads === 1 ? [{ id: 'r1', data: { name: 'Maria Santos' }, updated_at: T1 }] : [], error: null }
      },
    })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.updateProfile(USER, 'r1', p => p)).rejects.toThrow(PROFILE_GONE_MESSAGE)
  })

  it('a whole-profile save of a row that no longer exists says so', async () => {
    const client = mockClient({ respond: () => ({ data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.saveProfile(USER, { id: 'r1', name: 'Maria Santos' })).rejects.toThrow('This profile was deleted in another window.')
  })
})

function fakeWindowAndDocument() {
  const win = new EventTarget()
  const doc = new EventTarget()
  doc.visibilityState = 'visible'
  const storageEvent = key => { const e = new Event('storage'); e.key = key; win.dispatchEvent(e) }
  const setVisibility = v => { doc.visibilityState = v; doc.dispatchEvent(new Event('visibilitychange')) }
  return { win, doc, storageEvent, setVisibility }
}

describe('C07 profiles reload when another tab changes them', () => {
  it('local mode: a change to the saved profile list in another tab reloads the list', () => {
    const { win, doc, storageEvent } = fakeWindowAndDocument()
    const reload = vi.fn()
    const stop = watchProfileChanges(reload, { cloud: false, win, doc })
    storageEvent(LS_KEY)
    expect(reload).toHaveBeenCalledTimes(1)
    storageEvent(ACTIVE_KEY) // another tab picking a different client is not a profile change
    storageEvent('sb-auth-token')
    expect(reload).toHaveBeenCalledTimes(1)
    storageEvent(null) // storage cleared in another tab ("Erase all data on this device")
    expect(reload).toHaveBeenCalledTimes(2)
    stop()
    storageEvent(LS_KEY)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('accounts mode: the list reloads when the tab is shown again', () => {
    const { win, doc, setVisibility } = fakeWindowAndDocument()
    const reload = vi.fn()
    const stop = watchProfileChanges(reload, { cloud: true, win, doc })
    setVisibility('hidden')
    expect(reload).toHaveBeenCalledTimes(0)
    setVisibility('visible')
    expect(reload).toHaveBeenCalledTimes(1)
    stop()
    setVisibility('hidden'); setVisibility('visible')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('does nothing outside a browser', () => {
    const stop = watchProfileChanges(() => {}, { cloud: false, win: undefined, doc: undefined })
    expect(typeof stop).toBe('function')
    stop()
  })
})
