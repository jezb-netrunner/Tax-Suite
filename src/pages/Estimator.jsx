import React, { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApp } from '../state/AppState.jsx'
import { estimateIndividual, compensationForMixed } from '../engine/estimators/individual.js'
import { crossingMonthOptions } from '../engine/estimators/crossing.js'
import { estimateEmployee } from '../engine/estimators/employee.js'
import { estimateCorporation, estimateCorporateQuarter, corporateTaxYears, taxablePeriod, EARLIER_YEARS_NOTE } from '../engine/estimators/corporation.js'
import { estimatePayroll, DEFAULT_PAY_FACTOR, PAY_FACTORS, PAY_PERIODS, minimumWageReferenceNote } from '../engine/estimators/payroll.js'
import { selfEmployedMonthlyContributions, selfEmployedMonthlyEarnings } from '../engine/estimators/contributions.js'
import { fromISO, taxableYearQuarters } from '../engine/dates.js'
import { withChangedInputs } from '../engine/profile.js'
import { createInputSaver, figuresToShow } from '../lib/inputSaver.js'
import { NumField, SelectField, Switch, Disclaimer } from '../components/ui.jsx'
import { money, money2 } from '../lib/format.js'
import { RT, percentText, payFactorText } from '../engine/ruleText.js'
import corporateRules from '../data/rules/corporate.json'
import { useManilaToday } from '../lib/useManilaToday.js'
import { PrintHeader, PrintButton } from '../components/PrintHeader.jsx'

