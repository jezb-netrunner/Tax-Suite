// M29: the committed single-file index.html must always be the local-mode
// build. A build reads the Supabase keys only with JEZ_ENABLE_ACCOUNTS=1.
import { describe, it, expect, afterEach } from 'vitest'
import { accountsEnabled, ACCOUNTS_OPT_IN } from '../../scripts/build-mode.js'
import viteConfig from '../../vite.config.js'

const KEYS = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon-key' }

describe('accountsEnabled (M29)', () => {
  it('a build ignores the Supabase keys without the opt-in', () => {
    expect(accountsEnabled({ command: 'build', env: KEYS })).toBe(false)
    expect(accountsEnabled({ command: 'build', env: KEYS, optIn: 'true' })).toBe(false)
  })
  it('a build uses the keys only with JEZ_ENABLE_ACCOUNTS=1', () => {
    expect(ACCOUNTS_OPT_IN).toBe('JEZ_ENABLE_ACCOUNTS')
    expect(accountsEnabled({ command: 'build', env: KEYS, optIn: '1' })).toBe(true)
  })
  it('the opt-in alone does nothing without both keys', () => {
    expect(accountsEnabled({ command: 'build', env: {}, optIn: '1' })).toBe(false)
    expect(accountsEnabled({ command: 'build', env: { VITE_SUPABASE_URL: KEYS.VITE_SUPABASE_URL }, optIn: '1' })).toBe(false)
  })
  it('the dev server keeps reading the keys as before', () => {
    expect(accountsEnabled({ command: 'serve', env: KEYS })).toBe(true)
    expect(accountsEnabled({ command: 'serve', env: {} })).toBe(false)
  })
})

describe('vite.config.js build settings (M29)', () => {
  const saved = {}
  const setEnv = (vars) => {
    for (const [k, v] of Object.entries(vars)) {
      if (!(k in saved)) saved[k] = process.env[k]
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
      delete saved[k]
    }
  })
  const pluginNames = (cfg) => cfg.plugins.flat().map((p) => p && p.name)

  it('compiles the keys out of a build when the opt-in is missing, even if they are set', () => {
    setEnv({ ...KEYS, [ACCOUNTS_OPT_IN]: undefined })
    const cfg = viteConfig({ command: 'build', mode: 'production' })
    expect(cfg.define['import.meta.env.VITE_SUPABASE_URL']).toBe('""')
    expect(cfg.define['import.meta.env.VITE_SUPABASE_ANON_KEY']).toBe('""')
    expect(pluginNames(cfg)).toContain('present-value-standalone-html')
  })
  it('keeps the keys in an opted-in build', () => {
    setEnv({ ...KEYS, [ACCOUNTS_OPT_IN]: '1' })
    const cfg = viteConfig({ command: 'build', mode: 'production' })
    expect(cfg.define['import.meta.env.VITE_SUPABASE_URL']).toBeUndefined()
  })
})
