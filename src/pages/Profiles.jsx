import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { PROFILE_TYPES } from '../engine/profile.js'
import { exportFileName } from '../lib/backend.js'

function downloadJson(name, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const TEXT = { fontSize: '13.5px', color: 'var(--ink)', lineHeight: 1.6 }

// M27: local mode keeps client names and income as plain text in this browser.
export const SHARED_COMPUTER_WARNING = "Anyone who uses this browser can see these profiles. Don't use this on a shared computer."

// Developer setup text: compiled out of production builds.
const DEV_NOTE = import.meta.env.DEV
  ? 'Developer note: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example) to turn on accounts.'
  : null

export function LocalModeNote({ dev = import.meta.env.DEV }) {
  return (
    <div className="mini-warn" role="note" style={{ marginTop: '18px' }}>
      <p style={{ fontWeight: 700 }}>{SHARED_COMPUTER_WARNING}</p>
      <p style={{ marginTop: '4px' }}>
        Profiles are saved in this browser only. They are not sent to us and do not sync to your other devices.
        On a borrowed computer, use "Erase all data on this device" below when you are done.
      </p>
      {dev && DEV_NOTE && <p style={{ marginTop: '6px', fontSize: '12px' }}>{DEV_NOTE}</p>}
    </div>
  )
}

// M27: after signing in to an account, profiles saved earlier in this
// browser's local mode are offered for import, or can be erased.
export function LocalLeftovers() {
  const app = useApp()
  const [confirmErase, setConfirmErase] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const n = app.leftovers ? app.leftovers.length : 0
  if (!app.hasCloud || !app.signedIn || (!n && !msg)) return null
  const count = k => (k === 1 ? '1 profile' : `${k} profiles`)

  async function doImport() {
    setBusy(true); setMsg(null)
    try {
      const r = await app.importLeftovers()
      setMsg(r.failed
        ? { ok: false, text: `Imported ${count(r.imported)}. ${count(r.failed)} could not be imported and ${r.failed === 1 ? 'is' : 'are'} still in this browser; please try again later.` }
        : { ok: true, text: `Imported ${count(r.imported)} into your account and removed the copy from this browser.` })
    } catch (e) {
      setMsg({ ok: false, text: 'The import did not finish. Your profiles are still in this browser; please try again.' })
    }
    setBusy(false)
  }

  function doErase() {
    try {
      app.eraseLeftovers()
      setConfirmErase(false)
      setMsg({ ok: true, text: `Erased ${count(n)} from this browser.` })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
  }

  return (
    <div className="wrap" style={{ marginTop: '18px' }}>
      <section className="card pad" aria-labelledby="leftovers-h" style={{ borderColor: '#e7d3a8' }}>
        <p id="leftovers-h" className="sec-h">Profiles found in this browser</p>
        {n > 0 && (
          <>
            <p style={{ ...TEXT, marginTop: '6px' }}>
              This browser still holds {count(n)} saved before you signed in
              ({app.leftovers.map(p => p.name || 'Unnamed').join(', ')}). Import them into your account, or erase them
              so the next person who uses this browser cannot see them.
            </p>
            {!confirmErase ? (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
                <button className="btn sm" type="button" disabled={busy} onClick={doImport}>{busy ? 'Importing…' : 'Import them into your account'}</button>
                <button className="btn sm ghost" type="button" disabled={busy} onClick={() => setConfirmErase(true)}>Erase them</button>
              </div>
            ) : (
              <div role="group" aria-labelledby="leftovers-erase-q" className="mini-warn">
                <p id="leftovers-erase-q" style={{ fontWeight: 600 }}>Erase {count(n)} from this browser? This cannot be undone.</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  <button className="btn sm danger" type="button" autoFocus onClick={doErase}>Erase them</button>
                  <button className="btn sm ghost" type="button" onClick={() => setConfirmErase(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
        <div role="status" aria-live="polite">
          {msg && <div className={msg.ok ? 'form-ok' : 'form-err'}>{msg.text}</div>}
        </div>
        {n === 0 && msg && (
          <button className="linkbtn" type="button" style={{ marginTop: '10px' }} onClick={() => setMsg(null)}>Dismiss</button>
        )}
      </section>
    </div>
  )
}

// M25: Download my data, Erase all data on this device (local mode),
// Delete my account (accounts mode). Data Privacy Act rights to access,
// portability and erasure.
function YourData({ app }) {
  const [confirm, setConfirm] = useState(null) // null | 'erase' | 'delete'
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok: boolean, text }
  const confirmRef = useRef(null)
  const n = app.profiles.length
  const profilesText = n === 1 ? '1 profile' : `${n} profiles`

  // Move focus into the confirmation so keyboard and screen-reader users land on it.
  useEffect(() => { if (confirm && confirmRef.current) confirmRef.current.focus() }, [confirm])

  async function download() {
    setMsg(null)
    try {
      const data = await app.exportData()
      downloadJson(exportFileName(), data)
      setMsg({ ok: true, text: `Downloaded ${data.profiles.length === 1 ? '1 profile' : `${data.profiles.length} profiles`} as ${exportFileName()}.` })
    } catch (e) {
      setMsg({ ok: false, text: e.message || 'Could not prepare the download. Please try again.' })
    }
  }

  async function erase() {
    setBusy(true)
    try {
      await app.eraseAllData()
      setConfirm(null)
      setMsg({ ok: true, text: 'All JEZ Tax Suite data was erased from this browser.' })
    } catch (e) {
      setMsg({ ok: false, text: e.message })
    }
    setBusy(false)
  }

  async function deleteAccount() {
    setBusy(true)
    try {
      await app.deleteAccount()
    } catch (e) {
      setMsg({ ok: false, text: e.message })
      setBusy(false)
    }
  }

  return (
    <section className="card pad" aria-labelledby="your-data-h" style={{ marginTop: '26px' }}>
      <h2 id="your-data-h" className="sec-h">Your data</h2>
      <p style={{ ...TEXT, marginTop: '6px' }}>
        Download a copy of every profile with the figures, filed marks and checklist ticks saved in it,
        or remove it all. The <Link to="/privacy" style={{ color: 'var(--accInk)', fontWeight: 600 }}>Privacy Notice</Link> explains what is kept.
      </p>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
        <button className="btn sm ghost" type="button" onClick={download}>Download my data</button>
        {!app.hasCloud && (
          <button className="btn sm ghost" type="button" aria-expanded={confirm === 'erase'} onClick={() => { setMsg(null); setConfirm('erase') }}>Erase all data on this device</button>
        )}
        {app.hasCloud && (
          <button className="btn sm ghost" type="button" aria-expanded={confirm === 'delete'} onClick={() => { setMsg(null); setTyped(''); setConfirm('delete') }}>Delete my account</button>
        )}
      </div>

      {confirm === 'erase' && (
        <div role="group" aria-labelledby="erase-q" className="mini-warn" style={{ marginTop: '14px' }}>
          <p id="erase-q" ref={confirmRef} tabIndex={-1} style={{ fontWeight: 600, outline: 'none' }}>
            Erase {profilesText} and every saved figure from this browser?
          </p>
          <p style={{ marginTop: '4px' }}>This cannot be undone. Download your data first if you want a copy.</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button className="btn sm danger" type="button" disabled={busy} onClick={erase}>Erase everything</button>
            <button className="btn sm ghost" type="button" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {confirm === 'delete' && (
        <div role="group" aria-labelledby="delete-q" className="mini-warn" style={{ marginTop: '14px' }}>
          <p id="delete-q" ref={confirmRef} tabIndex={-1} style={{ fontWeight: 600, outline: 'none' }}>
            Delete your account{app.userEmail ? ` (${app.userEmail})` : ''} and the {profilesText} saved in it?
          </p>
          <p style={{ marginTop: '4px' }}>This cannot be undone. Download your data first if you want a copy.</p>
          <div className="field" style={{ marginTop: '10px' }}>
            <label className="lbl" htmlFor="delete-typed" style={{ color: 'inherit' }}>Type DELETE to confirm</label>
            <input id="delete-typed" type="text" autoComplete="off" value={typed} onChange={e => setTyped(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button className="btn sm danger" type="button" disabled={busy || typed.trim() !== 'DELETE'} onClick={deleteAccount}>
              {busy ? 'Deleting…' : 'Delete my account permanently'}
            </button>
            <button className="btn sm ghost" type="button" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div role="status" aria-live="polite">
        {msg && <div className={msg.ok ? 'form-ok' : 'form-err'}>{msg.text}</div>}
      </div>
    </section>
  )
}

export default function ProfilesPage() {
  const app = useApp()
  const nav = useNavigate()
  const [confirmId, setConfirmId] = useState(null)

  return (
    <div className="page wrap" style={{ paddingTop: '30px', paddingBottom: '64px', maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="pg-h1">Taxpayer profiles</h1>
          <p className="pg-sub">Every business or person you track. Switch between them from the avatar menu.</p>
        </div>
        <button className="btn" onClick={() => nav('/profiles/new')}>+ New profile</button>
      </div>

      {!app.hasCloud && <LocalModeNote />}

      {app.loadError && (
        <div className="form-err" role="alert" style={{ marginTop: '18px' }}>
          Couldn’t load your saved profiles. This is a loading problem, not lost data.{' '}
          <button className="linkbtn" style={{ color: 'inherit', textDecoration: 'underline' }} onClick={() => app.retryLoad()}>Try again</button>
        </div>
      )}

      <div className="list-card" style={{ marginTop: '22px' }}>
        {app.profiles.length === 0 && !app.loadError && (
          <div className="empty-note">No profiles yet. Create one to get a personalized calendar, estimates, and checklist.</div>
        )}
        {app.profiles.map(p => (
          // H15: below 720 px the buttons move under the name (see .profile-row).
          <div key={p.id} className="frow profile-row">
            <div className="avatar" aria-hidden="true" style={{ cursor: 'default' }}>{(p.name || '?').trim().charAt(0).toUpperCase()}</div>
            <div className="profile-row-body">
              <div style={{ fontWeight: 600, fontSize: '14.5px', overflowWrap: 'anywhere' }}>
                {p.name}
                {app.active && app.active.id === p.id && <span className="tag" style={{ marginLeft: '10px', background: 'var(--accSoft)', color: 'var(--accInk)', display: 'inline-block' }}>active</span>}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '2px' }}>
                {PROFILE_TYPES[p.type]?.name}
                {(p.type !== 'employee') && <> · {p.vatRegistered ? 'VAT' : 'Non-VAT'}</>}
                {p.hasEmployees && <> · employer</>}
              </div>
            </div>
            {confirmId === p.id ? (
              <div className="profile-row-actions">
                <button className="btn sm danger" onClick={async () => { await app.remove(p.id); setConfirmId(null) }}>Delete</button>
                <button className="btn sm ghost" onClick={() => setConfirmId(null)}>Keep</button>
              </div>
            ) : (
              <div className="profile-row-actions">
                {(!app.active || app.active.id !== p.id) && (
                  <button className="btn sm ghost" onClick={() => app.setActive(p.id)}>Use</button>
                )}
                <button className="btn sm ghost" onClick={() => nav(`/profiles/${p.id}/edit`)}>Edit</button>
                <button className="btn sm ghost" onClick={() => setConfirmId(p.id)} aria-label={`Delete ${p.name}`}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <YourData app={app} />
    </div>
  )
}