// fmt 'peso': return figures in whole pesos (BIR form lines);
// fmt 'centavo': payslip and contribution figures to the centavo.
function Rows({ rows, fmt = 'peso' }) {
  const f = fmt === 'centavo' ? money2 : money
  return (
    <div style={{ marginTop: '8px' }}>
      {rows.map((x, i) => (
        <div key={i}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '16px', padding: '9px 0', borderTop: x.rule ? '1px solid var(--line)' : undefined, marginTop: x.rule ? '2px' : undefined }}>
            <span style={{ fontSize: '13.5px', color: x.strong ? 'var(--ink)' : 'var(--mut)', fontWeight: x.strong ? 600 : 400 }}>{x.label}</span>
            <span className="mono" style={{ fontSize: '14px', fontWeight: x.strong ? 700 : 500 }}>
              {x.value == null ? '—' : x.value < 0 ? `(${f(-x.value)})` : f(x.value)}
            </span>
          </div>
          {x.sub && <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '-3px', paddingBottom: '6px', fontStyle: 'italic' }}>{x.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function BasisNote({ refs }) {
  return (
    <p className="cite" style={{ marginTop: '14px' }}>
      Legal basis: {Array.from(new Set(refs)).join(' · ')}. Details and verification dates are on the References page.
    </p>
  )
}

// M05: every mode starts with empty boxes; until the main figure is typed the
// results area shows this prompt instead of made-up sample figures.
function EnterFigures({ children, title = 'Enter your figures.' }) {
  return (
    <div className="card pad empty-note" style={{ marginTop: '16px' }}>
      <b style={{ color: 'var(--ink)' }}>{title}</b> {children} Nothing is saved to this profile until you type a figure.
    </div>
  )
}

const NOTE_STYLE = { marginTop: '12px', fontSize: '12.5px', color: 'var(--ink)', background: '#eef3f8', borderRadius: '9px', padding: '10px 13px', lineHeight: 1.5 }

// Per-profile input memory so returning users see their numbers.
// Persists 900ms after the last keystroke to avoid write storms.
//
// Things this has to get right, because one account holds many clients and
// the app may be open in several tabs:
//  - Seed from the profile these inputs belong to. The estimator subtree is
//    keyed by profile id (see Estimator below), so switching clients remounts
//    and re-seeds rather than showing the previous client's figures.
//  - C07: change only inputs[key] on the newest STORED profile (re-read at
//    save time), never write back this tab's copy of the whole profile: that
//    undid renames and settings saved in another tab, and re-created profiles
//    deleted there.
//  - C07: within inputs[key], save only the boxes this tab changed, merged
//    onto the stored figures (withChangedInputs), and show the stored figures
//    again when another tab changes them and this tab has nothing waiting to
//    be saved (figuresToShow). Two tabs on the same mode then keep each
//    other's figures.
//  - M06: save pending figures at once when the page is hidden, closed or
//    reloaded, and when the estimator is left (createInputSaver). In accounts
//    mode they are also kept in this browser until the account has them, and
//    saved after the next sign-in if the page went away first.
//  - M06: a failed save shows "Couldn't save your figures." (SaveNotice).
function useInputs(app, key) {
  const profileId = app.active?.id ?? null
  const saved = app.active?.inputs?.[key]
  const [vals, setVals] = useState(() => ({ ...(saved || {}) }))
  // The newest app state, for saves that run after this render.
  const appRef = React.useRef(app)
  appRef.current = app
  const saver = React.useRef(null)
  // Counts finished saves, so the stored figures are checked again after one.
  const [savesDone, setSavesDone] = useState(0)

  React.useEffect(() => {
    if (!profileId) return undefined
    const s = createInputSaver({
      save: changes => appRef.current.updateProfile(profileId, p => withChangedInputs(p, key, changes)),
      onError: e => appRef.current.reportSaveProblem(e),
      onSettled: () => setSavesDone(n => n + 1),
      // M06 (accounts mode only; the backend does nothing in local mode).
      stash: {
        write: values => (appRef.current.stashFigures ? appRef.current.stashFigures(profileId, key, values) : null),
        clear: stamp => { if (appRef.current.clearStashedFigures) appRef.current.clearStashedFigures(profileId, key, stamp) },
      },
    })
    saver.current = s
    return () => {
      if (saver.current === s) saver.current = null
      s.dispose()
    }
  }, [key, profileId])

  // C07: figures saved in another tab (the profile list reloads on the
  // storage event) replace what this tab shows, unless this tab's own changes
  // are still waiting or being saved.
  React.useEffect(() => {
    const busy = saver.current ? saver.current.busy() : false
    setVals(shown => figuresToShow(shown, saved, busy))
  }, [saved, savesDone])

  function update(k, v) {
    setVals(cur => ({ ...cur, [k]: v }))
    if (saver.current) saver.current.schedule({ [k]: v })
  }

  return [vals, update]
}

function IndividualEstimator({ app, mixed, onOpenTab }) {
  const p = app.active
  // M05: no sample figures; boxes start empty.
  const [v, set] = useInputs(app, mixed ? 'mixed' : 'individual')
  const taxYear = useManilaToday().getFullYear()
  // Mixed income: compensation comes from the Compensation side tab when it is
  // filled, otherwise from this tab's own boxes.
  const employeeInputs = p.inputs?.employee
  const comp = useMemo(
    () => (mixed ? compensationForMixed(v, employeeInputs) : null),
    [mixed, v, employeeInputs],
  )
  const showOwnComp = mixed && (comp.source !== 'compensationTab' || comp.ownTaxable !== null || comp.ownWithheld !== null)
  const hasFigures = Number(v.gross) > 0 || Number(v.otherIncome) > 0 || (mixed && comp.taxable > 0)
  const r = useMemo(() => estimateIndividual({
    gross: v.gross, expenses: v.expenses, cwt: v.cwt,
    vatRegistered: p.vatRegistered, mixed,
    compensationTaxable: mixed ? comp.taxable : 0,
    compensationWithheld: mixed ? comp.withheld : 0,
    quarterlyPaid: v.quarterlyPaid, priorYearCredits: v.priorYearCredits,
    crossedMonth: v.crossedMonth, salesThroughCrossMonth: v.salesThroughCrossMonth,
    eightPercentPaid: v.eightPercentPaid, taxYear,
    otherIncome: v.otherIncome, subjectToOtherPercentageTax: v.otherPercentageTax === 'yes',
    nolcoPrior: v.nolcoPrior,
  }), [v, comp, p.vatRegistered, mixed, taxYear])

  // The profile's regime, unless the figures override it.
  const opt8 = r.options.find(o => o.key === '8pct')
  const regimeNote = p.regime === '8pct' && r.crossing
    ? `Your profile says the ${RT.eightRate} option, but because sales passed ${RT.vatThreshold} the whole year is taxed at graduated rates.`
    : p.regime === '8pct' && p.vatRegistered
      ? `Your profile says the ${RT.eightRate} option, but it is not available to VAT-registered taxpayers.`
      : p.regime === '8pct' && !opt8.eligible
        ? `Your profile says the ${RT.eightRate} option, but it is not available with these figures: ${opt8.reason.replace(/^Not available: /, '')}`
        : `Note: the regime on this profile is ${p.regime === '8pct' ? `the ${RT.eightRate} option` : 'graduated rates'}, and the election locks for the year on the Q1 filing.`

  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <NumField emptyValue={null} label="Business gross sales / receipts · year" value={v.gross} onChange={x => set('gross', x)} prefix="₱" lg />
          <NumField emptyValue={null} label="Itemized expenses" value={v.expenses} onChange={x => set('expenses', x)} prefix="₱" />
          <NumField emptyValue={null} label="NOLCO from prior years" value={v.nolcoPrior} onChange={x => set('nolcoPrior', x)} prefix="₱" hint={`Unused net operating losses from the last ${RT.nolcoYears}. Used only in the itemized option, and only against business income. Losses from ${RT.nolcoPandemicLossYears} may carry over for ${RT.nolcoPandemicYears} (RA 11494); check with your CPA.`} />
          <NumField emptyValue={null} label="Other non-operating income (not subject to final tax)" value={v.otherIncome} onChange={x => set('otherIncome', x)} prefix="₱" hint="Income outside your main business. Leave out bank interest and other income already taxed at a final rate." />
          <NumField emptyValue={null} label="Tax withheld by clients (2307s)" value={v.cwt} onChange={x => set('cwt', x)} prefix="₱" />
          {showOwnComp && <NumField emptyValue={null} label="Taxable compensation · year" value={v.compensationTaxable} onChange={x => set('compensationTaxable', x)} prefix="₱" hint="Total taxable compensation for the year (BIR Form 2316 item 23; add every 2316 if you had more than one employer)." />}
          {showOwnComp && <NumField emptyValue={null} label="Tax withheld by employer" value={v.compensationWithheld} onChange={x => set('compensationWithheld', x)} prefix="₱" hint="Total taxes withheld shown on your 2316 (add every 2316 if you had more than one employer)." />}
          <NumField emptyValue={null} label="Income tax already paid on this year's quarterly returns (1701Q)" value={v.quarterlyPaid} onChange={x => set('quarterlyPaid', x)} prefix="₱" />
          <NumField emptyValue={null} label="Excess credits carried over from last year" value={v.priorYearCredits} onChange={x => set('priorYearCredits', x)} prefix="₱" hint="Only if last year's annual return carried an overpayment over to this year." />
        </div>
        {mixed && comp.source === 'compensationTab' && (
          <div role="note" style={NOTE_STYLE}>
            Compensation comes from the Compensation side tab: taxable compensation {money(comp.taxable)} and tax withheld
            by your employer {money(comp.withheld)} (the year's tax, which your employer withholds by December).{' '}
            <button type="button" className="linkbtn" onClick={() => onOpenTab('employee')}>Open the Compensation side tab</button>
          </div>
        )}
        {mixed && comp.differs && (
          <div className="mini-warn" role="alert">
            The compensation figures typed on this tab
            ({[comp.ownTaxable !== null && `taxable ${money(comp.ownTaxable)}`, comp.ownWithheld !== null && `withheld ${money(comp.ownWithheld)}`].filter(Boolean).join(', ')})
            differ from the Compensation side tab ({money(comp.taxable)} taxable, {money(comp.withheld)} withheld).
            This estimate uses the Compensation side tab. Clear the boxes here, or change that tab, so they match.
          </div>
        )}
        {mixed && comp.source !== 'compensationTab' && (
          <p className="cite" style={{ marginTop: '12px' }}>
            If you fill in the Compensation side tab, your compensation figures are taken from there.
          </p>
        )}
        <div style={{ marginTop: '18px', maxWidth: '560px' }}>
          <SelectField
            label="Is the business subject to other percentage taxes (NIRC Secs 117-127)?"
            value={v.otherPercentageTax === 'yes' ? 'yes' : 'no'}
            onChange={x => set('otherPercentageTax', x)}
            options={[['no', 'No'], ['yes', 'Yes']]}
            hint={`For example carriers, franchise holders, banks and finance companies, insurance, or amusement places. If yes, the ${RT.eightRate} option is not available.`}
          />
        </div>
        {v.otherPercentageTax === 'yes' && (
          <div className="mini-warn" role="note">
            Other percentage taxes (NIRC Secs 117-127) are not computed here. The percentage tax shown is the general {RT.percentageTaxRate} (NIRC Sec 116); check with your CPA which applies to your sales.
          </div>
        )}
        <p className="cite" style={{ marginTop: '14px' }}>
          Quarterly amounts are not computed here. Enter the income tax you have already paid on this year's 1701Q returns, and it is subtracted from what you pay with the annual return.
        </p>
      </div>

      {p.vatRegistered && (
        <div className="mini-warn" role="note" style={{ marginTop: '16px' }}>
          <b>VAT not included.</b> As a VAT-registered taxpayer you file VAT every quarter on Form 2550Q
          ({RT.vatRate} of sales less creditable input VAT). This estimate does not compute VAT: every total below is
          income tax and percentage tax only.
        </div>
      )}

      {!hasFigures ? (
        <EnterFigures>
          {mixed
            ? 'Start with your business gross sales and your taxable compensation for the year (or fill in the Compensation side tab). Your estimate appears here as you type.'
            : 'Start with your gross sales or receipts for the year. Your estimate appears here as you type.'}
        </EnterFigures>
      ) : (
        <>
          {r.crossing && (
            <CrossingCard
              crossing={r.crossing} v={v} set={set} monthOptions={crossingMonthOptions(1)}
              extraFields={<NumField emptyValue={null} label={`${RT.eightRate} income tax already paid on 1701Q this year`} value={v.eightPercentPaid} onChange={x => set('eightPercentPaid', x)} prefix="₱" hint="Credited against this year's graduated income tax. Don't count it again in the quarterly-payments box above." />}
            >
              The whole year moves to graduated rates: the {RT.eightRate} option is not available this year, and any {RT.eightRate} income tax
              already paid on your 1701Q is credited. The {RT.percentageTaxRate} percentage tax still applies to your sales from {r.crossing.span}.
            </CrossingCard>
          )}

          {r.nolco.note && (
            <div className="mini-warn" role="note" style={{ marginTop: '16px' }}>{r.nolco.note}</div>
          )}

          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--ink)' }}>{r.ratesLabel}.</b> {r.ratesNote}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '14px', marginTop: '12px' }}>
            {r.options.map(c => {
              // Every option in a tie for the lowest tax is marked (L01).
              const isBest = c.eligible && (c === r.best || Boolean(r.tie && r.tie.includes(c.key)))
              return (
                <div key={c.key} style={{
                  borderRadius: '13px', padding: '18px',
                  // M19: an option that is not available has a dashed outline instead of faded (unreadable) text.
                  border: isBest ? '1.5px solid var(--acc)' : c.eligible ? '1.5px solid var(--line)' : '1.5px dashed var(--field)',
                  background: isBest ? 'var(--accSoft)' : c.eligible ? 'var(--sf)' : '#f7f9fb',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14.5px' }}>{c.name}</span>
                    {isBest && <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 8px', borderRadius: '100px', background: 'var(--good)', color: '#fff' }}>{r.tie ? 'Tied lowest' : 'Lowest'}</span>}
                    {!c.eligible && <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', padding: '3px 8px', borderRadius: '100px', background: '#eef3f8', color: 'var(--mut)' }}>N/A</span>}
                  </div>
                  <div className="mono" style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-.01em', marginTop: '10px', color: isBest ? 'var(--accInk)' : 'var(--ink)' }}>{c.eligible ? money(c.total) : '—'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--mut)', marginTop: '3px' }}>{!c.eligible ? c.reason : c.vatNotIncluded ? r.vatNote : 'estimated annual tax'}</div>
                  <div style={{ marginTop: '14px', paddingTop: '13px', borderTop: '1px solid var(--line2)', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>Income tax</span>
                      <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>{c.eligible ? money(c.incomeTax) : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--mut)' }}>Business tax</span>
                      <span className="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                        {!c.eligible || c.businessTax.kind === 'vat' ? '—' : c.businessTax.kind === 'pct' ? money(c.businessTax.amount) : '₱0'}
                      </span>
                    </div>
                    {c.eligible && c.businessTax.kind === 'vat' && (
                      <div style={{ fontSize: '11.5px', color: 'var(--mut)' }}>VAT (2550Q) not included.</div>
                    )}
                    {c.eligible && c.businessTax.vatFrom && (
                      <div style={{ fontSize: '11.5px', color: 'var(--mut)' }}>Percentage tax to {r.crossing.monthName}; VAT from {c.businessTax.vatFrom} not included.</div>
                    )}
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--dim)' }}>Files: {c.forms}</div>
                </div>
              )
            })}
          </div>

          <div className="summary-banner" style={{ marginTop: '16px', background: 'var(--brand)', color: '#fff', borderRadius: '13px', padding: '17px 20px', display: 'flex', alignItems: 'center', gap: '13px' }}>
            <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--good)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>✓</span>
            <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4 }}>
              {r.tie
                ? r.tieNote
                : <>{r.best.name} is the cheapest eligible option at {money(r.best.total)}{r.savingsVsNext > 0 ? `, saving ${money(r.savingsVsNext)} versus the next best.` : '.'}</>}
              {r.vatNotIncluded && <>{' '}{r.vatNote}</>}
              {' '}{regimeNote}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '20px', alignItems: 'start' }}>
            <div className="card pad">
              <h2 className="sec-h">How we got there: {r.best.name}</h2>
              <Rows rows={r.rows} />
              <BasisNote refs={r.references} />
            </div>
            <FormPreview r={r} />
          </div>
          <SelfContributionsCard v={v} set={set} />
        </>
      )}
    </>
  )
}

