import React from 'react'

// Audit Nov 2026 (S1, S11): a page that fails to draw used to leave a blank
// white screen with no way out. This shows a plain message instead, with a way
// to keep a copy of the data saved in this browser and links back into the
// app. Going to another page (a new #/ address) clears the message.
//
// The copy is read straight from the browser's storage (keys starting with
// "pv."), not through the app's state, so it works even when the app's own
// data could not be loaded.

export function storedDataSnapshot(storage = globalThis.localStorage) {
  const out = {}
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (!k || !k.startsWith('pv.')) continue
      const raw = storage.getItem(k)
      try { out[k] = JSON.parse(raw) } catch { out[k] = raw }
    }
  } catch { /* storage blocked: nothing to copy */ }
  return out
}

function downloadSnapshot() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), storedData: storedDataSnapshot() }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'jez-tax-suite-data-copy.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
    this.onHashChange = () => { if (this.state.failed) this.setState({ failed: false }) }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.onHashChange)
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.onHashChange)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="page wrap" style={{ paddingTop: '40px', paddingBottom: '64px', maxWidth: '640px' }}>
        <div className="card pad" role="alert">
          <h1 className="pg-h1" style={{ fontSize: '22px' }}>This page could not be shown</h1>
          <p style={{ fontSize: '14px', lineHeight: 1.6, marginTop: '10px' }}>
            Something went wrong while drawing this page. Your saved profiles have not been changed. You can go
            back to the calendar, reload the page, or keep a copy of the data saved in this browser first.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
            <a className="btn" href="#/">Go to the calendar</a>
            <button type="button" className="btn" onClick={() => window.location.reload()}>Reload</button>
            <button type="button" className="btn" onClick={downloadSnapshot}>Download a copy of my data</button>
          </div>
        </div>
      </main>
    )
  }
}
