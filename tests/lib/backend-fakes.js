// Test doubles for src/lib/backend.js and src/lib/auth.js: an in-memory
// localStorage and a mocked Supabase client that records every call.
import { vi } from 'vitest'

export function memoryStorage(init = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: k => { m.delete(k) },
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size },
    keys: () => [...m.keys()],
  }
}

// A chainable stand-in for supabase.from(...): records each call and resolves
// with whatever respond(ops) returns.
export function mockClient({ respond = () => ({ data: [], error: null }), rpc = () => ({ data: null, error: null }) } = {}) {
  const queries = []
  const from = vi.fn(table => {
    const ops = [['from', table]]
    queries.push(ops)
    const b = {}
    for (const m of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'single']) {
      b[m] = (...a) => { ops.push([m, ...a]); return b }
    }
    b.then = (res, rej) => Promise.resolve(respond(ops)).then(res, rej)
    return b
  })
  return {
    queries,
    from,
    rpc: vi.fn(async name => rpc(name)),
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  }
}
