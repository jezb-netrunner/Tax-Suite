// H07: the References register shows every rule in the rulebook with its
// value (tables as small tables), its legal basis and its confidence.
import { describe, it, expect } from 'vitest'
import incomeTax from '../../src/data/rules/income-tax.json'
import businessTax from '../../src/data/rules/business-tax.json'
import corporate from '../../src/data/rules/corporate.json'
import wcomp from '../../src/data/rules/withholding-compensation.json'
import penalties from '../../src/data/rules/penalties.json'
import contributions from '../../src/data/rules/contributions.json'
import ewtRates from '../../src/data/rules/ewt-rates.json'
import attachments from '../../src/data/rules/attachments.json'
import holidays from '../../src/data/rules/holidays.json'
import obligations from '../../src/data/rules/obligations.json'
import { describeValue, describeSchedule, ruleRegister, labelize } from '../../src/engine/rulebook.js'

const FILES = {
  'income-tax.json': incomeTax, 'business-tax.json': businessTax, 'corporate.json': corporate,
  'withholding-compensation.json': wcomp, 'penalties.json': penalties, 'contributions.json': contributions,
  'ewt-rates.json': ewtRates, 'attachments.json': attachments, 'holidays.json': holidays, 'obligations.json': obligations,
}

// Every object in the rulebook that carries a confidence, as 'file:path'.
function confidencePaths() {
  const out = {}
  for (const [file, data] of Object.entries(FILES)) {
    const walk = (o, path) => {
      if (Array.isArray(o)) { o.forEach((v, i) => walk(v, `${path}[${v && v.id ? `id=${v.id}` : i}]`)); return }
      if (!o || typeof o !== 'object') return
      if ('confidence' in o) out[`${file}:${path || '(top)'}`] = o.confidence
      for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k)
    }
    walk(data, '')
  }
  return out
}

const allEntries = () => {
  const r = ruleRegister()
  return [...r.computation, ...r.holidays, ...r.obligations]
}

describe('H07 register covers every rule and its confidence', () => {
  const paths = confidencePaths()

  it('finds the needs_review rules in the rulebook', () => {
    const review = Object.entries(paths).filter(([, c]) => c === 'needs_review').map(([p]) => p).sort()
    expect(review).toEqual([
      'business-tax.json:vatRegistrationDeadline',
      'contributions.json:pagibigCompensationBase',
      'contributions.json:philhealthShareRounding',
      'corporate.json:excessMcitCredit',
      'holidays.json:(top)',
      'holidays.json:fixedByLaw',
      'holidays.json:notes2027',
      'holidays.json:rollOverByAgency.DOLE',
      'holidays.json:rollOverByAgency.LGU',
      'holidays.json:rollOverByAgency.Pag-IBIG',
      'holidays.json:rollOverByAgency.SEC',
      'income-tax.json:netOperatingLossCarryOver',
      'obligations.json:obligations[id=bir-crm-pos]',
      'obligations.json:obligations[id=bir-einvoicing]',
      'obligations.json:obligations[id=bir-fbt-note]',
      'obligations.json:obligations[id=bir-micro-abatement-2026]',
      'obligations.json:obligations[id=lgu-cedula]',
      'obligations.json:obligations[id=pagibig-self]',
      'obligations.json:obligations[id=philhealth-self]',
      'obligations.json:obligations[id=sec-afs-calendar]',
      'penalties.json:eoptTransition',
      'penalties.json:interestDayCount',
      'withholding-compensation.json:minimumWageReference',
      'withholding-compensation.json:mweContributions',
      'withholding-compensation.json:payslipRounding',
    ])
  })

  it('every rule with a confidence has an entry; an entry is needs_review when any of its sources is', () => {
    const entries = allEntries()
    for (const [path, conf] of Object.entries(paths)) {
      const e = entries.find(x => x.sources.includes(path))
      expect(e, path).toBeTruthy()
      if (conf === 'needs_review') expect(e.confidence, path).toBe('needs_review')
    }
    for (const e of entries) {
      const confs = e.sources.map(s => paths[s])
      expect(confs.every(Boolean), e.id).toBe(true)
      expect(e.confidence, e.id).toBe(confs.includes('needs_review') ? 'needs_review' : 'verified')
    }
  })

  it('computation entries carry value, legal basis and notes', () => {
    const r = ruleRegister()
    const nolco = r.computation.find(e => e.id === 'income-tax.json:netOperatingLossCarryOver')
    expect(nolco).toMatchObject({
      file: 'Individual income tax', title: 'Net operating loss carry over', confidence: 'needs_review',
      legalBasis: incomeTax.netOperatingLossCarryOver.legalBasis, notes: incomeTax.netOperatingLossCarryOver.notes,
    })
    expect(nolco.value).toEqual({
      kind: 'fields', fields: [
        { label: 'Carry over years', value: { kind: 'text', text: '3' } },
        { label: 'Pandemic loss years', value: { kind: 'text', text: '2020, 2021' } },
        { label: 'Pandemic carry over years', value: { kind: 'text', text: '5' } },
      ],
    })
  })

  it('obligation entries carry the schedule in words, form, agency and notes', () => {
    const r = ruleRegister()
    const ob = r.obligations.find(e => e.id === 'obligations.json:bir-looseleaf-books')
    expect(ob).toMatchObject({
      title: 'Submit bound loose-leaf books', form: 'via ORUS', agency: 'BIR', confidence: 'verified',
      when: '15 days after the taxable year ends (January 15 for calendar-year taxpayers)',
    })
    expect(r.obligations.length).toBe(obligations.obligations.length)
  })

  it('lists the deadline extensions (overrides) with their basis', () => {
    const r = ruleRegister()
    expect(r.overrides[0]).toEqual({
      title: 'File annual income tax return', form: '1701A', from: 'Apr 15, 2026', to: 'May 15, 2026', basis: 'RMC 30-2026',
    })
    expect(r.overrides.length).toBe(obligations.overrides.length)
  })
})