// H04 (owner decision 6): a non-VAT taxpayer, individual or corporation,
// whose sales passed the VAT threshold this year. Asks the month and,
// optionally, the sales up to the end of that month.
function CrossingCard({ crossing, v, set, monthOptions, extraFields, children }) {
  return (
    <div className="card pad" style={{ marginTop: '16px' }}>
      <h2 className="sec-h">Your sales passed {RT.vatThreshold} this year</h2>
      <div className="mini-warn" role="note">
        {children}
        {' '}<b>VAT applies from {crossing.vatFrom}: not included in this estimate.</b> Register for VAT (update your
        registration) before the end of the month after the month your sales passed {RT.vatThreshold}.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px', marginTop: '16px' }}>
        <SelectField
          label={`Month your sales passed ${RT.vatThreshold}`}
          value={v.crossedMonth ? String(v.crossedMonth) : ''}
          onChange={x => set('crossedMonth', x ? Number(x) : null)}
          options={[['', `Not sure: assume even monthly sales (${crossing.evenMonthName})`], ...monthOptions]}
        />
        <NumField emptyValue={null} label={`Sales from ${crossing.span}`} value={v.salesThroughCrossMonth} onChange={x => set('salesThroughCrossMonth', x)} prefix="₱" hint="Optional. If blank, the year's sales are spread evenly by month." />
        {extraFields}
      </div>
      {crossing.warnings.map(w => <div key={w} className="mini-warn" role="alert">{w}</div>)}
    </div>
  )
}

