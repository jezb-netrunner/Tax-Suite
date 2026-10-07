import React, { useState, useRef, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useApp } from './state/AppState.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Estimator from './pages/Estimator.jsx'
import Checklist from './pages/Checklist.jsx'
import FormsPage from './pages/Forms.jsx'
import ToolsPage from './pages/Tools.jsx'
import BlogPage from './pages/Blog.jsx'
import References from './pages/References.jsx'
import AuthPage, { SetNewPassword, ChangePassword } from './pages/Auth.jsx'
import ProfileWizard from './pages/ProfileWizard.jsx'
import ProfilesPage, { LocalLeftovers, SHARED_COMPUTER_WARNING } from './pages/Profiles.jsx'
import Privacy from './pages/Privacy.jsx'
import meta from './data/rules/meta.json'
import { statuteListText } from './data/statutes.js'

function ProfileMenu() {
  const app = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    // pointerdown covers mouse and touch; iOS Safari doesn't emit compatibility
    // mouse events for taps on plain background elements.
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const initial = app.active ? (app.active.name || '?').trim().charAt(0).toUpperCase() : '+'

  return (
    <div className="menu-anchor" ref={ref}>
      <button className="avatar" aria-haspopup="menu" aria-expanded={open}
        title={app.active ? app.active.name : 'Profiles'}
        aria-label={app.active ? `Profiles (${app.active.name} selected)` : 'Profiles'}
        onClick={() => setOpen(o => !o)}><span aria-hidden="true">{initial}</span></button>
      {open && (
        <div className="menu-pop" role="menu">
          <div className="menu-head">Taxpayer profiles</div>
          {app.profiles.map(p => (
            <button key={p.id} role="menuitem"
              className={'menu-item' + (app.active && app.active.id === p.id ? ' active' : '')}
              onClick={() => { app.setActive(p.id); setOpen(false) }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            </button>
          ))}
          {app.profiles.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--mut)' }}>No profiles yet.</div>
          )}
          <div className="menu-sep" />
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); nav('/profiles/new') }}>+ New profile</button>
          <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); nav('/profiles') }}>Manage profiles</button>
          {app.hasCloud && (
            <>
              <div className="menu-sep" />
              <button className="menu-item" role="menuitem" onClick={() => { setOpen(false); nav('/account/password') }}>Change password</button>
              <button className="menu-item" role="menuitem" onClick={async () => { setOpen(false); await app.signOut() }}>Sign out</button>
            </>
          )}
          {!app.hasCloud && (
            <div style={{ margin: '8px 4px 2px', padding: '8px 10px', fontSize: '12px', color: '#6b4a12', background: 'var(--warnSoft)', borderRadius: '8px', lineHeight: 1.5 }}>
              Saved in this browser only. {SHARED_COMPUTER_WARNING}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function App() {
  const app = useApp()
  const location = useLocation()

  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])

  if (!app.authReady) return null

  const needsAuth = app.hasCloud && !app.signedIn
  if (needsAuth || app.recovery) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header className="hdr">
          <div className="brand">
            <div className="brand-mark">₱</div>
            <span className="brand-name">JEZ Tax Suite</span>
          </div>
        </header>
        <main style={{ flex: 1 }}>
          {app.recovery ? <SetNewPassword /> : (
            <Routes>
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<AuthPage />} />
            </Routes>
          )}
        </main>
      </div>
    )
  }

  const links = [
    ['/', 'Calendar'],
    ['/estimator', 'Estimator'],
    ['/checklist', 'Checklist'],
    ['/forms', 'Forms'],
    ['/tools', 'Tools'],
    ['/blog', 'Blog'],
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="hdr">
        <div className="hdr-left">
          <div className="brand">
            <div className="brand-mark">₱</div>
            <span className="brand-name">JEZ Tax Suite</span>
          </div>
          <nav className="nav" aria-label="Main">
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'}
                className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
            ))}
          </nav>
        </div>
        <ProfileMenu />
      </header>

      <main style={{ flex: 1 }}>
        <LocalLeftovers />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/estimator" element={<Estimator />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:postId" element={<BlogPage />} />
          <Route path="/references" element={<References />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/account/password" element={<ChangePassword />} />
          <Route path="/profiles" element={<ProfilesPage />} />
          <Route path="/profiles/new" element={<ProfileWizard />} />
          <Route path="/profiles/:profileId/edit" element={<ProfileWizard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="ftr">
        <p>
          <b>JEZ Tax Suite</b> provides estimates and reminders, not tax or legal advice, and does not replace
          review by a CPA. Rules follow Philippine tax law as amended by {statuteListText()}, plus
          BIR, SSS, PhilHealth, Pag-IBIG, SEC, and LGU issuances, with rules as of {meta.verifiedDate}. Every
          figure's legal basis and confidence is on the <NavLink to="/references" style={{ color: 'var(--accInk)', fontWeight: 600 }}>References</NavLink> page.
          Always confirm dates and amounts with the agency before filing.
        </p>
        <p style={{ marginTop: '8px' }}>
          <NavLink to="/privacy" style={{ color: 'var(--accInk)', fontWeight: 600 }}>Privacy Notice</NavLink>
        </p>
      </footer>
    </div>
  )
}
