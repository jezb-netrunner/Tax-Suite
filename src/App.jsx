import { useState, useRef, useEffect } from 'react'
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
import SaveNotice from './components/SaveNotice.jsx'
import meta from './data/rules/meta.json'
import { statuteListText } from './data/statutes.js'
import { pageTitle } from './lib/pageTitle.js'

// M21: after a page change, focus the new page's main heading so screen
// readers announce it (the heading gets tabindex -1 so it can take focus).
function focusMainHeading() {
  const h = document.querySelector('main h1')
  if (!h) return false
  if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1')
  h.focus({ preventScroll: true })
  return true
}

// L13: the profile switcher is a simple disclosure: the avatar button shows
// or hides a list of buttons. It closes on a click outside, when focus leaves
// it, and on Escape (focus goes back to the avatar).
function ProfileMenu() {
  const app = useApp()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    // pointerdown covers mouse and touch; iOS Safari doesn't emit compatibility
    // mouse events for taps on plain background elements.
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  function onKeyDown(e) {
    if (e.key === 'Escape' && open) {
      setOpen(false)
      if (btnRef.current) btnRef.current.focus()
    }
  }
  function onBlur(e) {
    if (open && ref.current && e.relatedTarget && !ref.current.contains(e.relatedTarget)) setOpen(false)
  }
  // Close, put focus back on the avatar, then act (a page change moves focus on).
  function choose(action) {
    setOpen(false)
    if (btnRef.current) btnRef.current.focus()
    action()
  }

  const initial = app.active ? (app.active.name || '?').trim().charAt(0).toUpperCase() : '+'

  return (
    <div className="menu-anchor" ref={ref} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button ref={btnRef} type="button" className="avatar" aria-expanded={open} aria-controls="profile-menu"
        title={app.active ? app.active.name : 'Profiles'}
        aria-label={app.active ? `Profiles (${app.active.name} selected)` : 'Profiles'}
        onClick={() => setOpen(o => !o)}><span aria-hidden="true">{initial}</span></button>
      {open && (
        <div className="menu-pop" id="profile-menu">
          <div className="menu-head" id="profile-menu-h">Taxpayer profiles</div>
          {app.profiles.length > 0 && (
            <ul className="menu-list" aria-labelledby="profile-menu-h">
              {app.profiles.map(p => {
                const current = Boolean(app.active && app.active.id === p.id)
                return (
                  <li key={p.id}>
                    <button type="button" aria-current={current ? 'true' : undefined}
                      className={'menu-item' + (current ? ' active' : '')}
                      onClick={() => choose(() => app.setActive(p.id))}>
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                      {current && <span aria-hidden="true">✓</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {app.profiles.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: '13px', color: 'var(--mut)' }}>No profiles yet.</div>
          )}
          <div className="menu-sep" />
          <ul className="menu-list" aria-label="Profile actions">
            <li><button type="button" className="menu-item" onClick={() => choose(() => nav('/profiles/new'))}>+ New profile</button></li>
            <li><button type="button" className="menu-item" onClick={() => choose(() => nav('/profiles'))}>Manage profiles</button></li>
            {app.hasCloud && (
              <>
                <li><button type="button" className="menu-item" onClick={() => choose(() => nav('/account/password'))}>Change password</button></li>
                <li><button type="button" className="menu-item" onClick={() => choose(() => app.signOut())}>Sign out</button></li>
              </>
            )}
          </ul>
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

// M17: on wide screens the six pages sit in one row. On narrower screens
// (see .nav-toggle in app.css) a "Menu" button opens the full list instead of
// hiding pages off-screen. It closes on a page change, a click outside, when
// focus leaves it, and on Escape (focus goes back to the button).
function MainNav({ links }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const wrapRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => { setOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  function onKeyDown(e) {
    if (e.key === 'Escape' && open) {
      setOpen(false)
      if (btnRef.current) btnRef.current.focus()
    }
  }
  function onBlur(e) {
    if (open && wrapRef.current && e.relatedTarget && !wrapRef.current.contains(e.relatedTarget)) setOpen(false)
  }

  return (
    <div className="nav-wrap" ref={wrapRef} onKeyDown={onKeyDown} onBlur={onBlur}>
      <button ref={btnRef} type="button" className="nav-toggle" aria-expanded={open} aria-controls="main-nav"
        onClick={() => setOpen(o => !o)}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          {open ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /> : <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />}
        </svg>
        Menu
      </button>
      <nav id="main-nav" className={'nav' + (open ? ' open' : '')} aria-label="Main">
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
            className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
        ))}
      </nav>
    </div>
  )
}

export default function App() {
  const app = useApp()
  const location = useLocation()

  // M21: each page has its own tab title ("Estimator · JEZ Tax Suite").
  const signedOut = app.hasCloud && !app.signedIn
  useEffect(() => {
    document.title = pageTitle(location.pathname, { signedOut, recovery: Boolean(app.recovery) })
  }, [location.pathname, signedOut, app.recovery])

  // Scroll to the top and move focus to the new page's heading on a page
  // change (not on the first load, where the browser starts at the top).
  const shownPath = useRef(location.pathname)
  useEffect(() => {
    window.scrollTo(0, 0)
    if (shownPath.current === location.pathname) return undefined
    shownPath.current = location.pathname
    if (focusMainHeading()) return undefined
    // A page that waits for data renders its heading a moment later.
    const id = requestAnimationFrame(() => { focusMainHeading() })
    return () => cancelAnimationFrame(id)
  }, [location.pathname])

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
          <MainNav links={links} />
        </div>
        <ProfileMenu />
      </header>

      <main style={{ flex: 1 }}>
        <LocalLeftovers />
        <SaveNotice />
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
