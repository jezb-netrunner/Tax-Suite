import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { OBLIGATIONS } from '../lib/deadlineData.js'
import { generateChecklist } from '../engine/deadlines.js'
import { AgencyTag, ConfidenceBadge, Disclaimer } from '../components/ui.jsx'

// Recurring, no-fixed-date obligations + the dated "upkeep" items grouped by
// theme — the stuff that keeps a registration healthy between filings.
export default function Checklist() {
  const app = useApp()
  const nav = useNavigate()
  const p = app.active

  const items = useMemo(() => (p ? generateChecklist(OBLIGATIONS, p) : []), [p])

  if (!app.profilesReady) return null
  if (!p) {
    return (
      <div className="page wrap" style={{ paddingTop: '40px', paddingBottom: '64px' }}>
        <div className="card pad empty-note">
          Create a taxpayer profile to see the compliance checklist that applies to it.
          <div style={{ marginTop: '14px' }}><button className="btn" onClick={() => nav('/profiles/new')}>Create a profile</button></div>
        </div>
      </div>
    )
  }

  const groups = [
    ['admin', 'Day-to-day compliance'],
    ['registration', 'Registration upkeep'],
    ['income', 'Filing habits'],
  ]

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px', maxWidth: '860px' }}>
      <h1 className="pg-h1">Compliance checklist</h1>
      <p className="pg-sub">
        The obligations with no countdown clock — recurring habits and registration upkeep for <b>{p.name}</b>.
        Dated deadlines live on the <button className="linkbtn" style={{ fontSize: '14px' }} onClick={() => nav('/')}>calendar</button>.
      </p>

      {groups.map(([cat, label]) => {
        const inCat = items.filter(i => i.category === cat)
        if (!inCat.length) return null
        return (
          <div key={cat} style={{ marginTop: '26px' }}>
            <h3 className="sec-h" style={{ marginBottom: '12px' }}>{label}</h3>
            <div className="list-card">
              {inCat.map(ob => (
                <div key={ob.id} className="check-row">
                  <span className="check-dot" aria-hidden="true"></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      {ob.title}
                      {ob.confidence !== 'verified' && <ConfidenceBadge confidence={ob.confidence} />}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '3px', lineHeight: 1.55 }}>{ob.desc}</div>
                    {ob.notes && <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '5px', lineHeight: 1.5 }}>{ob.notes}</div>}
                    <div className="cite" style={{ marginTop: '6px' }}>{(ob.legalBasis || []).join(' · ')}</div>
                  </div>
                  <AgencyTag agency={ob.agency} />
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <Disclaimer lead="This is a general guide, not tax or legal advice.">
        This checklist covers the recurring obligations most taxpayers of this type meet; industry-specific
        requirements (secondary licenses, special registrations) may add more. Confirm the complete set with
        your CPA.
      </Disclaimer>
    </div>
  )
}
