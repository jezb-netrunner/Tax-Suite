// November 2026 audit (AUDIT-2026-11.md): rules issued or confirmed after the
// October 7, 2026 review, and the clarity fixes made with them.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import businessTax from '../../src/data/rules/business-tax.json'
import attachments from '../../src/data/rules/attachments.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines, generateChecklist, regionalHolidayOn } from '../../src/engine/deadlines.js'
import { ruleRegister } from '../../src/engine/rulebook.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const ob = id => OB.find(o => o.id === id)
const gen = (p, from, to) => generateDeadlines(OB, p, { from: fromISO(from), to: fromISO(to), holidays: HOLIDAY_SET, refDate: fromISO(from) })
const dates = (list, id) => list.filter(d => d.obligation.id === id).map(d => iso(d.date))

describe('RR 6-2026 / RMC 112-2026: creditable withholding tax on invoices', () => {
  it('the invoice item says VAT-registered sellers invoice every sale and names the new withholding line', () => {
    const inv = ob('bir-invoices')
    expect(inv.title).toBe('Issue BIR-registered invoices for your sales')
    expect(inv.desc).toContain('VAT-registered sellers issue a VAT invoice for every sale, whatever the amount')
    expect(inv.desc).toContain('creditable withholding tax as a separate line')
    expect(inv.notes).toContain('end-of-day invoice')
    expect(inv.notes).toContain('until Dec 31, 2026 for systems covered by mandatory e-invoicing')
    expect(inv.notes).toContain('until Mar 31, 2027 for cash registers, POS')
    expect(inv.legalBasis.join(' ')).toMatch(/RR 6-2026.*effective Oct 16, 2026/)
    expect(inv.legalBasis.join(' ')).toContain('RMC 112-2026')
    expect(businessTax.invoiceIssuanceThreshold.notes).toContain('RR 6-2026')
  })
  it('computerized-books users get a Dec 31, 2026 item; CRM/POS users a Mar 31, 2027 item', () => {
    const cas = { ...defaultProfile('individual'), name: 'C', booksType: 'cas' }
    const pos = { ...defaultProfile('individual'), name: 'P', usesCrmPos: true }
    const plain = { ...defaultProfile('individual'), name: 'M' }
    expect(dates(gen(cas, '2026-11-08', '2027-12-31'), 'bir-cwt-invoice-field-cas')).toEqual(['2026-12-31'])
    expect(dates(gen(pos, '2026-11-08', '2027-12-31'), 'bir-cwt-invoice-field-pos')).toEqual(['2027-03-31'])
    const none = gen(plain, '2026-11-08', '2027-12-31')
    expect(dates(none, 'bir-cwt-invoice-field-cas')).toEqual([])
    expect(dates(none, 'bir-cwt-invoice-field-pos')).toEqual([])
    // Dec 31, 2026 is a special non-working day: the date never moves later.
    const d = gen(cas, '2026-11-08', '2027-01-31').find(x => x.obligation.id === 'bir-cwt-invoice-field-cas')
    expect(d.rollOver).toBe('never_later')
    expect(iso(d.lastWorkingDayBefore)).toBe('2026-12-29')
  })
})

describe('Proclamation No. 1447 s.2026: NCR-only holidays, Nov 16 to 18, 2026', () => {
  it('are recorded as regional, not national, holidays', () => {
    expect(holidaysData.regionalHolidays.value.map(h => [h.date, h.region])).toEqual([
      ['2026-11-16', 'NCR'], ['2026-11-17', 'NCR'], ['2026-11-18', 'NCR'],
    ])
    expect(HOLIDAY_SET.has('2026-11-16')).toBe(false)
    expect(holidaysData.regionalHolidays.legalBasis[0]).toContain('Proclamation No. 1447 s.2026')
  })
  it('the Q3 1701Q stays on Mon Nov 16, 2026 (national date) and carries the regional note', () => {
    const p = { ...defaultProfile('individual'), name: 'F', regime: '8pct' }
    const q3 = gen(p, '2026-11-01', '2026-11-30').find(d => d.obligation.id === 'bir-1701q')
    expect(iso(q3.date)).toBe('2026-11-16')
    expect(q3.regionalHoliday).toMatchObject({ region: 'NCR', date: '2026-11-16' })
    expect(regionalHolidayOn('2026-11-19')).toBe(null)
    const other = gen(p, '2026-12-01', '2026-12-31')
    expect(other.every(d => d.regionalHoliday === null)).toBe(true)
  })
  it('the References register lists them with their source', () => {
    const e = ruleRegister().holidays.find(x => x.kind === 'regional')
    expect(e.value.rows).toHaveLength(3)
    expect(e.confidence).toBe('verified')
    expect(e.notes).toContain('the calendar keeps the national due date')
  })
})

