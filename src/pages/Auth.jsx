import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/backend.js'
import {
  signIn, signUp, requestPasswordReset, setNewPassword, changePassword, appRedirectUrl, MIN_PASSWORD_LENGTH,
} from '../lib/auth.js'
import { useApp } from '../state/AppState.jsx'

const SR_ONLY = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

// Opens the Privacy Notice in a new tab so a half-filled form is not lost.
function PrivacyLink({ children = 'Privacy Notice' }) {
  return (
    <Link to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accInk)', fontWeight: 600, textDecoration: 'underline' }}>
      {children}<span style={SR_ONLY}> (opens in a new tab)</span>
    </Link>
  )
}

function AuthHeader({ title, sub, headingRef }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '22px' }}>
      <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 21, margin: '0 auto' }}>₱</div>
      <h1 ref={headingRef} tabIndex={-1} style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.02em', marginTop: '14px', outline: 'none' }}>
        {title}
      </h1>
      {sub && <p style={{ fontSize: '13.5px', color: 'var(--ink)', marginTop: '6px', lineHeight: 1.5 }}>{sub}</p>}
    </div>
  )
}

function PasswordField({ id, label, value, onChange, autoComplete, hint, first }) {
  return (
    <div className="field" style={first ? { marginTop: 0 } : undefined}>
      <label className="lbl" htmlFor={id}>{label}</label>
      <input id={id} type="password" autoComplete={autoComplete} required minLength={autoComplete === 'new-password' ? MIN_PASSWORD_LENGTH : undefined}
        value={value} onChange={e => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint && <p id={`${id}-hint`} style={{ fontSize: '12.5px', color: 'var(--ink)', marginTop: '5px' }}>{hint}</p>}
    </div>
  )
}

