import React, { useState } from 'react'
import { supabase } from '../lib/backend.js'

export default function AuthPage() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [ok, setOk] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setOk(null)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) setOk('Account created — loading your workspace…')
        else setOk('Account created. Check your inbox for a confirmation link, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (ex) {
      setErr(ex.message || 'Something went wrong — please try again.')
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
            Your tax calendar, estimates, and checklists — saved to your account, for every business you manage.
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
        <p style={{ fontSize: '11.5px', color: 'var(--dim)', textAlign: 'center', marginTop: '16px', lineHeight: 1.6 }}>
          Present Value provides estimates and reminders, not tax or legal advice.
        </p>
      </div>
    </div>
  )
}