describe('SEC, Pag-IBIG, abatement, closure and freelancer items', () => {
  it('SEC MC 16-2026 penalty suspension is noted on the AFS and GIS items', () => {
    for (const id of ['sec-afs-calendar', 'sec-afs-fiscal', 'sec-gis']) {
      expect(ob(id).notes).toContain('SEC MC 16-2026 suspends the monthly late-filing penalties')
    }
  })
  it('Pag-IBIG employer dates are flagged unconfirmed after HDMF Circular 499-2026', () => {
    const pi = ob('pagibig-employer')
    expect(pi.confidence).toBe('needs_review')
    expect(pi.legalBasis.join(' ')).toContain('HDMF Circular 499-2026')
  })
  it('the micro-taxpayer abatement fee is ₱5,000 per taxable year (RR 4-2026, RMC 84-2026)', () => {
    expect(ob('bir-micro-abatement-2026').desc).toContain('₱5,000 per taxable year')
  })
  it('Form 1905 closure follows RMC 47-2026, with no unverified day count', () => {
    expect(ob('bir-1905-updates').notes).toContain('RMC 47-2026')
  })
  it('freelancers receiving 2307s are reminded of the sworn declaration (January 15, confirmed Nov 12, 2026)', () => {
    const f = { ...defaultProfile('individual'), name: 'F', receives2307: true }
    const vat = { ...f, vatRegistered: true }
    const ids = p => generateChecklist(OB, p, { today: fromISO('2026-11-08') }).map(o => o.id)
    expect(ids(f)).toContain('bir-payee-sworn-declaration')
    expect(ids(vat)).not.toContain('bir-payee-sworn-declaration')
    expect(ids({ ...f, receives2307: false })).not.toContain('bir-payee-sworn-declaration')
    expect(ob('bir-payee-sworn-declaration').confidence).toBe('verified')
    expect(ob('bir-payee-sworn-declaration').notes).toContain('on or before January 15 of each year')
  })
  it('the eAFS file-size limit is not stated as a figure (sources disagree)', () => {
    expect(attachments.eafsSystem.value.fileFormat).not.toMatch(/\d+(\.\d+)?\s*(GB|MB)/)
  })
})

describe('corporate 20% rate with total assets left blank', () => {
  const base = { grossSales: 10000000, costOfSales: 6000000, opex: 2000000, taxYear: 2026, registrationYear: 2015 }
  it('says the 20% rate assumes assets of ₱100M or less when the box is blank', () => {
    const r = estimateCorporation({ ...base, totalAssets: null })
    expect(r.smallCorp).toBe(true)
    const row = r.rows.find(x => x.label.startsWith('Regular corporate income tax'))
    expect(row.sub).toContain('Total assets were left blank')
  })
  it('no such note when assets are entered', () => {
    const r = estimateCorporation({ ...base, totalAssets: 50000000 })
    const row = r.rows.find(x => x.label.startsWith('Regular corporate income tax'))
    expect(row.sub).not.toContain('left blank')
    expect(estimateCorporation({ ...base, totalAssets: 150000000 }).smallCorp).toBe(false)
  })
})

describe('engine findings from the November 2026 bug hunt', () => {
  it('E4: the SAWT filed with the April annual return is labelled with the taxable year just ended', () => {
    const p = { ...defaultProfile('individual'), name: 'F', receives2307: true }
    const list = gen(p, '2027-04-01', '2027-04-30')
    const sawt = list.find(d => d.obligation.id === 'bir-sawt-individual' && d.label === 'Annual')
    expect(sawt.period).toBe('TY 2026')
    const eq = gen({ ...p, withholdsEwt: true }, '2027-01-01', '2027-02-28').find(d => d.obligation.id === 'bir-1601eq')
    expect(eq.period).toBe('Q4 2026')
  })
  it('E6: a recorded extension of the annual return moves the corporate due date and default year', async () => {
    const { corporateTaxYears } = await import('../../src/engine/estimators/corporation.js')
    const y = corporateTaxYears({ today: fromISO('2026-04-20') })
    expect(y.options.find(o => o.year === 2025).dueDate).toBe('2026-05-15')
    expect(y.defaultYear).toBe(2025)
    expect(corporateTaxYears({ today: fromISO('2026-05-16') }).defaultYear).toBe(2026)
  })
  it('E7: a 1702Q with no registration year says the MCIT figure applies only if MCIT does', async () => {
    const { estimateCorporateQuarter } = await import('../../src/engine/estimators/corporation.js')
    const q = estimateCorporateQuarter({ quarter: 1, taxYear: 2026, grossSales: 1000000, opex: 999000 })
    expect(q.rows.find(x => x.label.startsWith('Income tax due to date')).label).toBe('Income tax due to date, if MCIT applies')
    expect(q.rows.find(x => x.label.startsWith('Income tax payable')).sub).toBe('If MCIT does not apply yet: ₱200 payable.')
  })
  it('E10: the individual estimator starts on the year whose annual return is due next', async () => {
    const { individualTaxYears } = await import('../../src/engine/estimators/individual.js')
    expect(individualTaxYears({ today: fromISO('2027-02-01') }).defaultYear).toBe(2026)
    expect(individualTaxYears({ today: fromISO('2027-04-15') }).defaultYear).toBe(2026)
    expect(individualTaxYears({ today: fromISO('2027-04-16') }).defaultYear).toBe(2027)
    // TY2025 was extended to May 15, 2026 (RMC 30-2026).
    expect(individualTaxYears({ today: fromISO('2026-05-10') }).defaultYear).toBe(2025)
    expect(individualTaxYears({ today: fromISO('2026-11-08') }).options.map(o => [o.year, o.dueDate])).toEqual([[2026, '2027-04-15'], [2025, '2026-05-15']])
  })
})