// How the winning option lands on the annual return — the v1 "form preview".
// The annual return (1701 / 1701A) carries income tax only: income tax due
// less income-tax credits. Percentage tax is paid on the quarterly 2551Q and
// is shown below the return lines, never netted against the credits.
function FormPreview({ r }) {
  const best = r.best
  const ar = r.annualReturn
  const rows = [
    ...ar.taxable.map(t => ({ label: t.label, value: money(t.value) })),
    { label: 'Income tax due', value: money(ar.incomeTaxDue) },
    ...(ar.creditLines.length
      ? ar.creditLines.map(c => ({ label: c.label, value: `(${money(c.value)})` }))
      : [{ label: 'Less: tax credits', value: '—' }]),
    {
      label: ar.netPayable >= 0 ? 'Income tax payable with the annual return' : 'Overpayment',
      value: money(Math.abs(ar.netPayable)),
      strong: true,
    },
  ]
  const separate = []
  if (best.businessTax.kind === 'pct') separate.push({ label: 'Percentage tax: paid quarterly on 2551Q, not with the annual return', value: money(ar.percentageTax) })
  if (best.businessTax.vatFrom) separate.push({ label: `VAT from ${best.businessTax.vatFrom} (2550Q): not included in this estimate`, value: '—' })
  if (best.businessTax.kind === 'vat') separate.push({ label: 'VAT (2550Q): not included in this estimate', value: '—' })
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ background: '#f3f7fb', borderBottom: '1px solid var(--line)', padding: '15px 18px' }}>
        <div className="mono" style={{ fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--mut)' }}>Where it lands on the return</div>
        <div style={{ fontWeight: 700, fontSize: '14.5px', marginTop: '3px' }}>BIR Form {ar.form}</div>
      </div>
      <div style={{ padding: '6px 18px 16px' }}>
        {rows.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', borderTop: i ? '1px solid var(--line2)' : 'none' }}>
            <span style={{ flex: 1, fontSize: '13px', color: f.strong ? 'var(--ink)' : 'var(--mut)', fontWeight: f.strong ? 600 : 400 }}>{f.label}</span>
            <span className="mono" style={{ fontSize: '13.5px', fontWeight: f.strong ? 700 : 600 }}>{f.value}</span>
          </div>
        ))}
        {separate.map((f, i) => (
          <div key={'s' + i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 0', marginTop: i ? 0 : '6px', borderTop: i ? '1px solid var(--line2)' : '1px dashed var(--line)' }}>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--mut)' }}>{f.label}</span>
            <span className="mono" style={{ fontSize: '13.5px', fontWeight: 600 }}>{f.value}</span>
          </div>
        ))}
        {ar.overpaymentNote && (
          <p className="cite" style={{ marginTop: '10px' }}>{ar.overpaymentNote}</p>
        )}
        {!ar.creditLines.some(c => c.label.includes('1701Q')) && (
          <p className="cite" style={{ marginTop: '10px' }}>This is before any income tax paid on this year's 1701Q returns. Quarterly amounts are not computed here; enter what you paid above.</p>
        )}
        <p className="cite" style={{ marginTop: '10px' }}>Line numbering varies by form revision, so amounts are labeled by meaning rather than box number.</p>
      </div>
    </div>
  )
}

// M13: based on net monthly earnings, (gross − expenses) ÷ 12, or on the
// monthly earnings the member declared to SSS and PhilHealth.
function SelfContributionsCard({ v, set }) {
  const e = selfEmployedMonthlyEarnings({ grossAnnual: v.gross, expensesAnnual: v.expenses, declaredMonthly: v.declaredMonthlyEarnings })
  const c = useMemo(() => selfEmployedMonthlyContributions(e.monthly), [e.monthly])
  const noExpenses = !(Number(v.expenses) > 0)
  return (
    <div className="card pad" style={{ marginTop: '16px' }}>
      <h2 className="sec-h">Monthly contributions on top (self-employed)</h2>
      <p style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '4px', lineHeight: 1.5 }}>
        {e.basis === 'declared'
          ? <>Based on the monthly earnings you declared: {money2(e.monthly)}.</>
          : e.basis === 'net'
            ? <>Based on net monthly earnings of {money2(e.monthly)}: (gross sales {money(v.gross)} − expenses {money(v.expenses || 0)}) ÷ 12.{noExpenses && ' No expenses are entered above, so this is your gross sales ÷ 12.'}</>
            : <>Your expenses are equal to or more than your sales, so there are no net earnings to base contributions on. Enter the monthly earnings you declare to SSS and PhilHealth below.</>}
        {' '}SSS, PhilHealth, and Pag-IBIG are separate from your taxes.
      </p>
      <div style={{ maxWidth: '320px', marginTop: '12px' }}>
        <NumField emptyValue={null} label="Declared monthly earnings (optional)" value={v.declaredMonthlyEarnings} onChange={x => set('declaredMonthlyEarnings', x)} prefix="₱" hint="The monthly earnings you declare to SSS and PhilHealth, if different from the net figure." />
      </div>
      {e.basis !== 'none' && (
        <Rows fmt="centavo" rows={[
          { label: 'SSS (self-employed, incl. EC)', value: c.sss },
          { label: 'PhilHealth (direct contributor)', value: c.philhealth },
          { label: 'Pag-IBIG savings', value: c.pagibig },
          { label: 'Total per month', value: c.total, strong: true, rule: true },
        ]} />
      )}
      <p className="cite" style={{ marginTop: '10px' }}>
        Contribution schedules change by agency circular; confirm the current tables before paying.
      </p>
    </div>
  )
}

