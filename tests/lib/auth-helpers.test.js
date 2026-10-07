// M28: "Forgot password?", "Set a new password" after the reset link,
// "Change password" for signed-in users, and plain error messages that never
// echo Supabase's raw text or reveal whether an email has an account.
// Every helper is run against a mocked Supabase client.
import { describe, it, expect, vi } from 'vitest'
import {
  signIn, signUp, requestPasswordReset, setNewPassword, changePassword, friendlyAuthError,
  appRedirectUrl, isRecoveryLink, authLinkError, passwordProblem, MIN_PASSWORD_LENGTH, AUTH_MESSAGES,
} from '../../src/lib/auth.js'

const err = (code, status, message = 'raw server text ' + code) => ({ code, status, message, name: 'AuthApiError' })
const ok = data => ({ data, error: null })
const fail = e => ({ data: { user: null, session: null }, error: e })

function client(over = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn(async () => ok({ session: { access_token: 't' }, user: { id: 'u1' } })),
      signUp: vi.fn(async () => ok({ user: { id: 'u1' }, session: null })),
      resetPasswordForEmail: vi.fn(async () => ok({})),
      updateUser: vi.fn(async () => ok({ user: { id: 'u1' } })),
      ...over,
    },
  }
}

describe('M28 messages are plain and generic', () => {
  it('uses fixed texts', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(AUTH_MESSAGES).toEqual({
      signInFailed: "We couldn't sign you in with that email and password. Check them and try again. If you just signed up, open the confirmation link in your email first.",
      signUpFailed: 'We couldn\'t create the account. If you already have one, sign in or use "Forgot password?".',
      signUpDone: 'Account created. Check your inbox for a confirmation link, then sign in.',
      resetSent: "If an account uses this email, we've sent it a link to set a new password. Check your inbox and spam folder.",
      passwordChanged: 'Your password has been changed.',
      network: "We couldn't reach the server. Check your internet connection and try again.",
      rateLimited: 'Too many attempts. Please wait a few minutes and try again.',
      weakPassword: 'Choose a stronger password: at least 8 characters, and not one that is common or has appeared in a data leak.',
      samePassword: 'Choose a password different from your current one.',
      tooShort: 'Use at least 8 characters.',
      mismatch: 'The two passwords do not match.',
      emailMissing: 'Enter your email address.',
      currentMissing: 'Enter your current password.',
      currentWrong: 'Your current password is not correct.',
      linkExpired: 'This link has expired or was already used. Ask for a new one with "Forgot password?".',
      linkFailed: 'That email link did not work. Please try again, or ask for a new one with "Forgot password?".',
      generic: 'Something went wrong. Please try again.',
    })
  })

  it('wrong password and unconfirmed email read the same, so they reveal nothing', () => {
    expect(friendlyAuthError(err('invalid_credentials', 400), 'signIn')).toBe(AUTH_MESSAGES.signInFailed)
    expect(friendlyAuthError(err('email_not_confirmed', 400), 'signIn')).toBe(AUTH_MESSAGES.signInFailed)
    expect(friendlyAuthError(err('user_banned', 400), 'signIn')).toBe(AUTH_MESSAGES.signInFailed)
  })

  it('an already-registered email at sign-up gets the generic sign-up text', () => {
    expect(friendlyAuthError(err('user_already_exists', 422), 'signUp')).toBe(AUTH_MESSAGES.signUpFailed)
    expect(friendlyAuthError(err('email_exists', 422), 'signUp')).toBe(AUTH_MESSAGES.signUpFailed)
  })

  it('network, rate-limit, weak and same-password errors get their own plain text', () => {
    expect(friendlyAuthError({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' }, 'signIn')).toBe(AUTH_MESSAGES.network)
    expect(friendlyAuthError(err('over_request_rate_limit', 429), 'signIn')).toBe(AUTH_MESSAGES.rateLimited)
    expect(friendlyAuthError(err('over_email_send_rate_limit', 429), 'reset')).toBe(AUTH_MESSAGES.rateLimited)
    expect(friendlyAuthError(err('weak_password', 422), 'signUp')).toBe(AUTH_MESSAGES.weakPassword)
    expect(friendlyAuthError(err('same_password', 422), 'updatePassword')).toBe(AUTH_MESSAGES.samePassword)
  })

  it('a missing or expired recovery session asks for a new link', () => {
    expect(friendlyAuthError(err('session_not_found', 401), 'updatePassword')).toBe(AUTH_MESSAGES.linkExpired)
    expect(friendlyAuthError({ name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' }, 'updatePassword')).toBe(AUTH_MESSAGES.linkExpired)
  })

  it('never returns the raw server text', () => {
    for (const action of ['signIn', 'signUp', 'reset', 'updatePassword', 'other']) {
      expect(friendlyAuthError(err('unexpected_failure', 500, 'Database error saving new user'), action)).not.toContain('Database')
    }
  })
})

describe('M28 sign in and sign up', () => {
  it('signIn passes the email and password and returns a generic message on failure', async () => {
    const c = client({ signInWithPassword: vi.fn(async () => fail(err('invalid_credentials', 400, 'Invalid login credentials'))) })
    expect(await signIn(c, { email: 'ana@example.com', password: 'wrong-pass' })).toEqual({ ok: false, message: AUTH_MESSAGES.signInFailed })
    expect(c.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'wrong-pass' })
  })

  it('signIn succeeds', async () => {
    expect(await signIn(client(), { email: 'ana@example.com', password: 'correct-horse' })).toEqual({ ok: true, message: null })
  })

  it('signUp with an email that already has an account shows the same text as a new sign-up', async () => {
    // With "Confirm email" on, Supabase answers an existing email with a user
    // that has no identities and no session, and no error.
    const c = client({ signUp: vi.fn(async () => ok({ user: { id: 'x', identities: [] }, session: null })) })
    const r = await signUp(c, { email: 'ana@example.com', password: 'longenough', consent: true, redirectTo: 'https://example.ph/tax/' })
    expect(r).toEqual({ ok: true, session: null, message: AUTH_MESSAGES.signUpDone })
  })

  it('signUp errors are generic', async () => {
    const c = client({ signUp: vi.fn(async () => fail(err('user_already_exists', 422, 'User already registered'))) })
    const r = await signUp(c, { email: 'ana@example.com', password: 'longenough', consent: true })
    expect(r).toEqual({ ok: false, message: AUTH_MESSAGES.signUpFailed })
  })

  it('signUp refuses a short password before calling Supabase', async () => {
    const c = client()
    expect(await signUp(c, { email: 'ana@example.com', password: 'short', consent: true })).toEqual({ ok: false, message: AUTH_MESSAGES.tooShort })
    expect(c.auth.signUp).not.toHaveBeenCalled()
  })
})

describe('M28 Forgot password?', () => {
  it('sends the reset email with the app address as the return link', async () => {
    const c = client()
    const r = await requestPasswordReset(c, { email: ' ana@example.com ', redirectTo: 'https://example.ph/tax/' })
    expect(r).toEqual({ ok: true, message: AUTH_MESSAGES.resetSent })
    expect(c.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana@example.com', { redirectTo: 'https://example.ph/tax/' })
  })

  it('says the same thing whether or not the email has an account', async () => {
    const c = client({ resetPasswordForEmail: vi.fn(async () => fail(err('user_not_found', 404, 'User not found'))) })
    expect(await requestPasswordReset(c, { email: 'nobody@example.com', redirectTo: 'https://example.ph/tax/' }))
      .toEqual({ ok: true, message: AUTH_MESSAGES.resetSent })
  })

  it('reports rate limits and network trouble, which reveal nothing about the account', async () => {
    const c = client({ resetPasswordForEmail: vi.fn(async () => fail(err('over_email_send_rate_limit', 429))) })
    expect(await requestPasswordReset(c, { email: 'ana@example.com' })).toEqual({ ok: false, message: AUTH_MESSAGES.rateLimited })
    const d = client({ resetPasswordForEmail: vi.fn(async () => fail({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })) })
    expect(await requestPasswordReset(d, { email: 'ana@example.com' })).toEqual({ ok: false, message: AUTH_MESSAGES.network })
  })

  it('asks for the email when the box is empty', async () => {
    const c = client()
    expect(await requestPasswordReset(c, { email: '  ' })).toEqual({ ok: false, message: AUTH_MESSAGES.emailMissing })
    expect(c.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})

describe('M28 Set a new password (after the reset link)', () => {
  it('updates the password', async () => {
    const c = client()
    expect(await setNewPassword(c, { password: 'new-password-1', confirm: 'new-password-1' })).toEqual({ ok: true, message: AUTH_MESSAGES.passwordChanged })
    expect(c.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password-1' })
  })

  it('checks length and that both boxes match before calling Supabase', async () => {
    const c = client()
    expect(await setNewPassword(c, { password: 'short', confirm: 'short' })).toEqual({ ok: false, message: AUTH_MESSAGES.tooShort })
    expect(await setNewPassword(c, { password: 'new-password-1', confirm: 'new-password-2' })).toEqual({ ok: false, message: AUTH_MESSAGES.mismatch })
    expect(c.auth.updateUser).not.toHaveBeenCalled()
  })

  it('an expired link asks for a new one', async () => {
    const c = client({ updateUser: vi.fn(async () => fail(err('session_not_found', 401))) })
    expect(await setNewPassword(c, { password: 'new-password-1', confirm: 'new-password-1' })).toEqual({ ok: false, message: AUTH_MESSAGES.linkExpired })
  })
})

describe('M28 Change password (signed in)', () => {
  it('checks the current password first, then sets the new one', async () => {
    const order = []
    const c = client({
      signInWithPassword: vi.fn(async a => { order.push(['signIn', a]); return ok({ session: {} }) }),
      updateUser: vi.fn(async a => { order.push(['updateUser', a]); return ok({ user: {} }) }),
    })
    const r = await changePassword(c, { email: 'ana@example.com', currentPassword: 'correct-horse', newPassword: 'battery-staple', confirm: 'battery-staple' })
    expect(r).toEqual({ ok: true, message: AUTH_MESSAGES.passwordChanged })
    expect(order).toEqual([
      ['signIn', { email: 'ana@example.com', password: 'correct-horse' }],
      ['updateUser', { password: 'battery-staple' }],
    ])
  })

  it('a wrong current password stops before any change', async () => {
    const c = client({ signInWithPassword: vi.fn(async () => fail(err('invalid_credentials', 400))) })
    const r = await changePassword(c, { email: 'ana@example.com', currentPassword: 'nope-nope', newPassword: 'battery-staple', confirm: 'battery-staple' })
    expect(r).toEqual({ ok: false, message: AUTH_MESSAGES.currentWrong })
    expect(c.auth.updateUser).not.toHaveBeenCalled()
  })

  it('validates the boxes first', async () => {
    const c = client()
    expect(await changePassword(c, { email: 'a@b.ph', currentPassword: '', newPassword: 'battery-staple', confirm: 'battery-staple' })).toEqual({ ok: false, message: AUTH_MESSAGES.currentMissing })
    expect(await changePassword(c, { email: 'a@b.ph', currentPassword: 'x', newPassword: 'short', confirm: 'short' })).toEqual({ ok: false, message: AUTH_MESSAGES.tooShort })
    expect(await changePassword(c, { email: 'a@b.ph', currentPassword: 'x', newPassword: 'battery-staple', confirm: 'battery-stapl' })).toEqual({ ok: false, message: AUTH_MESSAGES.mismatch })
    expect(c.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('reusing the current password is refused with a plain message', async () => {
    const c = client({ updateUser: vi.fn(async () => fail(err('same_password', 422))) })
    const r = await changePassword(c, { email: 'a@b.ph', currentPassword: 'battery-staple', newPassword: 'battery-staple', confirm: 'battery-staple' })
    expect(r).toEqual({ ok: false, message: AUTH_MESSAGES.samePassword })
  })
})

describe('M28 links', () => {
  it('the reset link returns to this app page, without the in-app route', () => {
    expect(appRedirectUrl({ origin: 'https://jezb-netrunner.github.io', pathname: '/Tax-Suite/', hash: '#/profiles', search: '' }))
      .toBe('https://jezb-netrunner.github.io/Tax-Suite/')
    expect(appRedirectUrl({ origin: 'https://tax.example.ph', pathname: '/index.html', hash: '#/', search: '?x=1' }))
      .toBe('https://tax.example.ph/index.html')
    // Opened from disk: let Supabase use its configured Site URL.
    expect(appRedirectUrl({ origin: 'null', pathname: '/home/me/index.html' })).toBe(undefined)
  })

  it('recognises a password-reset link', () => {
    expect(isRecoveryLink('https://tax.example.ph/#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery')).toBe(true)
    expect(isRecoveryLink('https://tax.example.ph/#access_token=abc&type=signup')).toBe(false)
    expect(isRecoveryLink('https://tax.example.ph/#/profiles')).toBe(false)
    expect(isRecoveryLink('https://tax.example.ph/')).toBe(false)
  })

  it('explains a failed email link in plain words', () => {
    expect(authLinkError('https://tax.example.ph/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toBe(AUTH_MESSAGES.linkExpired)
    expect(authLinkError('https://tax.example.ph/#error=server_error&error_description=Something')).toBe(AUTH_MESSAGES.linkFailed)
    expect(authLinkError('https://tax.example.ph/#/')).toBe(null)
  })

  it('password rules', () => {
    expect(passwordProblem('1234567')).toBe(AUTH_MESSAGES.tooShort)
    expect(passwordProblem('12345678')).toBe(null)
    expect(passwordProblem('12345678', '12345679')).toBe(AUTH_MESSAGES.mismatch)
  })
})
