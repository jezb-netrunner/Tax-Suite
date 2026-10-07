// Account helpers for accounts mode (Supabase). Each one takes the Supabase
// client as its first argument, so the tests can pass a mock, and returns
// { ok, message } with a plain-language message for the screen.

// The Privacy Notice version the user agrees to at sign-up (its "last updated"
// date). Stored with the account together with the time of consent.
export const PRIVACY_NOTICE_VERSION = '2026-10-07'

export const CONSENT_REQUIRED = 'Please tick the box to agree to the Privacy Notice before creating an account.'

export async function signUp(client, { email, password, consent, redirectTo, now = new Date() } = {}) {
  if (!consent) return { ok: false, message: CONSENT_REQUIRED }
  const options = {
    data: { privacy_notice_version: PRIVACY_NOTICE_VERSION, privacy_consent_at: now.toISOString() },
  }
  if (redirectTo) options.emailRedirectTo = redirectTo
  const { data, error } = await client.auth.signUp({ email, password, options })
  if (error) return { ok: false, message: error.message || 'Something went wrong. Please try again.' }
  const session = (data && data.session) || null
  return {
    ok: true,
    session,
    message: session
      ? 'Account created. Loading your workspace…'
      : 'Account created. Check your inbox for a confirmation link, then sign in.',
  }
}
