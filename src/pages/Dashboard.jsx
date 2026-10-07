import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { OBLIGATIONS, HOLIDAY_SET } from '../lib/deadlineData.js'
import {
  generateDeadlines, unproclaimedYears, holidayGapNote, overdueDeadlines, OVERDUE_DAYS,
  filedKey, filedStatus, withFiled, withFiledMany, railStatus, groupByMonth,
} from '../engine/deadlines.js'
import { profileFlags } from '../engine/profile.js'
import { addDays, fmtDate, fmtMonthShort, lastDayOfMonth, daysLeftLabel } from '../engine/dates.js'
import { useManilaToday } from '../lib/useManilaToday.js'
import { useProfileMarks } from '../lib/useProfileMarks.js'
import { AgencyTag } from '../components/ui.jsx'
import { PROFILE_TYPES } from '../engine/profile.js'

const CATLABEL = { income: 'Income tax', business: 'Business tax', withholding: 'Withholding', payroll: 'Payroll & contributions', admin: 'Admin', registration: 'Registration' }

function NoProfile() {
  const nav = useNavigate()
  return (
    <div className="page wrap" style={{ paddingTop: '48px', paddingBottom: '64px', maxWidth: '640px' }}>
      <div className="hero" style={{ display: 'block' }}>
        <div className="eyebrow">Welcome</div>
        <h2 style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '11px', lineHeight: 1.2 }}>
          Let's build your compliance calendar.
        </h2>
        <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#cdddea', marginTop: '11px', maxWidth: '480px' }}>
          Answer a few questions about the taxpayer (employee, freelancer, sole prop, or corporation) and
          JEZ Tax Suite lays out every BIR, LGU, SSS, PhilHealth, and Pag-IBIG date that applies, with the
          math and the legal basis behind each one.
        </p>
        <button className="btn-light" onClick={() => nav('/profiles/new')}>Set up your first profile →</button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const app = useApp()
  const nav = useNavigate()
  const [view, setView] = useState('feed')
  const p = app.active

  // Today in Manila; refreshes at Manila midnight and when the tab comes back.
  const t = useManilaToday()
  const windowEnd = addDays(t, 400)
  const deadlines = useMemo(() => {
    if (!p) return []
    return generateDeadlines(OBLIGATIONS, p, {
      from: t, to: addDays(t, 400), holidays: HOLIDAY_SET, refDate: t,
    })
  }, [p, t])
  // Years in the window whose holidays are not yet proclaimed (M07).
  const gapYears = unproclaimedYears(HOLIDAY_SET, t, windowEnd)
  const gapNote = holidayGapNote(gapYears)

  // Filed marks (M09): `pv` is the profile with any not-yet-saved marks.
  const { profile: pv, update: updateMarks, error: markError } = useProfileMarks(app)
  const [lastMark, setLastMark] = useState(null) // { d, on, status } for the status line + Undo
  const undoRef = useRef(null)
  const overdue = useMemo(
    () => (pv ? overdueDeadlines(OBLIGATIONS, pv, { today: t, holidays: HOLIDAY_SET }) : []),
    [pv, t]
  )
  const recentlyMarked = useMemo(() => {
    if (!pv) return []
    return generateDeadlines(OBLIGATIONS, pv, {
      from: addDays(t, -OVERDUE_DAYS), to: addDays(t, -1), holidays: HOLIDAY_SET, refDate: t,
    }).filter(d => filedStatus(pv, d))
  }, [pv, t])
  function mark(d, on, status = 'filed') {
    updateMarks(prof => withFiled(prof, filedKey(d), on, t, status))
    setLastMark({ d, on, status })
  }
  function markMany(list, on) {
    updateMarks(prof => withFiledMany(prof, list.map(filedKey), on, t))
    setLastMark({ many: list, on })
  }

  if (!app.profilesReady) return null
  if (!p && app.loadError) {
    return (
      <div className="page wrap" style={{ paddingTop: '40px', paddingBottom: '64px', maxWidth: '620px' }}>
        <div className="card pad">
          <h1 className="pg-h1">Couldn’t load your profiles</h1>
          <p className="pg-sub">This is a connection problem, not lost data. Your saved taxpayers are still there.</p>
          <button className="btn" style={{ marginTop: '16px' }} onClick={() => app.retryLoad()}>Try again</button>
        </div>
      </div>
    )
  }
  if (!p) return <NoProfile />

  const flags = profileFlags(p)
  const eom = lastDayOfMonth(t.getFullYear(), t.getMonth() + 1)

  // Hero: next filing-money deadline (income/business/withholding), else next of any kind.
  // Items that apply only by the taxpayer's own choice (the Oct 15 second
  // installment) stay in the lists but never take the hero spot.
  const heroPool = deadlines.filter(d => ['income', 'business', 'withholding'].includes(d.obligation.category) && !d.obligation.conditional)
  const hero = heroPool[0] || deadlines[0] || null
  const rest = deadlines.filter(d => d !== hero)
  const monthItems = rest.filter(d => d.date <= eom)
  // Beyond this month, show each obligation once — its NEXT occurrence — so
  // monthly remittances don't flood the feed. Full expansion lives in the
  // timeline and table views.
  const seen = new Set(monthItems.map(d => d.obligation.id).concat(hero ? [hero.obligation.id] : []))
  const laterItems = []
  for (const d of rest) {
    if (d.date <= eom) continue
    if (seen.has(d.obligation.id)) continue
    seen.add(d.obligation.id)
    laterItems.push(d)
  }

  const isEmployee = p.type === 'employee'
  const summary = isEmployee
    ? `Showing what applies to ${p.name} as an employee on compensation income.`
    : `Showing ${deadlines.length} dated obligations over the next 13 months for ${p.name}.`

  // Filing progress rail: this year's already-generated income tax filings.
  const yearStart = new Date(t.getFullYear(), 0, 1)
  const fullYear = generateDeadlines(OBLIGATIONS, p, {
    from: yearStart, to: new Date(t.getFullYear(), 11, 31), holidays: HOLIDAY_SET, refDate: t,
  }).filter(d => d.obligation.category === 'income')

  return (
    <div className="page">
      <div style={{ background: 'var(--sf)', borderBottom: '1px solid var(--line)' }}>
        <div className="wrap" style={{ padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{p.name}</span>
            <span className="tag">{PROFILE_TYPES[p.type].name}</span>
            {p.type !== 'employee' && <span className="tag">{p.vatRegistered ? 'VAT' : 'Non-VAT'}</span>}
            {(p.type === 'individual' || p.type === 'mixed') && !p.vatRegistered && (
              <span className="tag">{p.regime === '8pct' ? '8% flat tax' : p.regime === 'graduated_osd' ? 'Graduated + OSD' : 'Graduated + itemized'}</span>
            )}
            {p.hasEmployees && <span className="tag">Employer</span>}
            {p.type === 'corporation' && p.fiscalYearEndMonth !== 12 && (
              <span className="tag">FY ends {new Date(2000, p.fiscalYearEndMonth - 1, 1).toLocaleDateString('en-US', { month: 'long' })}</span>
            )}
            <button className="linkbtn" onClick={() => nav(`/profiles/${p.id}/edit`)}>Edit</button>
          </div>
          <span className="mono" style={{ fontSize: '12.5px', color: 'var(--mut)' }}>{fmtDate(t)}</span>
        </div>
      </div>

      <div className="wrap" style={{ paddingTop: '26px', paddingBottom: '56px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div>
            <h1 className="pg-h1">Your compliance calendar</h1>
            <p className="pg-sub">{summary}</p>
            {gapNote && (
              <p className="mini-warn" role="note" style={{ maxWidth: '640px' }}>
                <b>{gapNote}</b> Dates in {gapYears.join(' and ')} skip weekends and the holidays fixed by law
                (such as May 1 and June 12) only; check the official list once it is out.
              </p>
            )}
          </div>
          <div className="seg" role="group" aria-label="View">
            {[['feed', 'Feed'], ['timeline', 'Timeline'], ['table', 'Table']].map(([k, l]) => (
              <button key={k} className={view === k ? 'active' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
        </div>

        {markError && <div className="form-err" role="alert" style={{ marginBottom: '16px' }}>{markError}</div>}
        <MarkStatus lastMark={lastMark} onMark={mark} onMarkMany={markMany} undoRef={undoRef} />
        <OverdueSection items={overdue} recent={recentlyMarked} profile={pv} onMark={mark} onMarkMany={markMany} undoRef={undoRef} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 440px', minWidth: 0 }}>
            {view === 'feed' && (
              <div>
                {hero ? (
                  <div className="hero">
                    <div style={{ flex: '1 1 260px', minWidth: 0, maxWidth: '440px' }}>
                      <div className="eyebrow">Next deadline</div>
                      <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '11px', lineHeight: 1.15 }}>{hero.obligation.title}</h2>
                      <p style={{ fontSize: '14px', lineHeight: 1.55, color: '#cdddea', marginTop: '10px' }}>{hero.obligation.desc}</p>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                        {hero.obligation.form && hero.obligation.form !== '—' && (
                          <span style={{ padding: '5px 10px', borderRadius: '7px', background: 'rgba(255,255,255,.12)', fontSize: '12px', fontWeight: 600, color: '#e4eef6' }}>{hero.obligation.form}</span>
                        )}
                        <span style={{ padding: '5px 10px', borderRadius: '7px', background: 'rgba(255,255,255,.12)', fontSize: '12px', fontWeight: 600, color: '#e4eef6' }}>{hero.obligation.agency}</span>
                        {hero.label && <span style={{ padding: '5px 10px', borderRadius: '7px', background: 'rgba(255,255,255,.12)', fontSize: '12px', fontWeight: 600, color: '#e4eef6' }}>{hero.label}</span>}
                      </div>
                      <button className="btn-light" onClick={() => nav('/forms')}>Read the form guide →</button>
                    </div>
                    <div className="hero-side">
                      {hero.daysAway === 0 ? (
                        <div className="hero-days" style={{ color: '#f3cf9a', fontSize: '32px' }}>{daysLeftLabel(0)}</div>
                      ) : (
                        <>
                          <div className="hero-days" style={hero.daysAway <= 7 ? { color: '#f3cf9a' } : undefined}>{hero.daysAway}</div>
                          <div style={{ fontSize: '12.5px', color: '#a9cde6', marginTop: '4px' }}>{hero.daysAway === 1 ? 'day left' : 'days left'}</div>
                        </>
                      )}
                      <div style={{ marginTop: '18px', fontSize: '14px', fontWeight: 600 }}>{fmtDate(hero.date)}</div>
                      {hero.shifted && (
                        <div style={{ fontSize: '12px', color: '#9bbdd6', marginTop: '3px' }}>
                          moved from {fmtDate(hero.rawDate)} ({hero.shiftReason})
                        </div>
                      )}
                      <ExtendedNote d={hero} onDark />
                      <RollNote d={hero} onDark />
                    </div>
                  </div>
                ) : (
                  <div className="hero" style={{ display: 'block' }}>
                    <div className="eyebrow">All clear</div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-.02em', marginTop: '11px', lineHeight: 1.2, maxWidth: '480px' }}>
                      {isEmployee ? 'Nothing for you to file right now.' : 'No dated deadlines coming up.'}
                    </h2>
                    <p style={{ fontSize: '14.5px', lineHeight: 1.6, color: '#cdddea', marginTop: '11px', maxWidth: '520px' }}>
                      {isEmployee
                        ? 'Your employer withholds tax from every payslip and files on your behalf. Watch for your BIR Form 2316 by January 31; it\'s your proof of tax paid for the year.'
                        : 'Everything on your calendar is either done or ongoing. Check the Checklist tab for the recurring obligations that keep you compliant.'}
                    </p>
                  </div>
                )}

                {monthItems.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '28px 0 12px' }}>
                      <h3 className="sec-h">Also due this month</h3>
                      <span style={{ fontSize: '13px', color: 'var(--mut)' }}>{t.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="list-card">
                      {monthItems.map(d => <DeadlineRow key={d.id} d={d} />)}
                    </div>
                  </div>
                )}

                {laterItems.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '28px 0 12px' }}>
                      <h3 className="sec-h">Coming up</h3>
                      <span style={{ fontSize: '13px', color: 'var(--mut)' }}>next due date per obligation; recurring ones repeat</span>
                    </div>
                    <div className="list-card">
                      {laterItems.map(d => <DeadlineRow key={d.id} d={d} showFreq />)}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '24px' }}>
                  <Link to="/checklist" className="linkbtn" style={{ fontSize: '13.5px' }}>
                    See the recurring, no-fixed-date obligations on your checklist →
                  </Link>
                </div>
              </div>
            )}

            {view === 'timeline' && (
              <div style={{ position: 'relative', paddingLeft: '8px' }}>
                <p style={{ fontSize: '13px', color: 'var(--mut)', margin: '0 0 6px' }}>
                  All {deadlines.length} deadlines in the next 13 months, by month.
                </p>
                <div style={{ position: 'absolute', left: '14px', top: '34px', bottom: '8px', width: '2px', background: 'var(--line)' }}></div>
                {groupByMonth(deadlines).map(g => (
                  <section key={g.key} aria-labelledby={`tl-${g.key}`}>
                    <h2 id={`tl-${g.key}`} style={{ fontSize: '14.5px', fontWeight: 700, margin: '16px 0 10px 30px', position: 'relative' }}>
                      {g.label} <span style={{ fontWeight: 500, color: 'var(--mut)', fontSize: '13px' }}>({g.items.length})</span>
                    </h2>
                    {g.items.map(d => {
                      const st = d.daysAway === 0 ? { s: 'Due today', c: 'var(--warn)', soft: 'var(--warnSoft)' }
                        : d.daysAway <= 30 ? { s: 'Due soon', c: 'var(--warn)', soft: 'var(--warnSoft)' } : { s: 'Upcoming', c: 'var(--accInk)', soft: 'var(--accSoft)' }
                      return (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '14px', position: 'relative' }}>
                          <span style={{ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, marginTop: '14px', background: st.c, boxShadow: `0 0 0 3px var(--bg),0 0 0 4px ${st.c}`, position: 'relative', zIndex: 1, display: 'block' }}></span>
                          <div className="card" style={{ flex: 1, minWidth: 0, borderRadius: '12px', padding: '14px 17px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '100px', color: st.c, background: st.soft }}>{st.s}</span>
                              <span className="mono" style={{ fontSize: '12.5px', color: 'var(--mut)' }}>{fmtDate(d.date)}{d.label ? ` · ${d.label}` : ''}</span>
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '14.5px', marginTop: '7px' }}>{d.obligation.title}</div>
                            <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '2px' }}>{d.obligation.desc}</div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '9px', alignItems: 'center' }}>
                              {d.obligation.form && d.obligation.form !== '—' && <span className="boxcode">{d.obligation.form}</span>}
                              <AgencyTag agency={d.obligation.agency} />
                              {d.shifted && <span style={{ fontSize: '11.5px', color: 'var(--dim)' }}>moved from {fmtDate(d.rawDate)}</span>}
                            </div>
                            <ExtendedNote d={d} />
                            <RollNote d={d} />
                          </div>
                        </div>
                      )
                    })}
                  </section>
                ))}
              </div>
            )}

            {view === 'table' && (
              <div className="list-card" style={{ overflowX: 'auto' }}>
                <table className="tbl">
                  <thead>
                    <tr><th>Date</th><th>Obligation</th><th>Form</th><th>Agency</th><th>Type</th><th>Period</th></tr>
                  </thead>
                  <tbody>
                    {deadlines.map(d => (
                      <tr key={d.id}>
                        <td className="mono" style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                        <td style={{ fontWeight: 600 }}>
                          {d.obligation.title}
                          {d.extended && <div style={{ fontSize: '12px', fontWeight: 400, color: 'var(--mut)' }}>Extended by {d.extended.basis}</div>}
                        </td>
                        <td className="mono" style={{ fontSize: '12.5px', color: 'var(--mut)' }}>{d.obligation.form || '—'}</td>
                        <td><AgencyTag agency={d.obligation.agency} /></td>
                        <td style={{ color: 'var(--mut)' }}>{CATLABEL[d.obligation.category] || ''}</td>
                        <td className="mono" style={{ fontSize: '12px', color: 'var(--dim)', whiteSpace: 'nowrap' }}>{d.label || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* right rail */}
          <div style={{ flex: '1 1 300px', maxWidth: '340px' }}>
            {!isEmployee && fullYear.length > 0 && (
              <div className="card tight">
                <h2 id="rail-h" style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em' }}>{t.getFullYear()} income-tax filings</h2>
                <FilingRail items={fullYear} profile={pv} today={t} onMark={mark} />
              </div>
            )}

            {!isEmployee && (
              <div className="card tight" style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em' }}>How much to set aside?</div>
                <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '8px', lineHeight: 1.55 }}>
                  Run your numbers through the estimator. It compares every regime open to this profile with the full math and legal basis.
                </div>
                <button className="btn sm" style={{ marginTop: '12px' }} onClick={() => nav('/estimator')}>Open the estimator</button>
              </div>
            )}

            {flags.has('substituted-filing') && (
              <div style={{ border: '1px solid var(--line)', borderRadius: '13px', background: 'var(--accSoft)', padding: '18px', marginTop: isEmployee ? 0 : '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--accInk)' }}>You're covered</div>
                <div style={{ fontSize: '13px', color: 'var(--accInk)', marginTop: '7px', lineHeight: 1.55, opacity: .85 }}>
                  Your employer handles monthly withholding and your annual return through substituted filing. Keep your signed 2316 each year; it is your proof of filing.
                </div>
              </div>
            )}

            <div className="card" style={{ padding: '16px 18px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--warn)', display: 'block' }}></span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--mut)' }}>Heads up</span>
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '8px', lineHeight: 1.55 }}>
                Dates are computed from statutory rules with weekend and holiday shifts, and eFPS filers may have
                staggered (later) dates for monthly remittances. This is a reminder tool, not tax advice. Verify
                against BIR issuances before filing. Legal basis for every date is on the <Link to="/references" style={{ color: 'var(--accInk)', fontWeight: 600 }}>References</Link> page.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const fmtDay = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
