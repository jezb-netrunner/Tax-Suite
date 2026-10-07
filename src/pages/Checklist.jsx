import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { OBLIGATIONS } from '../lib/deadlineData.js'
import { generateChecklist, isChecked, withChecked, isUnconfirmed } from '../engine/deadlines.js'
import { AgencyTag, Disclaimer } from '../components/ui.jsx'
import { ItemBadge } from '../components/Confidence.jsx'
import { useManilaToday } from '../lib/useManilaToday.js'
import { useProfileMarks } from '../lib/useProfileMarks.js'

// Recurring, no-fixed-date obligations + the dated "upkeep" items grouped by
// theme — the stuff that keeps a registration healthy between filings.
export default function Checklist() {
  const app = useApp()
  const nav = useNavigate()
  const p = app.active

  // Ticks are saved on the profile (M09); `pv` shows a click before the save ends.
  const today = useManilaToday()
  const items = useMemo(() => (p ? generateChecklist(OBLIGATIONS, p, { today }) : []), [p, today])
  const { profile: pv, update, error } = useProfileMarks(app)

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

  const ticked = items.filter(ob => isChecked(pv, ob)).length
  const groups = [
    ['admin', 'Day-to-day compliance'],
    ['registration', 'Registration upkeep'],
    ['income', 'Filing habits'],
  ]

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px', maxWidth: '860px' }}>
      <h1 className="pg-h1">Compliance checklist</h1>
      <p className="pg-sub">
        The obligations with no countdown clock: recurring habits and registration upkeep for <b>{p.name}</b>.
        Dated deadlines live on the <button className="linkbtn" style={{ fontSize: '14px' }} onClick={() => nav('/')}>calendar</button>.
      </p>
      <p style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '8px' }}>
        Tick an item once it is in place; ticks are saved with this profile. <b style={{ color: 'var(--ink)' }}>{ticked} of {items.length} ticked.</b>
      </p>
      {error && <div className="form-err" role="alert">{error}</div>}

      {groups.map(([cat, label]) => {
        const inCat = items.filter(i => i.category === cat)
        if (!inCat.length) return null
        return (
          <div key={cat} style={{ marginTop: '26px' }}>
            <h3 className="sec-h" style={{ marginBottom: '12px' }}>{label}</h3>
            <div className="list-card">
              {inCat.map(ob => (
                <div key={ob.id} className="check-row">
                  <input type="checkbox" id={`ck-${ob.id}`} checked={isChecked(pv, ob)}
                    aria-describedby={isUnconfirmed(ob) ? `cku-${ob.id} ckd-${ob.id}` : `ckd-${ob.id}`}
                    onChange={e => update(prof => withChecked(prof, ob.id, e.target.checked, today))}
                    style={{ width: '20px', height: '20px', margin: '1px 0 0', flexShrink: 0, accentColor: 'var(--acc)', cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <label htmlFor={`ck-${ob.id}`} style={{ fontWeight: 600, fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', cursor: 'pointer' }}>
                      {ob.title}
                    </label>
                    {isUnconfirmed(ob) && <div style={{ marginTop: '5px' }}><ItemBadge item={ob} id={`cku-${ob.id}`} /></div>}
                    <div id={`ckd-${ob.id}`} style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '3px', lineHeight: 1.55 }}>{ob.desc}</div>
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
