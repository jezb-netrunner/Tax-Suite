// M29: decides whether a build has accounts mode (Supabase) switched on.
//
// `npm run build` ignores VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (from the
// shell or a .env file) so the committed single-file index.html is always the
// local-mode app. A build turns accounts on only when BOTH keys are set AND
// JEZ_ENABLE_ACCOUNTS=1. Such a build writes dist/ only and leaves the
// committed index.html alone. `npm run dev` (and the tests) still read the
// keys as before.
export const ACCOUNTS_OPT_IN = 'JEZ_ENABLE_ACCOUNTS'

export function accountsEnabled({ command, env = {}, optIn } = {}) {
  const keys = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
  if (command !== 'build') return keys
  return keys && optIn === '1'
}

// L18: what the Content-Security-Policy must let the app connect to in an
// accounts build: the Supabase project over HTTPS.
export function supabaseConnectSources(url) {
  if (!url) return []
  const u = new URL(url)
  // Audit Nov 12, 2026 (X17): the app opens no realtime (websocket) channel,
  // so only the project's https origin is allowed. Add the wss:// origin here
  // if realtime is ever used.
  return [u.origin]
}
