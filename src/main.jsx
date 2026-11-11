import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppStateProvider } from './state/AppState.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './styles/fonts.css'
import './styles/app.css'

// HashRouter so the built app also works from static hosting with no
// rewrite rules (and from file://), matching the v1 zero-server spirit.
// L19: the two v7 behaviours are switched on now (every path in the app is
// absolute, so neither changes anything), which keeps the later move to
// React Router 7.18+ small.
const ROUTER_FUTURE = { v7_startTransition: true, v7_relativeSplatPath: true }

// Audit Nov 12, 2026 (X19): a failure outside drawing (a download, a sign-out)
// used to vanish. It is logged with a plain line the user can report; the
// app's own save failures already show their own notice.
window.addEventListener('unhandledrejection', e => {
  console.error('JEZ Tax Suite: an action did not finish.', e.reason)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HashRouter future={ROUTER_FUTURE}>
        <AppStateProvider>
          <App />
        </AppStateProvider>
      </HashRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
