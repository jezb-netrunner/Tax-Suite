import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/backend.js'
import { signUp } from '../lib/auth.js'

// Opens the Privacy Notice in a new tab so a half-filled form is not lost.
function PrivacyLink({ children = 'Privacy Notice' }) {
  return (
    <Link to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accInk)', fontWeight: 600, textDecoration: 'underline' }}>
      {children}<span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}> (opens in a new tab)</span>
    </Link>
  )
}

export default function AuthPage() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setOk(null)
    try {
      if (mode === 'signup') {
        const r = await signUp(supabase, { email, password, consent })
        if (r.ok) setOk(r.message); else setErr(r.message)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (ex) {
      setErr(ex.message || 'Something went wrong. Please try again.')
    }
    setBusy(false)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '22px' }}>
          <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 21, margin: '0 auto' }}>₱</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-.02em', marginTop: '14px' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--mut)', marginTop: '6px', lineHeight: 1.5 }}>
            Your tax calendar, estimates, and checklists, saved to your account, for every business you manage.
          </p>
        </div>
        <form className="card pad" onSubmit={submit}>
          <div className="field" style={{ marginTop: 0 }}>
            <label className="lbl" htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="lbl" htmlFor="auth-pass">Password</label>
            <input id="auth-pass" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} />
          </div>
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
          {err && <div className="form-err" role="alert">{err}</div>}
          {ok && <div className="form-ok" role="status">{ok}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ width: '100%', marginTop: '18px' }}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            {mode === 'signin' ? (
              <button type="button" className="linkbtn" onClick={() => { setMode('signup'); setErr(null); setOk(null) }}>New here? Create an account</button>
            ) : (
              <button type="button" className="linkbtn" onClick={() => { setMode('signin'); setErr(null); setOk(null) }}>Already have an account? Sign in</button>
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
