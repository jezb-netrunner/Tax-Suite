// M27: local mode keeps client names and income in this browser. Users get a
// shared-computer warning and plain text instead of the developer note, and
// after signing in to an account, profiles left behind from local mode can be
// imported into the account or erased.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createBackend, LS_KEY, ACTIVE_KEY } from '../../src/lib/backend.js'
import { LocalModeNote, SHARED_COMPUTER_WARNING } from '../../src/pages/Profiles.jsx'
import { memoryStorage, mockClient } from './backend-fakes.js'

const USER = 'aaaaaaaa-0000-0000-0000-000000000001'
const maria = { id: 'p-maria', name: 'Maria Santos', type: 'mixed', inputs: { mixed: { gross: 480000 } } }
const paolo = { id: 'p-free', name: 'Paolo Freelancer', type: 'individual', inputs: {} }

const text = el => renderToStaticMarkup(el).replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim()

describe('M27 local-mode wording', () => {
  it('warns about shared computers in plain words', () => {
    expect(SHARED_COMPUTER_WARNING).toBe("Anyone who uses this browser can see these profiles. Don't use this on a shared computer.")
  })

  it('users see where profiles are kept and the warning, not the developer setup note', () => {
    const t = text(React.createElement(LocalModeNote, { dev: false }))
    expect(t).toContain('Profiles are saved in this browser only. They are not sent to us and do not sync to your other devices.')
    expect(t).toContain(SHARED_COMPUTER_WARNING)
    expect(t).not.toContain('Supabase')
    expect(t).not.toContain('.env.example')
  })

  it('the developer setup note appears only in development builds', () => {
    const t = text(React.createElement(LocalModeNote, { dev: true }))
    expect(t).toContain('Developer note: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to turn on accounts.')
  })
})

describe('M27 profiles left in this browser after switching to accounts', () => {
  const leftoverStorage = () => memoryStorage({
    [LS_KEY]: JSON.stringify([maria, paolo]),
    [ACTIVE_KEY]: 'row-9',
    'sb-proj-auth-token': 'session',
  })

  it('accounts mode finds them; local mode has no leftovers (they are the live profiles)', () => {
    expect(createBackend({ client: mockClient(), storage: leftoverStorage() }).localLeftovers()).toEqual([maria, paolo])
    expect(createBackend({ client: null, storage: leftoverStorage() }).localLeftovers()).toEqual([])
  })

  it('ignores an unreadable or empty leftover list', () => {
    expect(createBackend({ client: mockClient(), storage: memoryStorage({ [LS_KEY]: '{oops' }) }).localLeftovers()).toEqual([])
    expect(createBackend({ client: mockClient(), storage: memoryStorage({ [LS_KEY]: '[]' }) }).localLeftovers()).toEqual([])
    expect(createBackend({ client: mockClient(), storage: memoryStorage() }).localLeftovers()).toEqual([])
  })

  it('"Import them into your account" saves each one as a new profile of this user, then removes the local copy', async () => {
    let n = 0
    const client = mockClient({ respond: () => ({ data: { id: 'row-' + (++n) }, error: null }) })
    const storage = leftoverStorage()
    const be = createBackend({ client, storage })
    expect(await be.importLocalProfiles(USER)).toEqual({ imported: 2, failed: 0 })
    expect(client.queries).toEqual([
      [['from', 'taxpayer_profiles'], ['insert', { user_id: USER, data: { ...maria, id: undefined } }], ['select', 'id'], ['single']],
      [['from', 'taxpayer_profiles'], ['insert', { user_id: USER, data: { ...paolo, id: undefined } }], ['select', 'id'], ['single']],
    ])
    expect(storage.getItem(LS_KEY)).toBe(null)
    // The account's own keys are left alone.
    expect(storage.getItem(ACTIVE_KEY)).toBe('row-9')
    expect(storage.getItem('sb-proj-auth-token')).toBe('session')
  })

  it('keeps the profiles that could not be imported, so nothing is lost', async () => {
    let n = 0
    const client = mockClient({
      respond: () => (++n === 2 ? { data: null, error: { code: '23514', message: 'check constraint' } } : { data: { id: 'row-' + n }, error: null }),
    })
    const storage = leftoverStorage()
    const be = createBackend({ client, storage })
    expect(await be.importLocalProfiles(USER)).toEqual({ imported: 1, failed: 1 })
    expect(JSON.parse(storage.getItem(LS_KEY))).toEqual([paolo])
  })

  it('"Erase them" removes only the leftover profiles, not the sign-in session', () => {
    const storage = leftoverStorage()
    createBackend({ client: mockClient(), storage }).eraseLocalLeftovers()
    expect(storage.getItem(LS_KEY)).toBe(null)
    expect(storage.getItem('sb-proj-auth-token')).toBe('session')
    expect(storage.getItem(ACTIVE_KEY)).toBe('row-9')
  })
})