const itemName = d => `${d.obligation.title}${d.label ? ` · ${d.label}` : ''}`
const daysOverdueLabel = n => (n === 1 ? '1 day overdue' : `${n} days overdue`)

// Status line after marking or unmarking, with Undo. Always rendered (empty
// until the first mark) so screen readers announce each change.
function MarkStatus({ lastMark, onMark, onMarkMany, undoRef }) {
  const many = lastMark && lastMark.many
  return (
    <div aria-live="polite" style={lastMark ? { fontSize: '13px', marginBottom: '12px', padding: '9px 13px', borderRadius: '9px', background: 'var(--accSoft)', color: 'var(--accInk)' } : undefined}>
      {lastMark && (
        <>
          {many
            ? (lastMark.on ? <>Marked {many.length} items as filed. </> : <>{many.length} items are no longer marked. </>)
            : lastMark.on
              ? <>Marked “{itemName(lastMark.d)}” as {lastMark.status === 'n/a' ? 'not applicable' : 'filed'}. </>
              : <>“{itemName(lastMark.d)}” is no longer marked. </>}
          <button ref={undoRef} className="linkbtn" style={{ fontSize: '13px', minHeight: '24px' }}
            onClick={() => (many ? onMarkMany(many, !lastMark.on) : onMark(lastMark.d, !lastMark.on, lastMark.status))}>
            Undo
          </button>
        </>
      )}
    </div>
  )
}