describe('H07 rule values', () => {
  it('graduated brackets (TI:WS-01..05 table) render as a small table', () => {
    expect(describeValue(incomeTax.graduatedBrackets.value, 'graduatedBrackets')).toEqual({
      kind: 'table',
      columns: ['Over', 'Not over', 'Base tax', 'Rate'],
      rows: [
        ['₱0', '₱250,000', '₱0', '0%'],
        ['₱250,000', '₱400,000', '₱0', '15%'],
        ['₱400,000', '₱800,000', '₱22,500', '20%'],
        ['₱800,000', '₱2,000,000', '₱102,500', '25%'],
        ['₱2,000,000', '₱8,000,000', '₱402,500', '30%'],
        ['₱8,000,000', 'No limit', '₱2,202,500', '35%'],
      ],
    })
  })

  it('withholding tables (WH:WS-01, W-INF-3) render one table per pay period, base to the centavo', () => {
    const v = describeValue(wcomp.tables.value, 'tables')
    expect(v.kind).toBe('fields')
    expect(v.fields.map(f => f.label)).toEqual(['Daily', 'Weekly', 'Semi-monthly', 'Monthly'])
    expect(v.fields[3].value).toEqual({
      kind: 'table',
      columns: ['Over', 'Base tax', 'Rate'],
      rows: [
        ['₱0', '₱0.00', '0%'],
        ['₱20,833', '₱0.00', '15%'],
        ['₱33,333', '₱1,875.00', '20%'],
        ['₱66,667', '₱8,541.80', '25%'],
        ['₱166,667', '₱33,541.80', '30%'],
        ['₱666,667', '₱183,541.80', '35%'],
      ],
    })
    expect(v.fields[0].value.rows[2]).toEqual(['₱1,096', '₱61.65', '20%'])
  })

  it('scalars: rates as percentages, amounts in pesos, dates in words', () => {
    expect(describeValue(businessTax.vatRate.value, 'vatRate')).toEqual({ kind: 'text', text: '12%' })
    expect(describeValue(businessTax.vatThreshold.value, 'vatThreshold')).toEqual({ kind: 'text', text: '₱3,000,000' })
    expect(describeValue(businessTax.invoiceIssuanceThreshold.value, 'invoiceIssuanceThreshold')).toEqual({ kind: 'text', text: '₱500' })
    expect(describeValue(incomeTax.thirteenthMonthExclusionCap.value, 'thirteenthMonthExclusionCap')).toEqual({ kind: 'text', text: '₱90,000' })
    const sur = describeValue(penalties.surcharge.value, 'surcharge')
    expect(sur.fields.map(f => [f.label, f.value.text])).toEqual([
      ['Standard', '25%'], ['Willful neglect', '50%'], ['Micro small', '10%'], ['Micro small from', 'Jan 22, 2024'],
    ])
    const fbt = describeValue(ewtRates.fringeBenefitsTax.value, 'fringeBenefitsTax')
    expect(fbt.fields.map(f => [f.label, f.value.text])).toEqual([
      ['Rate', '35%'], ['Gross up divisor', '0.65'], ['Form', '1603Q'], ['Deadline', 'last day of the month following each calendar quarter'],
    ])
    const dc = describeValue(penalties.interestDayCount.value, 'interestDayCount')
    expect(dc.fields.map(f => [f.label, f.value.text])).toEqual([
      ['Days in year', '365'], ['Starts after', 'Rolled due date'], ['Convention', 'simple interest, actual days / 365'],
    ])
  })

  it('SSS: rates, MSC amounts and the EC table (null = no limit)', () => {
    const v = describeValue(contributions.sss.value, 'sss')
    const f = Object.fromEntries(v.fields.map(x => [x.label, x.value]))
    expect(f['Total rate']).toEqual({ kind: 'text', text: '15%' })
    expect(f['MSC floor']).toEqual({ kind: 'text', text: '₱5,000' })
    expect(f['MSC step']).toEqual({ kind: 'text', text: '₱500' })
    expect(f['EC premium (employer)']).toEqual({ kind: 'table', columns: ['MSC below', 'Amount'], rows: [['₱15,000', '₱10'], ['No limit', '₱30']] })
  })

  it('compromise schedule and a list of plain items', () => {
    const c = describeValue(penalties.compromiseTiers.value, 'compromiseTiers')
    expect(c.columns).toEqual(['Tax due up to', 'Amount'])
    expect(c.rows[0]).toEqual(['₱5,000', '₱1,000'])
    expect(c.rows[8]).toEqual(['No limit', '₱50,000'])
    const mwe = describeValue(wcomp.mweExempt.value, 'mweExempt')
    expect(mwe.fields[0]).toEqual({ label: 'Exempt items', value: { kind: 'list', items: ['statutory minimum wage', 'holiday pay', 'overtime pay', 'night-shift differential', 'hazard pay'] } })
    expect(mwe.fields[1]).toEqual({ label: 'Pay factors', value: { kind: 'text', text: '365, 313, 261' } })
  })

  it('labels', () => {
    expect(labelize('graduatedBrackets')).toBe('Graduated brackets')
    expect(labelize('eightPercent')).toBe('Eight percent')
  })
})

