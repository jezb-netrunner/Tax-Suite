// Account helpers for accounts mode (Supabase). Each one takes the Supabase
// client as its first argument, so the tests can pass a mock, and returns
// { ok, message } with a plain-language message for the screen.
//
// Messages never repeat Supabase's own error text, and sign-in, sign-up and
// "Forgot password?" answer the same way whether or not an email has an
// account, so the screens cannot be used to find out who uses the app.

// The Privacy Notice version the user agrees to at sign-up (its "last updated"
// date). Stored with the account together with the time of consent.
export const PRIVACY_NOTICE_VERSION = '2026-10-07'

export const CONSENT_REQUIRED = 'Please tick the box to agree to the Privacy Notice before creating an account.'

// Keep in step with the minimum password length set in Supabase (README).
export const MIN_PASSWORD_LENGTH = 8

export const AUTH_MESSAGES = {
  signInFailed: "We couldn't sign you in with that email and password. Check them and try again. If you just signed up, open the confirmation link in your email first.",
  signUpFailed: 'We couldn\'t create the account. If you already have one, sign in or use "Forgot password?".',
  signUpDone: 'Account created. Check your inbox for a confirmation link, then sign in.',
  resetSent: "If an account uses this email, we've sent it a link to set a new password. Check your inbox and spam folder.",
  passwordChanged: 'Your password has been changed.',
  network: "We couldn't reach the server. Check your internet connection and try again.",
  rateLimited: 'Too many attempts. Please wait a few minutes and try again.',
  weakPassword: `Choose a stronger password: at least ${MIN_PASSWORD_LENGTH} characters, and not one that is common or has appeared in a data leak.`,
  samePassword: 'Choose a password different from your current one.',
  tooShort: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
  mismatch: 'The two passwords do not match.',
  emailMissing: 'Enter your email address.',
  currentMissing: 'Enter your current password.',
  currentWrong: 'Your current password is not correct.',
  linkExpired: 'This link has expired or was already used. Ask for a new one with "Forgot password?".',
  linkFailed: 'That email link did not work. Please try again, or ask for a new one with "Forgot password?".',
  generic: 'Something went wrong. Please try again.',
}
const M = AUTH_MESSAGES

const SESSION_GONE = new Set([
  'session_not_found', 'session_expired', 'bad_jwt', 'no_authorization', 'refresh_token_not_found',
  'refresh_token_already_used', 'otp_expired', 'flow_state_expired', 'flow_state_not_found',
])

// action: 'signIn' | 'signUp' | 'reset' | 'updatePassword' | other
export function friendlyAuthError(error, action) {
  if (!error) return M.generic
  const code = error.code || error.error_code || ''
  const status = error.status
  if (error.name === 'AuthRetryableFetchError' || status === 0 || error.name === 'TypeError') return M.network
  if (status === 429 || /rate_limit/.test(code)) return M.rateLimited
  if (code === 'weak_password') return M.weakPassword
  if (code === 'same_password') return M.samePassword
  if (action === 'signIn') return M.signInFailed
  if (action === 'signUp') return M.signUpFailed
  if (action === 'updatePassword' && (SESSION_GONE.has(code) || status === 401 || error.name === 'AuthSessionMissingError')) {
    return M.linkExpired
  }
  return M.generic
}

export function passwordProblem(password, confirm) {
  if (!password || password.length < MIN_PASSWORD_LENGTH) return M.tooShort
  if (confirm !== undefined && password !== confirm) return M.mismatch
  return null
}

export async function signIn(client, { email, password } = {}) {
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, message: friendlyAuthError(error, 'signIn') }
  return { ok: true, message: null }
}

export async function signUp(client, { email, password, consent, redirectTo, now = new Date() } = {}) {
  if (!consent) return { ok: false, message: CONSENT_REQUIRED }
  const problem = passwordProblem(password)
  if (problem) return { ok: false, message: problem }
  const options = {
    data: { privacy_notice_version: PRIVACY_NOTICE_VERSION, privacy_consent_at: now.toISOString() },
  }
  if (redirectTo) options.emailRedirectTo = redirectTo
  const { data, error } = await client.auth.signUp({ email, password, options })
  if (error) return { ok: false, message: friendlyAuthError(error, 'signUp') }
  const session = (data && data.session) || null
  return { ok: true, session, message: session ? 'Account created. Loading your workspace…' : M.signUpDone }
}

// "Forgot password?": Supabase emails a link back to redirectTo. The answer is
// the same whether or not the email has an account.
export async function requestPasswordReset(client, { email, redirectTo } = {}) {
  const addr = (email || '').trim()
  if (!addr) return { ok: false, message: M.emailMissing }
  const opts = redirectTo ? { redirectTo } : {}
  const { error } = await client.auth.resetPasswordForEmail(addr, opts)
  if (error) {
    const m = friendlyAuthError(error, 'reset')
    if (m === M.network || m === M.rateLimited) return { ok: false, message: m }
  }
  return { ok: true, message: M.resetSent }
}

// "Set a new password", after opening the reset link (PASSWORD_RECOVERY).
export async function setNewPassword(client, { password, confirm } = {}) {
  const problem = passwordProblem(password, confirm)
  if (problem) return { ok: false, message: problem }
  const { error } = await client.auth.updateUser({ password })
  if (error) return { ok: false, message: friendlyAuthError(error, 'updatePassword') }
  return { ok: true, message: M.passwordChanged }
}

// "Change password" while signed in: the current password is checked first,
// so someone at an unlocked, signed-in computer cannot change it.
export async function changePassword(client, { email, currentPassword, newPassword, confirm } = {}) {
  if (!currentPassword) return { ok: false, message: M.currentMissing }
  const problem = passwordProblem(newPassword, confirm)
  if (problem) return { ok: false, message: problem }
  const check = await client.auth.signInWithPassword({ email, password: currentPassword })
  if (check.error) {
    const m = friendlyAuthError(check.error, 'signIn')
    return { ok: false, message: m === M.signInFailed ? M.currentWrong : m }
  }
  const { error } = await client.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, message: friendlyAuthError(error, 'updatePassword') }
  return { ok: true, message: M.passwordChanged }
}

// The address Supabase's emails link back to: this app page, without the
// in-app route. Opened from disk there is none (Supabase then uses its
// configured Site URL).
export function appRedirectUrl(loc = globalThis.location) {
  if (!loc || !loc.origin || loc.origin === 'null') return undefined
  return `${loc.origin}${loc.pathname}`
}

function urlParams(href) {
  const out = {}
  try {
    const u = new URL(href)
    const hash = u.hash.replace(/^#/, '')
    if (hash && !hash.startsWith('/')) new URLSearchParams(hash).forEach((v, k) => { out[k] = v })
    u.searchParams.forEach((v, k) => { out[k] = v })
  } catch { /* not a URL */ }
  return out
}

// True when the page was opened from a "reset your password" email link.
export function isRecoveryLink(href) {
  return urlParams(href).type === 'recovery'
}

// A plain message when an email link came back with an error, else null.
export function authLinkError(href) {
  const p = urlParams(href)
  if (!p.error && !p.error_code && !p.error_description) return null
  return p.error_code === 'otp_expired' ? M.linkExpired : M.linkFailed
}
