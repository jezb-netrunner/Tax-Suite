// L22: when the browser refuses to save a profile, the plain-language error
// keeps the browser's own error as its cause, so the reason is not lost.
import { describe, it, expect } from 'vitest'
import { createBackend } from '../../src/lib/backend.js'
import { memoryStorage } from './backend-fakes.js'

describe('local save failure keeps the original error (L22)', () => {
  it('throws the plain message with the storage error attached as cause', async () => {
    const storage = memoryStorage()
    const quota = new Error('QuotaExceededError: the quota has been exceeded')
    storage.setItem = () => { throw quota }
    const backend = createBackend({ client: null, storage })
    let thrown = null
    try {
      await backend.saveProfile(null, { id: null, name: 'Ana', type: 'individual', inputs: {} })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.message).toBe(
      'This browser refused to save the profile (storage may be full or blocked in private browsing). Your changes were not kept.'
    )
    expect(thrown.cause).toBe(quota)
  })
})