const NEW_PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters.`

function Messages({ err, ok }) {
  return (
    <>
      {err && <div className="form-err" role="alert">{err}</div>}
      {ok && <div className="form-ok" role="status">{ok}</div>}
    </>
  )
}

export default function AuthPage() {
  const app = useApp()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(app.linkError || null)
  const [ok, setOk] = useState(null)
  const heading = useRef(null)
  const first = useRef(true)

  // Announce the new form when switching between sign in, sign up and reset.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (heading.current) heading.current.focus()
  }, [mode])

  function go(next) {
    setMode(next); setErr(null); setOk(null); setPassword('')
    if (app.clearNotice) app.clearNotice()
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setOk(null)
    if (app.clearNotice) app.clearNotice()
    let r
    try {
      if (mode === 'signup') r = await signUp(supabase, { email, password, consent, redirectTo: appRedirectUrl() })
      else if (mode === 'forgot') r = await requestPasswordReset(supabase, { email, redirectTo: appRedirectUrl() })
      else r = await signIn(supabase, { email, password })
    } catch {
      r = { ok: false, message: 'Something went wrong. Please try again.' }
    }
    if (r.ok) setOk(r.message); else setErr(r.message)
    setBusy(false)
  }

  const titles = { signin: 'Welcome back', signup: 'Create your account', forgot: 'Reset your password' }
  const subs = {
    signin: 'Your tax calendar, estimates, and checklists, saved to your account, for every business you manage.',
    signup: 'Your tax calendar, estimates, and checklists, saved to your account, for every business you manage.',
    forgot: "Enter the email you signed up with. We'll send a link to set a new password.",
  }
  const buttons = { signin: 'Sign in', signup: 'Create account', forgot: 'Send reset link' }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <AuthHeader title={titles[mode]} sub={subs[mode]} headingRef={heading} />
        {app.notice && <div className="form-ok" role="status" style={{ marginBottom: '14px' }}>{app.notice}</div>}
        <form className="card pad" onSubmit={submit}>
          <div className="field" style={{ marginTop: 0 }}>
            <label className="lbl" htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          {mode !== 'forgot' && (
            <PasswordField id="auth-pass" label="Password" value={password} onChange={setPassword}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              hint={mode === 'signup' ? NEW_PASSWORD_HINT : null} />
          )}
          {mode === 'signin' && (
            <div style={{ marginTop: '8px', textAlign: 'right' }}>
              <button type="button" className="linkbtn" onClick={() => go('forgot')}>Forgot password?</button>
            </div>
          )}
          {mode === 'signup' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '16px' }}>
              <input id="auth-consent" type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)}
                style={{ width: '20px', height: '20px', margin: '1px 0 0', flexShrink: 0, accentColor: 'var(--acc)', cursor: 'pointer' }} />
              <label htmlFor="auth-consent" style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--ink)', cursor: 'pointer' }}>
                I have read the <PrivacyLink /> and agree to JEZ Tax Suite storing my email address and the
                profiles and figures I enter, as the notice describes.
              </label>
            </div>
          )}
          <Messages err={err} ok={ok} />
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: '18px' }}>
            {busy ? 'Working…' : buttons[mode]}
          </button>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            {mode === 'signin' && (
              <button type="button" className="linkbtn" onClick={() => go('signup')}>New here? Create an account</button>
            )}
            {mode === 'signup' && (
              <button type="button" className="linkbtn" onClick={() => go('signin')}>Already have an account? Sign in</button>
            )}
            {mode === 'forgot' && (
              <button type="button" className="linkbtn" onClick={() => go('signin')}>Back to sign in</button>
            )}
          </div>
        </form>
        <p style={{ fontSize: '12px', color: 'var(--ink)', textAlign: 'center', marginTop: '16px', lineHeight: 1.6 }}>
          JEZ Tax Suite provides estimates and reminders, not tax or legal advice. <PrivacyLink />
        </p>
      </div>
    </div>
  )
}

// M28: shown after opening the "reset your password" email link (Supabase
// signs the user in with a recovery session and fires PASSWORD_RECOVERY).
export function SetNewPassword() {
  const app = useApp()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const r = await setNewPassword(supabase, { password, confirm }).catch(() => ({ ok: false, message: 'Something went wrong. Please try again.' }))
    if (r.ok) setDone(true); else setErr(r.message)
    setBusy(false)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <AuthHeader title="Set a new password" sub={app.userEmail ? `For ${app.userEmail}.` : null} />
        {done ? (
          <div className="card pad">
            <div className="form-ok" role="status" style={{ marginTop: 0 }}>Your password has been changed.</div>
            <button className="btn" type="button" autoFocus style={{ width: '100%', marginTop: '18px' }} onClick={() => app.endRecovery()}>
              Continue to JEZ Tax Suite
            </button>
          </div>
        ) : (
          <form className="card pad" onSubmit={submit}>
            <PasswordField id="new-pass" label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint={NEW_PASSWORD_HINT} first />
            <PasswordField id="new-pass2" label="Type it again" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            <Messages err={err} />
            <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: '18px' }}>
              {busy ? 'Working…' : 'Save new password'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '14px' }}>
              <button type="button" className="linkbtn" onClick={() => app.endRecovery()}>Not now</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// M28: "Change password" from the profile menu, for signed-in users.
export function ChangePassword() {
  const app = useApp()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  if (!app.hasCloud) {
    return (
      <div className="page wrap" style={{ paddingTop: '30px', paddingBottom: '64px', maxWidth: '520px' }}>
        <h1 className="pg-h1">Change password</h1>
        <p style={{ fontSize: '14px', color: 'var(--ink)', marginTop: '8px' }}>This site runs without accounts, so there is no password to change.</p>
      </div>
    )
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setOk(null)
    const r = await changePassword(supabase, { email: app.userEmail, currentPassword: current, newPassword: password, confirm })
      .catch(() => ({ ok: false, message: 'Something went wrong. Please try again.' }))
    if (r.ok) { setOk(r.message); setCurrent(''); setPassword(''); setConfirm('') } else setErr(r.message)
    setBusy(false)
  }

  return (
    <div className="page wrap" style={{ paddingTop: '30px', paddingBottom: '64px', maxWidth: '520px' }}>
      <h1 className="pg-h1">Change password</h1>
      <p style={{ fontSize: '14px', color: 'var(--ink)', marginTop: '6px' }}>
        {app.userEmail ? `Signed in as ${app.userEmail}.` : null} Enter your current password, then the new one twice.
      </p>
      <form className="card pad" style={{ marginTop: '18px' }} onSubmit={submit}>
        <PasswordField id="cur-pass" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" first />
        <PasswordField id="chg-pass" label="New password" value={password} onChange={setPassword} autoComplete="new-password" hint={NEW_PASSWORD_HINT} />
        <PasswordField id="chg-pass2" label="Type the new password again" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <Messages err={err} ok={ok} />
        <button className="btn" type="submit" disabled={busy} style={{ marginTop: '18px' }}>
          {busy ? 'Working…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}
