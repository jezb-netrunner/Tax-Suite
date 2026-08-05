import React, { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { OBLIGATIONS, HOLIDAY_SET } from '../lib/deadlineData.js'
import { generateDeadlines } from '../engine/deadlines.js'
import { profileFlags } from '../engine/profile.js'
import { today, addDays, fmtDate, fmtMonthShort, lastDayOfMonth } from '../engine/dates.js'
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
          Answer a few questions about the taxpayer — employee, freelancer, sole prop, or corporation — and
          Present Value lays out every BIR, LGU, SSS, PhilHealth, and Pag-IBIG date that applies, with the
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

  const t = useMemo(() => today(), [])
  const deadlines = useMemo(() => {
    if (!p) return []
    return generateDeadlines(OBLIGATIONS, p, {
      from: t, to: addDays(t, 400), holidays: HOLIDAY_SET, refDate: t,
    })
  }, [p, t])

  if (!app.profilesReady) return null
  if (!p && app.loadError) {
    return (
      <div className="page wrap" style={{ paddingTop: '40px', paddingBottom: '64px', maxWidth: '620px' }}>
        <div className="card pad">
          <h1 className="pg-h1">Couldn’t load your profiles</h1>
          <p className="pg-sub">This is a connection problem, not lost data — your saved taxpayers are still there.</p>
          <button className="btn" style={{ marginTop: '16px' }} onClick={() => app.retryLoad()}>Try again</button>
        </div>
      </div>
    )
  }
  if (!p) return <NoProfile />

  const flags = profileFlags(p)
  const eom = lastDayOfMonth(t.getFullYear(), t.getMonth() + 1)

  // Hero: next filing-money deadline (income/business/withholding), else next of any kind.
  const heroPool = deadlines.filter(d => ['income', 'business', 'withholding'].includes(d.obligation.category))
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
          </div>
          <div className="seg" role="group" aria-label="View">
            {[['feed', 'Feed'], ['timeline', 'Timeline'], ['table', 'Table']].map(([k, l]) => (
              <button key={k} className={view === k ? 'active' : ''} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
        </div>

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
                      <div className="hero-days" style={hero.daysAway <= 7 ? { color: '#f3cf9a' } : undefined}>{hero.daysAway}</div>
                      <div style={{ fontSize: '12.5px', color: '#a9cde6', marginTop: '4px' }}>{hero.daysAway === 1 ? 'day left' : 'days left'}</div>
                      <div style={{ marginTop: '18px', fontSize: '14px', fontWeight: 600 }}>{fmtDate(hero.date)}</div>
                      {hero.shifted && (
                        <div style={{ fontSize: '12px', color: '#9bbdd6', marginTop: '3px' }}>
                          moved from {fmtDate(hero.rawDate)} ({hero.shiftReason})
                        </div>
                      )}
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
                        ? 'Your employer withholds tax from every payslip and files on your behalf. Watch for your BIR Form 2316 by January 31 — it\'s your proof of tax paid for the year.'
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
                      <span style={{ fontSize: '13px', color: 'var(--mut)' }}>next due date per obligation — recurring ones repeat</span>
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
                <div style={{ position: 'absolute', left: '14px', top: '8px', bottom: '8px', width: '2px', background: 'var(--line)' }}></div>
                {deadlines.slice(0, 40).map(d => {
                  const st = d.daysAway <= 30 ? { s: 'Due soon', c: 'var(--warn)', soft: 'var(--warnSoft)' } : { s: 'Upcoming', c: 'var(--accInk)', soft: 'var(--accSoft)' }
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
                      </div>
                    </div>
                  )
                })}
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
                        <td style={{ fontWeight: 600 }}>{d.obligation.title}</td>
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
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em' }}>{t.getFullYear()} income-tax filings</div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--line)', margin: '14px 0 16px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round(fullYear.filter(d => d.date < t).length / fullYear.length * 100)}%`, height: '100%', background: 'var(--acc)', borderRadius: '3px' }}></div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
                  {fullYear.map(d => {
                    const done = d.date < t
                    return (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={done
                          ? { width: 18, height: 18, borderRadius: '50%', background: 'var(--acc)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }
                          : { width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--line)', flexShrink: 0 }}>{done ? '✓' : ''}</span>
                        <span style={{ fontSize: '13px', color: done ? 'var(--mut)' : 'var(--ink)', fontWeight: done ? 400 : 600 }}>
                          {d.obligation.form} {d.label || ''} · {done ? 'passed' : 'due'} {fmtDate(d.date)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--dim)', lineHeight: 1.5 }}>
                  “Passed” means the due date has gone by — confirm the filing was actually made.
                </div>
              </div>
            )}

            {!isEmployee && (
              <div className="card tight" style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em' }}>How much to set aside?</div>
                <div style={{ fontSize: '12.5px', color: 'var(--mut)', marginTop: '8px', lineHeight: 1.55 }}>
                  Run your numbers through the estimator — it compares every regime open to this profile with the full math and legal basis.
                </div>
                <button className="btn sm" style={{ marginTop: '12px' }} onClick={() => nav('/estimator')}>Open the estimator</button>
              </div>
            )}

            {flags.has('substituted-filing') && (
              <div style={{ border: '1px solid var(--line)', borderRadius: '13px', background: 'var(--accSoft)', padding: '18px', marginTop: isEmployee ? 0 : '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-.01em', color: 'var(--accInk)' }}>You're covered</div>
                <div style={{ fontSize: '13px', color: 'var(--accInk)', marginTop: '7px', lineHeight: 1.55, opacity: .85 }}>
                  Your employer handles monthly withholding and your annual return through substituted filing. Keep your signed 2316 each year — it is your proof of filing.
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
                staggered (later) dates for monthly remittances. This is a reminder tool, not tax advice — verify
                against BIR issuances before filing. Legal basis for every date is on the <Link to="/references" style={{ color: 'var(--accInk)', fontWeight: 600 }}>References</Link> page.
              </div>
            </div>
          </div>
        </div>
      </div>
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
        <div style={{ fontWeight: 600, fontSize: '14.5px' }}>{d.obligation.title}{d.label ? ` — ${d.label}` : ''}</div>
        <div style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '2px' }}>
          {d.obligation.desc}
          {d.shifted && <span style={{ color: 'var(--dim)' }}> · moved from {fmtDate(d.rawDate)}</span>}
        </div>
      </div>
      {showFreq && FREQ_LABEL[d.obligation.schedule.kind] && <span className="tag">{FREQ_LABEL[d.obligation.schedule.kind]}</span>}
      <AgencyTag agency={d.obligation.agency} />
      {d.obligation.form && d.obligation.form !== '—' && <span className="boxcode">{d.obligation.form}</span>}
    </div>
  )
}
