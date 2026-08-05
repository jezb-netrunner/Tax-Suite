import React, { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { PROFILE_TYPES, defaultProfile } from '../engine/profile.js'
import { Switch, SelectField } from '../components/ui.jsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function ProfileWizard() {
  const app = useApp()
  const { profileId } = useParams()
  const editing = useMemo(
    () => (profileId ? app.profiles.find(p => p.id === profileId) : null),
    [profileId, app.profiles]
  )

  // Profiles load asynchronously. Mounting the editor before they arrive seeded
  // a blank form and saved it as a NEW profile instead of editing the intended
  // one, so wait, then remount cleanly against the resolved profile.
  if (profileId && !app.profilesReady) return null
  return <WizardForm key={profileId || 'new'} app={app} editing={editing} />
}

function WizardForm({ app, editing }) {
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [p, setP] = useState(() => (editing ? { ...editing } : defaultProfile()))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  function set(k, v) { setP(prev => ({ ...prev, [k]: v })) }

  // The 8% option is unavailable to VAT-registered taxpayers, so turning VAT on
  // must move the stored regime too — otherwise the profile keeps regime:'8pct'
  // while the UI shows (and the engine applies) graduated rates.
  function setVatRegistered(v) {
    setP(prev => ({
      ...prev,
      vatRegistered: v,
      regime: v && prev.regime === '8pct' ? 'graduated_osd' : prev.regime,
    }))
  }

  // Switching type resets the type-specific facets (an employee has no VAT
  // registration), but must carry the identity across — dropping the id would
  // save a duplicate instead of updating the profile being edited.
  function pickType(type) {
    const fresh = defaultProfile(type)
    fresh.id = p.id
    fresh.name = p.name
    fresh.inputs = p.inputs || {}
    setP(fresh)
  }

  const isBiz = p.type === 'individual' || p.type === 'mixed'
  const isCorp = p.type === 'corporation'
  const steps = p.type === 'employee' ? 3 : 4

  async function finish() {
    setBusy(true); setErr(null)
    try {
      await app.save(p)
      nav('/')
    } catch (ex) {
      setErr(ex.message || 'Could not save the profile.')
      setBusy(false)
    }
  }

  return (
    <div className="page wrap" style={{ paddingTop: '30px', paddingBottom: '64px', maxWidth: '760px' }}>
      <h1 className="pg-h1">{editing ? 'Edit profile' : 'Set up a taxpayer profile'}</h1>
      <p className="pg-sub">A few questions shape the calendar, estimates, and checklist to this taxpayer. You can change any of this later.</p>

      <div className="wiz-steps" style={{ marginTop: '22px' }} aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => <div key={i} className={'wiz-step' + (i <= step ? ' on' : '')} />)}
      </div>

      <div className="card pad">
        {step === 0 && (
          <div>
            <h2 className="sec-h">Who is this profile for?</h2>
            <div className="field" style={{ marginTop: '14px' }}>
              <label className="lbl" htmlFor="pf-name">Profile name</label>
              <input id="pf-name" type="text" placeholder="e.g. Maria Santos, or Santos Design Studio" value={p.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="opt-grid">
              {Object.entries(PROFILE_TYPES).map(([k, t]) => (
                <button key={k} type="button" className={'opt-card' + (p.type === k ? ' on' : '')} aria-pressed={p.type === k} onClick={() => pickType(k)}>
                  <div className="t">{t.name}</div>
                  <div className="d">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && p.type === 'employee' && (
          <div>
            <h2 className="sec-h">Employment situation</h2>
            <div style={{ marginTop: '10px' }}>
              <Switch on={p.multipleEmployers} onChange={v => set('multipleEmployers', v)}
                title="More than one employer this year (or switched jobs mid-year)"
                desc="Two or more employers usually means substituted filing no longer applies — you file BIR Form 1700 yourself by April 15." />
              <Switch on={p.licensedProfessional} onChange={v => set('licensedProfessional', v)}
                title="PRC-licensed professional"
                desc="Licensed professionals renew a Professional Tax Receipt (PTR) with the LGU every January, even when purely employed." />
            </div>
          </div>
        )}

        {step === 1 && (isBiz || isCorp) && (
          <div>
            <h2 className="sec-h">Tax registration</h2>
            {isBiz && (
              <>
                <div style={{ marginTop: '14px' }}>
                  <Switch on={p.vatRegistered} onChange={v => setVatRegistered(v)}
                    title="VAT-registered"
                    desc="Required once gross sales pass the ₱3,000,000 threshold; optional below it. VAT registration removes the 8% option and the percentage tax." />
                </div>
                {!p.vatRegistered && (
                  <div style={{ marginTop: '16px' }}>
                    <label className="lbl">Income tax regime</label>
                    <div className="opt-grid" style={{ marginTop: '10px' }}>
                      <button type="button" className={'opt-card' + (p.regime === '8pct' ? ' on' : '')} aria-pressed={p.regime === '8pct'} onClick={() => set('regime', '8pct')}>
                        <div className="t">8% flat tax</div>
                        <div className="d">8% on gross{p.type === 'individual' ? ' above ₱250,000' : ''}, in lieu of graduated rates and percentage tax. Elected each year on the Q1 return.</div>
                      </button>
                      <button type="button" className={'opt-card' + (p.regime === 'graduated_osd' ? ' on' : '')} aria-pressed={p.regime === 'graduated_osd'} onClick={() => set('regime', 'graduated_osd')}>
                        <div className="t">Graduated + OSD</div>
                        <div className="d">Graduated rates on income after the 40% Optional Standard Deduction, plus 3% percentage tax.</div>
                      </button>
                      <button type="button" className={'opt-card' + (p.regime === 'graduated_itemized' ? ' on' : '')} aria-pressed={p.regime === 'graduated_itemized'} onClick={() => set('regime', 'graduated_itemized')}>
                        <div className="t">Graduated + itemized</div>
                        <div className="d">Graduated rates on income after actual documented expenses, plus 3% percentage tax.</div>
                      </button>
                    </div>
                  </div>
                )}
                {p.vatRegistered && (
                  <div style={{ marginTop: '16px' }}>
                    <label className="lbl">Deduction method</label>
                    <div className="opt-grid" style={{ marginTop: '10px' }}>
                      <button type="button" className={'opt-card' + (p.regime !== 'graduated_itemized' ? ' on' : '')} aria-pressed={p.regime !== 'graduated_itemized'} onClick={() => set('regime', 'graduated_osd')}>
                        <div className="t">Graduated + OSD</div>
                        <div className="d">40% Optional Standard Deduction — simpler books, files 1701A.</div>
                      </button>
                      <button type="button" className={'opt-card' + (p.regime === 'graduated_itemized' ? ' on' : '')} aria-pressed={p.regime === 'graduated_itemized'} onClick={() => set('regime', 'graduated_itemized')}>
                        <div className="t">Graduated + itemized</div>
                        <div className="d">Actual documented expenses — files the full 1701.</div>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
            {isCorp && (
              <>
                <div style={{ marginTop: '14px' }}>
                  <Switch on={p.vatRegistered} onChange={v => set('vatRegistered', v)}
                    title="VAT-registered"
                    desc="Required once gross sales pass ₱3,000,000; non-VAT corporations file the 3% quarterly percentage tax instead." />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px', marginTop: '18px' }}>
                  <SelectField label="Taxable year ends in" value={String(p.fiscalYearEndMonth)}
                    onChange={v => set('fiscalYearEndMonth', Number(v))}
                    options={MONTHS.map((m, i) => [String(i + 1), i + 1 === 12 ? 'December (calendar year)' : m])} />
                  <SelectField label="Year operations began" value={String(p.registrationYear || '')}
                    onChange={v => set('registrationYear', v ? Number(v) : null)}
                    options={[['', 'Not sure'], ...Array.from({ length: 30 }, (_, i) => {
                      const y = new Date().getFullYear() - i
                      return [String(y), String(y)]
                    })]} />
                </div>
                <p className="cite" style={{ marginTop: '10px' }}>The start year drives the 2% minimum corporate income tax (MCIT), which begins in the fourth taxable year after operations commence.</p>
              </>
            )}
          </div>
        )}

        {step === 2 && (isBiz || isCorp) && (
          <div>
            <h2 className="sec-h">Withholding &amp; payroll</h2>
            <div style={{ marginTop: '10px' }}>
              <Switch on={p.hasEmployees} onChange={v => set('hasEmployees', v)}
                title="Has employees"
                desc="Switches on the employer set: monthly 1601-C, annual 1604-C, employee 2316s, plus SSS, PhilHealth, Pag-IBIG and 13th-month obligations." />
              <Switch on={p.withholdsEwt} onChange={v => set('withholdsEwt', v)}
                title="Withholds expanded withholding tax (EWT)"
                desc="For payments like rent, professional fees, or contractor services: monthly 0619-E, quarterly 1601-EQ, annual 1604-E, and 2307 certificates to payees." />
              <Switch on={p.withholdsFwt} onChange={v => set('withholdsFwt', v)}
                title="Withholds final taxes"
                desc="Less common — final withholding on items like dividends or certain interest: 0619-F, 1601-FQ, 1604-F, and 2306 certificates." />
            </div>
          </div>
        )}

        {((step === 2 && p.type === 'employee') || (step === 3 && (isBiz || isCorp))) && (
          <div>
            <h2 className="sec-h">{p.type === 'employee' ? 'Review' : 'Registrations & records'}</h2>
            {(isBiz || isCorp) && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ margin: '6px 0 12px' }}>
                  <label className="lbl">Books of accounts</label>
                  <div className="opt-grid" style={{ marginTop: '10px' }}>
                    {[['manual', 'Manual books', 'Handwritten ledgers registered with the BIR — no annual re-registration; new books only when full.'],
                      ['looseleaf', 'Loose-leaf', 'Printed/bound records under a BIR permit — bound copies submitted every January 15.'],
                      ['cas', 'Computerized (CAS)', 'BIR-registered accounting system — annual back-up/registration by January 30.']].map(([k, t, d]) => (
                      <button key={k} type="button" className={'opt-card' + (p.booksType === k ? ' on' : '')} aria-pressed={p.booksType === k} onClick={() => set('booksType', k)}>
                        <div className="t">{t}</div>
                        <div className="d">{d}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Switch on={p.hasBusinessEstablishment} onChange={v => set('hasBusinessEstablishment', v)}
                  title="Registered place of business (LGU permit holder)"
                  desc="Switches on mayor's/business-permit renewal and local business tax every January, plus barangay clearance." />
                {!isCorp && (
                  <>
                    <Switch on={p.dtiRegistered} onChange={v => set('dtiRegistered', v)}
                      title="DTI-registered business name"
                      desc="Sole proprietors with a registered trade name renew it with DTI every five years." />
                    <Switch on={p.licensedProfessional} onChange={v => set('licensedProfessional', v)}
                      title="PRC-licensed professional"
                      desc="Licensed professionals renew a Professional Tax Receipt (PTR) with the LGU every January." />
                  </>
                )}
                <Switch on={p.usesCrmPos} onChange={v => set('usesCrmPos', v)}
                  title="Uses a cash register / POS machine"
                  desc="BIR-registered CRM/POS units carry their own reporting duties." />
                <Switch on={p.sellsGoods} onChange={v => set('sellsGoods', v)}
                  title="Sells goods / maintains inventory"
                  desc="Inventory-holding businesses submit an annual inventory list to the BIR within 30 days of year-end." />
              </div>
            )}
            <div style={{ marginTop: '18px', background: 'var(--accSoft)', borderRadius: '11px', padding: '14px 16px', fontSize: '13px', color: 'var(--accInk)', lineHeight: 1.6 }}>
              <b>{p.name || 'This profile'}</b> — {PROFILE_TYPES[p.type].name}
              {(isBiz || isCorp) && <> · {p.vatRegistered ? 'VAT' : 'Non-VAT'}</>}
              {isBiz && !p.vatRegistered && <> · {p.regime === '8pct' ? '8% flat tax' : p.regime === 'graduated_osd' ? 'Graduated + OSD' : 'Graduated + itemized'}</>}
              {p.hasEmployees && <> · employer</>}
              {p.withholdsEwt && <> · EWT agent</>}
              {isCorp && <> · FY ends {MONTHS[(p.fiscalYearEndMonth || 12) - 1]}</>}
            </div>
          </div>
        )}

        {err && <div className="form-err" role="alert">{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
          <button className="btn ghost" type="button" onClick={() => (step === 0 ? nav(-1) : setStep(s => s - 1))}>
            {step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < steps - 1 ? (
            <button className="btn" type="button" disabled={step === 0 && !p.name.trim()} onClick={() => setStep(s => s + 1)}>Continue</button>
          ) : (
            <button className="btn" type="button" disabled={busy || !p.name.trim()} onClick={finish}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create profile'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
