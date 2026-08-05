import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { PROFILE_TYPES } from '../engine/profile.js'

export default function ProfilesPage() {
  const app = useApp()
  const nav = useNavigate()
  const [confirmId, setConfirmId] = useState(null)

  return (
    <div className="page wrap" style={{ paddingTop: '30px', paddingBottom: '64px', maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="pg-h1">Taxpayer profiles</h1>
          <p className="pg-sub">Every business or person you track — switch between them from the avatar menu.</p>
        </div>
        <button className="btn" onClick={() => nav('/profiles/new')}>+ New profile</button>
      </div>

      {app.loadError && (
        <div className="form-err" role="alert" style={{ marginTop: '18px' }}>
          Couldn’t load your saved profiles — this is a loading problem, not lost data.{' '}
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

      {!app.hasCloud && (
        <p className="cite" style={{ marginTop: '14px' }}>
          Running in local mode — profiles are saved in this browser only. Connect a Supabase project (see .env.example) to enable accounts that sync across devices.
        </p>
      )}
    </div>
  )
}