// M11 / H16: excess MCIT is usable for this many taxable years (corporate.json).
const MCIT_CARRY_YEARS = corporateRules.mcit.value.excessCarryForwardYears

// C04: minimum wage earner inputs (owner decision 9: the user enters the
// statutory daily rate and the paid days a year).
const PAY_FACTOR_OPTIONS = PAY_FACTORS.map(f => [String(f), payFactorText(f)])
const [EVERY_DAY, SIX_DAY, FIVE_DAY] = PAY_FACTORS
const PAY_FACTOR_HINT = `${EVERY_DAY} if paid for every day of the year, rest days included (most monthly-paid workers); ${SIX_DAY} for a six-day week; ${FIVE_DAY} for a five-day week.`

function minimumWageHint() {
  return `Use the minimum wage for your region and industry. ${minimumWageReferenceNote()}`
}

function MinimumWageSwitch({ v, set, who }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <Switch
        on={Boolean(v.mwe)}
        onChange={x => set('mwe', x)}
        title="Minimum wage earner"
        desc={`Switch on if ${who} paid the statutory minimum wage. The minimum wage and holiday, overtime, night-differential and hazard pay are then tax-free; other pay and 13th-month pay and bonuses above ${RT.thirteenthMonthCap} are still taxed.`}
      />
    </div>
  )
}

function MinimumWageFields({ v, set }) {
  return (
    <>
      <NumField emptyValue={null} label="Statutory daily minimum wage" value={v.mweDailyRate} onChange={x => set('mweDailyRate', x)} prefix="₱" lg hint={minimumWageHint()} />
      <SelectField
        label="Paid days a year"
        value={String(v.payFactor ?? DEFAULT_PAY_FACTOR)}
        onChange={x => set('payFactor', Number(x))}
        options={PAY_FACTOR_OPTIONS}
        hint={`${PAY_FACTOR_HINT} Monthly minimum wage = daily rate × paid days a year ÷ 12.`}
      />
      <NumField emptyValue={null} label="Holiday, overtime, night-differential and hazard pay · month" value={v.mweExtraPay} onChange={x => set('mweExtraPay', x)} prefix="₱" hint="Tax-free for a minimum wage earner." />
    </>
  )
}

// L08: pay period for the per-payday withholding; daily pay needs the paid
// days a year (already asked in the minimum wage fields when that switch is on).
function PayPeriodFields({ v, set, mwe }) {
  const period = PAY_PERIODS.some(([k]) => k === v.payPeriod) ? v.payPeriod : 'monthly'
  return (
    <>
      <SelectField
        label="Pay period"
        value={period}
        onChange={x => set('payPeriod', x)}
        options={PAY_PERIODS}
        hint="How often pay is released. The withholding per payday uses the matching BIR table."
      />
      {period === 'daily' && !mwe && (
        <SelectField
          label="Paid days a year"
          value={String(v.payFactor ?? DEFAULT_PAY_FACTOR)}
          onChange={x => set('payFactor', Number(x))}
          options={PAY_FACTOR_OPTIONS}
          hint={PAY_FACTOR_HINT}
        />
      )}
    </>
  )
}

// C05: SSS counts regular pay; one-time or liquidated items are taxed but do
// not count for SSS. The regular box keeps the old 'monthlyAllowances' key so
// saved figures carry over.
function AllowanceFields({ v, set }) {
  return (
    <>
      <NumField emptyValue={null} label="Regular allowances / commissions · month" value={v.monthlyAllowances} onChange={x => set('monthlyAllowances', x)} prefix="₱" hint="Taxable pay received every month: allowances you don't liquidate, commissions and other regular pay. Counts for SSS. Leave out de minimis benefits." />
      <NumField emptyValue={null} label="One-time or liquidated items · month" value={v.monthlyOtherTaxable} onChange={x => set('monthlyOtherTaxable', x)} prefix="₱" hint="Taxable one-time pay, or the taxable part of allowances you liquidate with receipts. Does not count for SSS." />
    </>
  )
}

function EmployeeEstimator({ app }) {
  const p = app.active
  const [v, set] = useInputs(app, 'employee')
  // The minimum-wage option is offered on employee profiles. A mixed-income
  // profile's Compensation side tab feeds the annual return, so it stays off there.
  const showMwe = p.type === 'employee'
  const mwe = showMwe && Boolean(v.mwe)
  const r = useMemo(() => estimateEmployee({
    ...v, mwe, monthlyBasic: v.monthlyBasic ?? 0, monthlyAllowances: v.monthlyAllowances ?? 0, bonusesAnnual: v.bonusesAnnual ?? 0,
  }), [v, mwe])
  const hasFigures = mwe ? Number(v.mweDailyRate) > 0 : Number(v.monthlyBasic) > 0
  return (
    <>
      <div className="card pad">
        {showMwe && <MinimumWageSwitch v={v} set={set} who="you are" />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          {mwe
            ? <MinimumWageFields v={v} set={set} />
            : <NumField emptyValue={null} label="Monthly basic salary" value={v.monthlyBasic} onChange={x => set('monthlyBasic', x)} prefix="₱" lg />}
          <AllowanceFields v={v} set={set} />
          <NumField emptyValue={null} label="13th month & bonuses · year" value={v.bonusesAnnual} onChange={x => set('bonusesAnnual', x)} prefix="₱" hint={`First ${RT.thirteenthMonthCap} is tax-exempt.`} />
          <PayPeriodFields v={v} set={set} mwe={mwe} />
        </div>
        {p.type === 'mixed' && (
          <p className="cite" style={{ marginTop: '14px' }}>
            The minimum wage earner option is on employee profiles and on the Payroll tab. If you earn the minimum wage
            and also have business income, have a CPA check how the exemption applies to you.
          </p>
        )}
      </div>
      {!hasFigures ? (
        // L09: a blank or ₱0 salary computes nothing (no contributions, no negative take-home).
        <EnterFigures title={mwe ? 'Enter the daily minimum wage.' : 'Enter a salary.'}>{mwe
          ? 'Start with the statutory daily minimum wage. Your payslip and annual tax appear here as you type.'
          : 'Start with your monthly basic salary (more than ₱0). Your payslip and annual tax appear here as you type.'}</EnterFigures>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '20px', alignItems: 'start' }}>
          <div className="card pad">
            <h2 className="sec-h">Your monthly payslip</h2>
            <Rows fmt="centavo" rows={r.rows} />
          </div>
          <div className="card pad">
            <h2 className="sec-h">Your year, annualized</h2>
            <Rows fmt="centavo" rows={r.annualRows} />
            <BasisNote refs={r.references} />
          </div>
        </div>
      )}
    </>
  )
}

