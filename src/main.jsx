import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AppStateProvider } from './state/AppState.jsx'
import './styles/app.css'

// HashRouter so the built app also works from static hosting with no
// rewrite rules (and from file://), matching the v1 zero-server spirit.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </HashRouter>
  </React.StrictMode>
)
