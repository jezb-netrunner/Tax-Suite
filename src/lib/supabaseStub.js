// M23: stands in for @supabase/supabase-js in a local-mode build, so the
// account library (about 200 kB) is not shipped to people who cannot use it.
// vite.config.js swaps it in only for a build without accounts; such a build
// also compiles the Supabase keys out, so backend.js never calls this.
export function createClient() {
  throw new Error('Accounts are not switched on in this build of JEZ Tax Suite.')
}