function fmtISO(isoDate) {
  return fromISO(isoDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CorporationEstimator({ app, onPrintYear }) {
  const p = app.active
  const [v, set] = useInputs(app, 'corporation')
  const hasFigures = Number(v.grossSales) > 0
  // C06: current or previous taxable year; default = the return due next.
  const today = useManilaToday()
  const fy = p.fiscalYearEndMonth || 12
  const years = useMemo(() => corporateTaxYears({ today, fiscalYearEndMonth: fy }), [today, fy])
  const choice = v.taxYear === 'earlier'
    ? 'earlier'
    : years.options.some(o => o.year === v.taxYear) ? v.taxYear : years.defaultYear
  const earlier = choice === 'earlier'
  const dueNext = years.options.find(o => o.year === years.defaultYear)
  // M11: excess MCIT of the 3 taxable years before the chosen one, keyed by year.
  const mcitYears = useMemo(() => (earlier ? [] : Array.from({ length: MCIT_CARRY_YEARS }, (_, i) => choice - 1 - i)), [earlier, choice])
  const excessMcit = useMemo(
    () => mcitYears.map(y => ({ year: y, amount: v.excessMcit?.[y] })).filter(x => Number(x.amount) > 0),
    [v.excessMcit, mcitYears],
  )
  const osd = v.deduction === 'osd'
  const r = useMemo(() => (earlier ? null : estimateCorporation({
    ...v,
    totalAssets: v.totalAssets ?? 0,
    registrationYear: p.registrationYear,
    taxYear: choice,
    fiscalYearEndMonth: fy,
    vatRegistered: p.vatRegistered,
    excessMcit,
  })), [v, p, choice, fy, earlier, excessMcit])
  const setExcessMcit = (y, x) => set('excessMcit', { ...(v.excessMcit || {}), [y]: x })
  // M22: the printout's "Tax year" is the taxable year chosen here.
  const printYear = earlier ? `before ${years.previous}` : taxablePeriod(choice, fy).option
  React.useEffect(() => { if (onPrintYear) onPrintYear(printYear) }, [onPrintYear, printYear])
  return (
    <>
      <div className="card pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          <SelectField
            label="Taxable year"
            value={String(choice)}
            onChange={x => set('taxYear', x === 'earlier' ? 'earlier' : Number(x))}
            options={[...years.options.map(o => [String(o.year), o.option]), ['earlier', 'An earlier year']]}
            hint={`Starts on the year whose annual return (1702-RT) is due next: ${dueNext.label}, due ${fmtISO(dueNext.dueDate)}.`}
          />
          <NumField emptyValue={null} label="Gross sales / revenue · year" value={v.grossSales} onChange={x => set('grossSales', x)} prefix="₱" lg />
          <NumField emptyValue={null} label="Cost of sales / services" value={v.costOfSales} onChange={x => set('costOfSales', x)} prefix="₱" />
          <SelectField
            label="Deductions"
            value={osd ? 'osd' : 'itemized'}
            onChange={x => set('deduction', x)}
            options={[['itemized', 'Itemized expenses'], ['osd', `OSD (${RT.corpOsdRate})`]]}
            hint={`The optional standard deduction is ${RT.corpOsdRate} of gross income (sales less cost of sales). The choice is made on the first quarterly return and kept for the year.`}
          />
          <NumField emptyValue={null} label="Operating expenses" value={v.opex} onChange={x => set('opex', x)} prefix="₱" hint={osd ? `Not used with the ${RT.corpOsdRate} OSD.` : undefined} />
          <NumField
            emptyValue={null} label="NOLCO from prior years" value={v.nolcoPrior} onChange={x => set('nolcoPrior', x)} prefix="₱"
            hint={osd
              ? `Not used with the ${RT.corpOsdRate} OSD.`
              : `Unused net operating losses from the last ${RT.nolcoYears}. Used only with itemized deductions, against taxable income (never the MCIT). Losses from ${RT.nolcoPandemicLossYears} may carry over for ${RT.nolcoPandemicYears} (RA 11494); check with your CPA.`}
          />
          <NumField emptyValue={null} label="Total assets (excl. land)" value={v.totalAssets} onChange={x => set('totalAssets', x)} prefix="₱" hint={`For the ${RT.rcitSmall} small-corporation test. A blank box counts as ₱0.`} />
          <NumField emptyValue={null} label="Creditable tax withheld (2307s)" value={v.cwt} onChange={x => set('cwt', x)} prefix="₱" />
          <NumField emptyValue={null} label="Income tax already paid on this year's quarterly returns (1702Q)" value={v.quarterlyPaid} onChange={x => set('quarterlyPaid', x)} prefix="₱" />
          <NumField emptyValue={null} label="Excess credits carried over from last year" value={v.priorYearCredits} onChange={x => set('priorYearCredits', x)} prefix="₱" hint="Only if last year's annual return carried an overpayment over to this year." />
        </div>
        {!earlier && (
          <details style={{ marginTop: '16px' }} open={excessMcit.length > 0 || undefined}>
            <summary style={{ cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>Excess MCIT from the last {RT.mcitCarryYears} (optional)</summary>
            <p className="cite" style={{ marginTop: '8px' }}>
              If MCIT was higher than the regular tax in an earlier year, the difference is credited against the regular tax
              (never against the MCIT) for the next {MCIT_CARRY_YEARS} taxable years. Enter what is not used yet. Excess MCIT
              from {taxablePeriod(choice - MCIT_CARRY_YEARS - 1, fy).name} or earlier has expired.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px', marginTop: '10px' }}>
              {mcitYears.map(y => (
                <NumField key={y} emptyValue={null} label={`Excess MCIT from ${taxablePeriod(y, fy).name}`} value={v.excessMcit?.[y]} onChange={x => setExcessMcit(y, x)} prefix="₱" />
              ))}
            </div>
          </details>
        )}
        <p className="cite" style={{ marginTop: '14px' }}>
          Enter the income tax already paid on this year's 1702Q returns, and it is subtracted from what you pay with the
          annual return (1702-RT). To estimate one quarterly return, use the 1702Q section below.
        </p>
      </div>
      {earlier ? (
        <div className="mini-warn" role="note" style={{ marginTop: '16px' }}>{EARLIER_YEARS_NOTE}</div>
      ) : !hasFigures ? (
        <EnterFigures>Start with gross sales or revenue for the year. Your estimate appears here as you type.</EnterFigures>
      ) : (
        <>
          {r.crossing && (
            <CrossingCard crossing={r.crossing} v={v} set={set} monthOptions={crossingMonthOptions(Number(r.period.start.slice(5, 7)))}>
              As a non-VAT corporation, you still pay the {RT.percentageTaxRate} percentage tax on your sales from {r.crossing.span} (Form 2551Q).
            </CrossingCard>
          )}
          <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--mut)', lineHeight: 1.5 }}>
            <b style={{ color: 'var(--ink)' }}>{r.period.label}.</b> Annual return (1702-RT) due {fmtISO(r.period.annualDue)}.
          </p>
          {r.nolco.note && <div className="mini-warn" role="note" style={{ marginTop: '10px' }}>{r.nolco.note}</div>}
          {r.nolco.osdNote && <div className="mini-warn" role="note" style={{ marginTop: '10px' }}>{r.nolco.osdNote}</div>}
          {r.mcitWarning && (
            <div className="mini-warn" role="note" style={{ marginTop: '10px' }}>
              <b>Check the MCIT.</b> {r.mcitWarning}
              {p.id && <>{' '}<Link to={`/profiles/${p.id}/edit`}>Edit the profile</Link></>}
            </div>
          )}
          <div className="summary-banner" style={{ marginTop: '10px', background: 'var(--brand)', color: '#fff', borderRadius: '13px', padding: '17px 20px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.4 }}>
              {r.mcitStatus === 'unknown' && r.usesMcit
                ? <>Income tax due: {money(r.incomeTaxDue)} if the {RT.mcitRate} MCIT applies, or {money(r.rcit)} at the {percentText(r.rcitRate)} {r.smallCorp ? 'small-corporation' : 'standard'} rate if it does not apply yet.</>
                : r.usesMcit
                  ? <>The {RT.mcitRate} MCIT binds this year: {money(r.incomeTaxDue)} (RCIT would be {money(r.rcit)}).</>
                  : <>Income tax due: {money(r.incomeTaxDue)} at the {percentText(r.rcitRate)} {r.smallCorp ? 'small-corporation' : 'standard'} rate{r.mcitStatus !== 'notYet' ? `, above the ${money(r.mcit)} MCIT floor` : ''}.</>}
              {r.businessTaxNote && <> {r.businessTaxNote}</>}
            </span>
          </div>
          <div className="card pad" style={{ marginTop: '20px' }}>
            <h2 className="sec-h">How we got there</h2>
            <Rows rows={r.rows} />
            <BasisNote refs={r.references} />
          </div>
        </>
      )}
      {!earlier && (
        <CorporateQuarterCard v={v} set={set} p={p} taxYear={choice} fy={fy} excessMcit={excessMcit} />
      )}
    </>
  )
}

// M11: one 1702Q on cumulative figures (start of the taxable year to the end
// of the quarter). Uses the deduction method, assets, registration year, last
// year's excess credits and excess MCIT from the annual section above.
function CorporateQuarterCard({ v, set, p, taxYear, fy, excessMcit }) {
  const quarter = [1, 2, 3].includes(Number(v.qQuarter)) ? Number(v.qQuarter) : 1
  const quarters = taxableYearQuarters(taxYear, fy).slice(0, 3)
  const mon = d => d.toLocaleDateString('en-US', { month: 'short' })
  const osd = v.deduction === 'osd'
  const hasFigures = Number(v.qGrossSales) > 0
  const q = useMemo(() => (hasFigures ? estimateCorporateQuarter({
    quarter,
    grossSales: v.qGrossSales, costOfSales: v.qCostOfSales, opex: v.qOpex,
    paidEarlierQuarters: quarter > 1 ? v.qPaidEarlier : 0, cwt: v.qCwt,
    deduction: v.deduction, totalAssets: v.totalAssets ?? 0, registrationYear: p.registrationYear,
    taxYear, fiscalYearEndMonth: fy, priorYearCredits: v.priorYearCredits, excessMcit,
  }) : null), [hasFigures, quarter, v, p.registrationYear, taxYear, fy, excessMcit])
  return (
    <div className="card pad" style={{ marginTop: '20px' }}>
      <h2 className="sec-h">Quarterly return (1702Q)</h2>
      <p style={{ fontSize: '13px', color: 'var(--mut)', marginTop: '4px', lineHeight: 1.5 }}>
        Enter figures from the start of the taxable year to the end of the quarter, as the 1702Q asks. The regular tax and
        the MCIT are compared on those totals, and what you paid in earlier quarters is subtracted. The deduction method,
        total assets, last year's excess credits and excess MCIT come from the boxes above.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px', marginTop: '14px' }}>
        <SelectField
          label="Quarter"
          value={String(quarter)}
          onChange={x => set('qQuarter', Number(x))}
          options={quarters.map(x => [String(x.q), `Q${x.q}: ${mon(x.start)} to ${mon(x.end)} ${x.end.getFullYear()}`])}
        />
        <NumField emptyValue={null} label="Gross sales / revenue · year to date" value={v.qGrossSales} onChange={x => set('qGrossSales', x)} prefix="₱" />
        <NumField emptyValue={null} label="Cost of sales · year to date" value={v.qCostOfSales} onChange={x => set('qCostOfSales', x)} prefix="₱" />
        {!osd && <NumField emptyValue={null} label="Operating expenses · year to date" value={v.qOpex} onChange={x => set('qOpex', x)} prefix="₱" />}
        {quarter > 1 && <NumField emptyValue={null} label="Income tax paid on earlier 1702Q this year" value={v.qPaidEarlier} onChange={x => set('qPaidEarlier', x)} prefix="₱" />}
        <NumField emptyValue={null} label="Tax withheld by customers (2307s) · year to date" value={v.qCwt} onChange={x => set('qCwt', x)} prefix="₱" />
      </div>
      {!q ? (
        <p className="cite" style={{ marginTop: '14px' }}>Enter the gross sales from the start of the year to see this quarter's 1702Q.</p>
      ) : !q.supported ? (
        <div className="mini-warn" role="note">{q.message}</div>
      ) : (
        <>
          <p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--mut)' }}>
            <b style={{ color: 'var(--ink)' }}>{q.quarterLabel}.</b> 1702Q due {fmtISO(q.dueDate)}.
          </p>
          <Rows rows={q.rows} />
        </>
      )}
    </div>
  )
}

function PayrollEstimator({ app }) {
  const [v, set] = useInputs(app, 'payroll')
  const mwe = Boolean(v.mwe)
  const r = useMemo(() => estimatePayroll({
    ...v, mwe, monthlyBasic: v.monthlyBasic ?? 0, monthlyAllowances: v.monthlyAllowances ?? 0,
  }), [v, mwe])
  const hasFigures = mwe ? Number(v.mweDailyRate) > 0 : Number(v.monthlyBasic) > 0
  return (
    <>
      <div className="card pad">
        <MinimumWageSwitch v={v} set={set} who="this employee is" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: '18px' }}>
          {mwe
            ? <MinimumWageFields v={v} set={set} />
            : <NumField emptyValue={null} label="Employee monthly basic pay" value={v.monthlyBasic} onChange={x => set('monthlyBasic', x)} prefix="₱" lg />}
          <AllowanceFields v={v} set={set} />
          <PayPeriodFields v={v} set={set} mwe={mwe} />
        </div>
      </div>
      {!hasFigures ? (
        <EnterFigures title={mwe ? 'Enter the daily minimum wage.' : 'Enter a salary.'}>{mwe
          ? 'Start with the statutory daily minimum wage. The withholding and true cost appear here as you type.'
          : 'Start with the employee\'s monthly basic pay (more than ₱0). The withholding and true cost appear here as you type.'}</EnterFigures>
      ) : (
        <div className="card pad" style={{ marginTop: '20px' }}>
          <h2 className="sec-h">Withholding &amp; true cost for this employee</h2>
          <Rows fmt="centavo" rows={r.rows} />
          <BasisNote refs={r.references} />
        </div>
      )}
    </>
  )
}

