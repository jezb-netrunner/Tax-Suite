// L17: the profile list filters by the signed-in user (not only by the
// database's row-level security); the database stamps created_at/updated_at,
// so the client no longer sends them; the database's new size limit and
// 500-profile cap (migration 0002) come back as plain messages.
import { describe, it, expect } from 'vitest'
import { createBackend, PROFILE_LIMIT } from '../../src/lib/backend.js'
import { memoryStorage, mockClient } from './backend-fakes.js'

const USER = 'aaaaaaaa-0000-0000-0000-000000000001'

describe('L17 accounts-mode queries', () => {
  it('listProfiles asks only for this user\'s rows', async () => {
    const client = mockClient({ respond: () => ({ data: [{ id: 'r1', data: { name: 'Maria Santos' }, updated_at: 'x' }], error: null }) })
    const be = createBackend({ client, storage: memoryStorage() })
    expect(await be.listProfiles(USER)).toEqual([{ name: 'Maria Santos', id: 'r1' }])
    expect(client.queries).toEqual([[
      ['from', 'taxpayer_profiles'],
      ['select', 'id, data, updated_at'],
      ['eq', 'user_id', USER],
      ['order', 'created_at', { ascending: true }],
    ]])
  })

  it('listProfiles with no signed-in user does not query at all', async () => {
    const client = mockClient()
    const be = createBackend({ client, storage: memoryStorage() })
    expect(await be.listProfiles(null)).toEqual([])
    expect(client.queries).toEqual([])
  })

  it('saving an existing profile sends only the data; the database stamps updated_at', async () => {
    const client = mockClient({ respond: () => ({ data: { id: 'r1' }, error: null }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await be.saveProfile(USER, { id: 'r1', name: 'Maria Santos' })
    expect(client.queries).toEqual([[
      ['from', 'taxpayer_profiles'],
      ['update', { data: { name: 'Maria Santos', id: undefined } }],
      ['eq', 'id', 'r1'],
      ['eq', 'user_id', USER],
      ['select', 'id'],
      ['single'],
    ]])
  })
})

describe('L17 database limits as plain messages', () => {
  it('the cap is 500 profiles per account', () => {
    expect(PROFILE_LIMIT).toBe(500)
  })

  it('a profile over the size limit', async () => {
    const client = mockClient({ respond: () => ({ data: null, error: { code: '23514', message: 'new row for relation "taxpayer_profiles" violates check constraint "taxpayer_profiles_data_size"' } }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.saveProfile(USER, { name: 'Huge' })).rejects.toThrow(
      'This profile is too large to save. Clear figures you no longer need, or split it into two profiles.',
    )
  })

  it('the 501st profile', async () => {
    const client = mockClient({ respond: () => ({ data: null, error: { code: 'P0001', message: 'profile limit reached: 500 profiles per account' } }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.saveProfile(USER, { name: 'One too many' })).rejects.toThrow(
      'This account already has 500 profiles, the most it can hold. Delete profiles you no longer need, then try again.',
    )
  })

  it('other save errors are generic, without the server text', async () => {
    const client = mockClient({ respond: () => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy for table "taxpayer_profiles"' } }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await expect(be.saveProfile(USER, { name: 'X' })).rejects.toThrow('The profile could not be saved. Please try again.')
  })
})
