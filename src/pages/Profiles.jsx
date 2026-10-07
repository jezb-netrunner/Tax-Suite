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
          <div key={p.id} className="frow">
            <div className="avatar" aria-hidden="true" style={{ cursor: 'default' }}>{(p.name || '?').trim().charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '14.5px' }}>
                {p.name}
                {app.active && app.active.id === p.id && <span className="tag" style={{ marginLeft: '10px', background: 'var(--accSoft)', color: 'var(--accInk)' }}>active</span>}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '2px' }}>
                {PROFILE_TYPES[p.type]?.name}
                {(p.type !== 'employee') && <> · {p.vatRegistered ? 'VAT' : 'Non-VAT'}</>}
                {p.hasEmployees && <> · employer</>}
              </div>
            </div>
            {confirmId === p.id ? (
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button className="btn sm danger" onClick={async () => { await app.remove(p.id); setConfirmId(null) }}>Delete</button>
                <button className="btn sm ghost" onClick={() => setConfirmId(null)}>Keep</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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

      {!app.hasCloud && (
        <p className="cite" style={{ marginTop: '14px' }}>
          Running in local mode: profiles are saved in this browser only. Connect a Supabase project (see .env.example) to enable accounts that sync across devices.
        </p>
      )}
    </div>
  )
}