export default function Estimator() {
  const app = useApp()
  const nav = useNavigate()
  const p = app.active
  const [tab, setTab] = useState(null)
  const year = useManilaToday().getFullYear()
  const [corpPrintYear, setCorpPrintYear] = useState(null)

  if (!app.profilesReady) return null
  if (!p) {
    return (
      <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
        {/* L16: every page has a main heading (focused after navigation). */}
        <h1 className="pg-h1" style={{ marginBottom: '16px' }}>Estimator</h1>
        <div className="card pad empty-note">
          Set up a taxpayer profile first. The estimator adapts to the profile's regime and registrations.
          <div style={{ marginTop: '14px' }}><button className="btn" onClick={() => nav('/profiles/new')}>Create a profile</button></div>
        </div>
      </div>
    )
  }

  // Tabs relevant to this profile.
  const tabs = []
  if (p.type === 'individual') tabs.push(['individual', 'Business income'])
  if (p.type === 'mixed') tabs.push(['mixed', 'Mixed income'])
  if (p.type === 'employee') tabs.push(['employee', 'Take-home & annual tax'])
  if (p.type === 'corporation') tabs.push(['corporation', 'Corporate income tax'])
  if (p.hasEmployees || p.type === 'corporation') tabs.push(['payroll', 'Payroll withholding'])
  if (p.type === 'mixed') tabs.push(['employee', 'Compensation side'])
  const active = tab && tabs.some(([k]) => k === tab) ? tab : tabs[0][0]

  const titles = {
    individual: 'Which regime saves you the most?',
    mixed: 'Your combined tax picture',
    employee: 'Your pay, your tax, your take-home',
    corporation: 'Regular corporate income tax (RCIT) or minimum corporate income tax (MCIT): what will you owe?',
    payroll: 'What withholding an employee costs',
  }

  return (
    <div className="page wrap" style={{ paddingTop: '26px', paddingBottom: '64px' }}>
      <PrintHeader profileName={p.name} taxYear={active === 'corporation' && corpPrintYear ? corpPrintYear : year} />
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <div>
          <h1 className="pg-h1">{titles[active]}</h1>
          <p className="pg-sub">Estimating for <b>{p.name}</b>. Every line shows its math, every rate shows its source.</p>
          <p style={{ fontSize: '12.5px', color: 'var(--ink)', marginTop: '4px' }}>{app.hasCloud ? 'Figures you type are saved to this profile in your account.' : 'Figures you type are saved to this profile in this browser.'}</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {tabs.length > 1 && (
            <div className="seg" role="group" aria-label="Estimator">
              {tabs.map(([k, l]) => (
                <button key={k} className={active === k ? 'active' : ''} aria-pressed={active === k} onClick={() => setTab(k)}>{l}</button>
              ))}
            </div>
          )}
          <PrintButton />
        </div>
      </div>

      {/* Keyed by profile and tab so switching either remounts the inputs —
          otherwise one client's saved figures would linger under another's. */}
      <React.Fragment key={`${p.id || 'local'}:${active}`}>
        {active === 'individual' && <IndividualEstimator app={app} mixed={false} />}
        {active === 'mixed' && <IndividualEstimator app={app} mixed={true} onOpenTab={setTab} />}
        {active === 'employee' && <EmployeeEstimator app={app} />}
        {active === 'corporation' && <CorporationEstimator app={app} onPrintYear={setCorpPrintYear} />}
        {active === 'payroll' && <PayrollEstimator app={app} />}
      </React.Fragment>

      <Disclaimer>
        These figures are estimates computed from published rates and schedules; they don't account for your
        complete facts (special deductions, incentives, local specifics) and are not tax or
        legal advice. Have a CPA review your numbers before you rely on them for filing or payment.
      </Disclaimer>
    </div>
  )
}