describe('H07 schedules in words', () => {
  const ob = id => obligations.obligations.find(o => o.id === id).schedule
  it.each([
    ['bir-1701q', 'Each year by May 15 (Q1), August 15 (Q2) and November 15 (Q3)'],
    ['bir-1701a-annual', 'Each year by April 15'],
    ['lgu-cedula', 'Each year by the last day of February'],
    ['bir-1702q', '60 days after the end of each of the first three quarters of the taxable year'],
    ['bir-2551q', '25 days after the end of each quarter of the taxable year'],
    ['bir-2307-issue', '20 days after the end of each calendar quarter'],
    ['bir-1601eq', 'Last day of the month after each calendar quarter'],
    ['bir-1601c', '10th of the following month (for December: January 15)'],
    ['bir-0619e', '10th of the following month, for the first two months of each quarter'],
    ['sss-employer', 'Last day of the following month'],
    ['bir-1702-annual', '15th day of the 4th month after the taxable year ends (April 15 for calendar-year taxpayers)'],
    ['bir-cas-books', '30 days after the taxable year ends (January 30 for calendar-year taxpayers)'],
    ['sec-afs-fiscal', '120 days after the taxable year ends (April 30 for calendar-year taxpayers; April 29 when the next year is a leap year)'],
    ['bir-einvoicing', 'One time: December 31, 2026; never moved later'],
    ['dole-13th-month', 'Each year by December 24; never moved later'],
    ['bir-invoices', 'Ongoing: no fixed date'],
    ['bir-fbt-note', 'For information: no date'],
  ])('%s', (id, text) => {
    expect(describeSchedule(ob(id))).toBe(text)
  })
})
