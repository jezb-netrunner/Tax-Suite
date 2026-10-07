// M25: "Download my data", "Erase all data on this device" (local mode) and
// "Delete my account" (accounts mode, server function delete_own_account()).
// The backend is built with an in-memory localStorage stub and, for accounts
// mode, a mocked Supabase client that records every call.
import { describe, it, expect } from 'vitest'
import { createBackend, exportFileName, LS_KEY, ACTIVE_KEY } from '../../src/lib/backend.js'
import { memoryStorage, mockClient } from './backend-fakes.js'

const maria = {
  id: 'p-maria', name: 'Maria Santos', type: 'mixed', vatRegistered: false, regime: 'graduated_osd',
  inputs: { mixed: { gross: 480000, expenses: 180000, cwt: 24000, compensationTaxable: 600000, compensationWithheld: 62500 } },
  filed: { 'bir-1701q:2026-08-17': '2026-08-15' },
  checklistDone: { 'bir-books': '2026-10-01' },
}
const paolo = { id: 'p-free', name: 'Paolo Freelancer', type: 'individual', inputs: {} }
const NOW = new Date('2026-10-07T03:00:00Z')

describe('M25 Download my data (local mode)', () => {
  it('exports every profile with its figures, filed marks and ticked checklist items, as stored', async () => {
    const storage = memoryStorage({
      [LS_KEY]: JSON.stringify([maria, paolo]),
      [ACTIVE_KEY]: 'p-free',
      'other-site': 'keep',
    })
    const be = createBackend({ client: null, storage })
    expect(await be.exportData({ now: NOW })).toEqual({
      app: 'JEZ Tax Suite',
      format: 'jez-tax-suite-export',
      version: 1,
      exportedAt: '2026-10-07T03:00:00.000Z',
      storedIn: 'this browser',
      activeProfileId: 'p-free',
      profiles: [maria, paolo],
    })
  })

  it('exports an empty list when nothing is saved', async () => {
    const be = createBackend({ client: null, storage: memoryStorage() })
    const out = await be.exportData({ now: NOW })
    expect(out.profiles).toEqual([])
    expect(out.activeProfileId).toBe(null)
  })

  it('names the file with the Manila date (01:30 Oct 7 in Manila is still Oct 6 in UTC)', () => {
    expect(exportFileName(new Date('2026-10-06T17:30:00Z'))).toBe('jez-tax-suite-data-2026-10-07.json')
    expect(exportFileName(new Date('2026-10-07T15:59:00Z'))).toBe('jez-tax-suite-data-2026-10-07.json')
    expect(exportFileName(new Date('2026-10-07T16:00:00Z'))).toBe('jez-tax-suite-data-2026-10-08.json')
  })
})

describe('M25 Erase all data on this device (local mode)', () => {
  it("removes every JEZ Tax Suite key and nothing else", async () => {
    const storage = memoryStorage({
      [LS_KEY]: JSON.stringify([maria, paolo]),
      [ACTIVE_KEY]: 'p-maria',
      'pv.someFutureKey.v2': 'x',
      'other-site': 'keep',
    })
    const be = createBackend({ client: null, storage })
    expect(be.eraseLocalData()).toBe(3)
    expect(storage.keys()).toEqual(['other-site'])
    expect(await be.listProfiles(null)).toEqual([])
  })

  it('says so in plain words when the browser blocks the erase', () => {
    const storage = memoryStorage({ [LS_KEY]: '[]' })
    storage.removeItem = () => { throw new Error('SecurityError') }
    const be = createBackend({ client: null, storage })
    expect(() => be.eraseLocalData()).toThrow(
      "This browser blocked the erase. Clear this site's data in your browser settings instead.",
    )
  })
})

describe('M25 accounts mode', () => {
  const USER = 'aaaaaaaa-0000-0000-0000-000000000001'

  it('Download my data reads only this account\'s profiles and adds the email and record dates', async () => {
    const client = mockClient({
      respond: () => ({
        data: [
          { id: 'r1', data: { name: 'Maria Santos', type: 'mixed', inputs: maria.inputs }, created_at: '2026-10-01T01:00:00+00:00', updated_at: '2026-10-05T02:00:00+00:00' },
        ],
        error: null,
      }),
    })
    const be = createBackend({ client, storage: memoryStorage() })
    const out = await be.exportData({ userId: USER, email: 'ana@example.com', now: NOW })
    expect(client.queries).toEqual([[
      ['from', 'taxpayer_profiles'],
      ['select', 'id, data, created_at, updated_at'],
      ['eq', 'user_id', USER],
      ['order', 'created_at', { ascending: true }],
    ]])
    expect(out).toEqual({
      app: 'JEZ Tax Suite',
      format: 'jez-tax-suite-export',
      version: 1,
      exportedAt: '2026-10-07T03:00:00.000Z',
      storedIn: 'your account',
      account: { email: 'ana@example.com' },
      profiles: [{ name: 'Maria Santos', type: 'mixed', inputs: maria.inputs, id: 'r1' }],
      records: [{ id: 'r1', createdAt: '2026-10-01T01:00:00+00:00', updatedAt: '2026-10-05T02:00:00+00:00' }],
    })
  })

  it('Delete my account calls delete_own_account(), then signs out on this device and clears local keys', async () => {
    const order = []
    const client = mockClient({ rpc: name => { order.push('rpc:' + name); return { data: null, error: null } } })
    client.auth.signOut.mockImplementation(async opts => { order.push('signOut:' + opts.scope); return { error: null } })
    const storage = memoryStorage({ [ACTIVE_KEY]: 'r1', [LS_KEY]: '[]', 'sb-proj-auth-token': 'session' })
    const be = createBackend({ client, storage })
    await be.deleteOwnAccount()
    expect(client.rpc).toHaveBeenCalledTimes(1)
    expect(client.rpc).toHaveBeenCalledWith('delete_own_account')
    expect(order).toEqual(['rpc:delete_own_account', 'signOut:local'])
    expect(storage.keys()).toEqual(['sb-proj-auth-token'])
  })

  it('a failed delete keeps the user signed in and shows a plain message, not the server text', async () => {
    const client = mockClient({ rpc: () => ({ data: null, error: { code: '42501', message: 'permission denied for function delete_own_account' } }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.deleteOwnAccount()).rejects.toThrow(
      'We could not delete your account, so nothing was deleted. Please try again in a moment.',
    )
    expect(client.auth.signOut).not.toHaveBeenCalled()
  })

  it('local-mode backends refuse to delete an account (there is none)', async () => {
    const be = createBackend({ client: null, storage: memoryStorage() })
    await expect(be.deleteOwnAccount()).rejects.toThrow('There is no account to delete in local mode.')
  })
})