// Overdue (M09): passed due dates of the last 60 days that are not marked
// filed. Each can be marked filed (an optional item can be marked "doesn't
// apply"); recently marked items can be unmarked. After a click, focus moves
// to the next item (or to Undo) so keyboard users keep their place.
const OVERDUE_SHOWN = 5

function OverdueSection({ items, recent, profile, onMark, onMarkMany, undoRef }) {
  const btnRefs = useRef({})
  const [focusTo, setFocusTo] = useState(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (!focusTo) return
    const el = focusTo === 'undo' ? undoRef.current : btnRefs.current[focusTo]
    if (el) el.focus()
    setFocusTo(null)
  }, [focusTo, items, undoRef])

  if (!items.length && !recent.length) return null

  const shown = showAll ? items : items.slice(0, OVERDUE_SHOWN)

  function markAll() {
    onMarkMany(items, true)
    setFocusTo('undo')
  }

  function markItem(d, status) {
    const i = items.findIndex(x => x.id === d.id)
    const next = items[i + 1] || items[i - 1]
    onMark(d, true, status)
    setFocusTo(next ? next.id : 'undo')
  }

  return (
    <section aria-labelledby="overdue-h" className="card" style={{ marginBottom: '22px', padding: '16px 18px', borderLeft: items.length ? '3px solid var(--bad)' : undefined }}>
      <h2 id="overdue-h" style={{ fontSize: '15px', fontWeight: 700, color: items.length ? 'var(--bad)' : 'var(--ink)' }}>
        {items.length ? `Overdue (${items.length})` : 'Nothing overdue'}
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '4px', lineHeight: 1.55 }}>
        {items.length
          ? <>Due dates from the last {OVERDUE_DAYS} days that are not marked as filed. Already filed? Mark it as filed. If not, file and pay as soon as you can: the surcharge and interest grow every day. <Link to="/tools" style={{ color: 'var(--accInk)', fontWeight: 600 }}>Estimate the penalty</Link></>
          : <>Every due date of the last {OVERDUE_DAYS} days is marked as filed.</>}
      </p>
      {items.length > 0 && (
        <ul id="overdue-list" className="list-card" style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
          {shown.map(d => (
            <li key={d.id} className="frow" style={{ flexWrap: 'wrap', rowGap: '10px' }}>
              <div style={{ textAlign: 'center', flexShrink: 0, width: '44px' }}>
                <div className="mono" style={{ fontSize: '17px', fontWeight: 600 }}>{d.date.getDate()}</div>
                <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--mut)' }}>{fmtMonthShort(d.date)}</div>
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{itemName(d)}</div>
                <div style={{ fontSize: '13px', color: 'var(--bad)', marginTop: '2px', fontWeight: 600 }}>
                  {daysOverdueLabel(d.daysOverdue)} <span style={{ color: 'var(--mut)', fontWeight: 400 }}>· was due {fmtDay(d.date)}{d.extended ? ` (extended by ${d.extended.basis})` : ''}{d.obligation.form && d.obligation.form !== '—' ? ` · ${d.obligation.form}` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button ref={el => { btnRefs.current[d.id] = el }} className="btn sm"
                  aria-label={`Mark as filed: ${itemName(d)}`} onClick={() => markItem(d, 'filed')}>
                  Mark as filed
                </button>
                {d.obligation.conditional && (
                  <button className="btn sm ghost" aria-label={`Does not apply to me: ${itemName(d)}`} onClick={() => markItem(d, 'n/a')}>
                    Doesn’t apply to me
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {items.length > 1 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
          {items.length > OVERDUE_SHOWN && (
            <button className="btn sm ghost" aria-expanded={showAll} aria-controls="overdue-list" onClick={() => setShowAll(v => !v)}>
              {showAll ? `Show the first ${OVERDUE_SHOWN} only` : `Show all ${items.length} overdue`}
            </button>
          )}
          <button className="btn sm ghost" onClick={markAll}>Mark all {items.length} as filed</button>
        </div>
      )}
      {recent.length > 0 && (
        <details style={{ marginTop: '12px' }}>
          <summary style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accInk)', cursor: 'pointer', minHeight: '24px' }}>
            Marked in the last {OVERDUE_DAYS} days ({recent.length})
          </summary>
          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {recent.map(d => (
              <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px' }}>
                <span style={{ flex: '1 1 200px', minWidth: 0 }}>
                  {itemName(d)} · due {fmtDate(d.date)} · <b>{filedStatus(profile, d) === 'n/a' ? 'doesn’t apply' : 'filed'}</b>
                </span>
                <button className="linkbtn" style={{ fontSize: '13px', minHeight: '24px' }}
                  aria-label={`Unmark: ${itemName(d)}`} onClick={() => onMark(d, false)}>
                  Unmark
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

// Income-tax rail (M09): a tick only for items marked filed; a neutral clock
// for dates that passed without a mark; an empty ring for dates to come.
function RailIcon({ status }) {
  const base = { width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }
  if (status === 'filed') return <span aria-hidden="true" style={{ ...base, background: 'var(--acc)', color: '#fff' }}>✓</span>
  if (status === 'n/a') return <span aria-hidden="true" style={{ ...base, background: 'var(--line)', color: 'var(--ink)' }}>–</span>
  if (status === 'passed') {
    return (
      <span aria-hidden="true" style={{ ...base, background: 'var(--line)' }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#4a5a6a" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="6" cy="6" r="4.8" /><path d="M6 3.4V6l1.8 1.2" />
        </svg>
      </span>
    )
  }
  return <span aria-hidden="true" style={{ ...base, border: '2px solid var(--line)' }} />
}

const RAIL_TEXT = { filed: 'filed · due', 'n/a': 'doesn’t apply · due', passed: 'date passed', due: 'due' }

function FilingRail({ items, profile, today, onMark }) {
  const statuses = items.map(d => railStatus(profile, d, today))
  const done = statuses.filter(st => st === 'filed' || st === 'n/a').length
  return (
    <>
      <div aria-hidden="true" style={{ height: '6px', borderRadius: '3px', background: 'var(--line)', margin: '14px 0 6px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(done / items.length * 100)}%`, height: '100%', background: 'var(--acc)', borderRadius: '3px' }}></div>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--mut)', marginBottom: '12px' }}>{done} of {items.length} marked filed</div>
      <ul aria-labelledby="rail-h" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((d, i) => {
          const st = statuses[i]
          const textId = `rail-${d.id}`
          return (
            <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RailIcon status={st} />
              <span id={textId} style={{ flex: 1, minWidth: 0, fontSize: '13px', color: st === 'due' ? 'var(--ink)' : 'var(--mut)', fontWeight: st === 'due' ? 600 : 400 }}>
                {d.obligation.form} {d.label || ''} · {RAIL_TEXT[st]} {fmtDate(d.date)}{d.extended ? ` (extended by ${d.extended.basis})` : ''}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--mut)', cursor: 'pointer', minHeight: '24px', flexShrink: 0 }}>
                <input type="checkbox" checked={st === 'filed'} aria-describedby={textId}
                  onChange={e => onMark(d, e.target.checked)}
                  style={{ width: '16px', height: '16px', margin: 0, accentColor: 'var(--acc)' }} />
                Filed
              </label>
            </li>
          )
        })}
      </ul>
      <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--mut)', lineHeight: 1.5 }}>
        Tick “Filed” once a return is filed. A grey clock means the date has passed and the return is not marked as filed.
      </div>
    </>
  )
}

// A deadline moved by a later issuance (L07, rulebook "overrides").
function ExtendedNote({ d, onDark }) {
  if (!d.extended) return null
  return (
    <div style={{ fontSize: '12px', lineHeight: 1.5, marginTop: '5px', color: onDark ? '#cdddea' : 'var(--accInk)' }}>
      <b>Extended to {fmtDate(d.date)} by {d.extended.basis}</b> (was {fmtDate(d.extended.from)}).
    </div>
  )
}

// LGU, SEC and DOLE dates (and 13th-month pay) are not moved to the next
// working day (M08). Their note is always shown; when the date itself is a
// weekend or holiday, say so and name the last working day before it.
function RollNote({ d, onDark }) {
  if (!d.rollNote) return null
  const style = { fontSize: '12px', lineHeight: 1.5, marginTop: '5px', color: onDark ? '#cdddea' : 'var(--mut)' }
  if (!d.nonWorkingDay) return <div style={style}>{d.rollNote}</div>
  const holiday = d.nonWorkingDay === 'holiday' ? HOLIDAY_SET.get(d.date) : null
  const why = d.nonWorkingDay === 'weekend'
    ? `${fmtDay(d.date)} falls on a ${d.date.toLocaleDateString('en-US', { weekday: 'long' })}.`
    : `${fmtDay(d.date)} is a holiday${holiday ? ` (${holiday.name})` : ''}.`
  return (
    <div style={{ ...style, color: onDark ? '#f3cf9a' : '#7a5a1f' }}>
      <b>{why}</b> {d.rollNote} Last working day before: <b>{fmtDay(d.lastWorkingDayBefore)}</b>.
    </div>
  )
}

const FREQ_LABEL = {
  monthly: 'Monthly', quarterly_fixed: 'Quarterly', quarterly_offset: 'Quarterly',
  annual_fixed: 'Annual', annual_fy: 'Annual', once: 'One-time',
}

function DeadlineRow({ d, showFreq }) {
  return (
    <div className="frow">
      <div style={{ textAlign: 'center', flexShrink: 0, width: '44px' }}>
        <div className="mono" style={{ fontSize: '17px', fontWeight: 600 }}>{d.date.getDate()}</div>
        <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--dim)' }}>{fmtMonthShort(d.date)}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{d.obligation.title}{d.label ? ` · ${d.label}` : ''}</div>
        <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '2px' }}>
          {d.obligation.desc}
          {d.shifted && <span style={{ color: 'var(--dim)' }}> · moved from {fmtDate(d.rawDate)}</span>}
        </div>
        <ExtendedNote d={d} />
        <RollNote d={d} />
      </div>
      {showFreq && FREQ_LABEL[d.obligation.schedule.kind] && <span className="tag">{FREQ_LABEL[d.obligation.schedule.kind]}</span>}
      <AgencyTag agency={d.obligation.agency} />
      {d.obligation.form && d.obligation.form !== '—' && <span className="boxcode">{d.obligation.form}</span>}
    </div>
  )
}
