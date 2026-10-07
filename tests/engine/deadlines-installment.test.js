// H02: the October 15 second installment of annual income tax.
// NIRC Sec 56(A)(2), as amended by RA 10963: an individual whose income tax due
// on the annual return is over ₱2,000 may pay half when filing and the other
// half on or before October 15 of the same year. Worksheet DL:WS-15.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import incomeTax from '../../src/data/rules/income-tax.json'
import holidaysData from '../../src/data/rules/holidays.json'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const HOLIDAYS = new Set(holidaysData.holidays.map(h => h.date))
const ID = 'bir-annual-itr-2nd-installment'

function gen(profile, fromS, toS) {
  return generateDeadlines(OB, profile, {
    from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAYS, refDate: fromISO(fromS),
  })
}
const installments = list => list.filter(d => d.obligation.id === ID)

describe('H02 second installment of annual income tax (DL:WS-15)', () => {
  it('8% freelancer (1701A): Thu Oct 15, 2026 for TY 2025, viewed on Oct 7, 2026', () => {
    const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct' }
    const got = installments(gen(p, '2026-10-07', '2026-11-21'))
    expect(got.map(d => [iso(d.date), d.period, d.shifted, d.daysAway])).toEqual([
      ['2026-10-15', 'TY 2025', false, 8],
    ])
  })

  it('the obligation reads as optional and cites Sec 56(A)(2) as amended by RA 10963', () => {
    const ob = OB.find(o => o.id === ID)
    expect(ob.title).toBe('Pay the 2nd installment of annual income tax (only if you paid half with your return)')
    expect(ob.agency).toBe('BIR')
    expect(ob.legalBasis[0]).toBe('NIRC Sec 56(A)(2), as amended by RA 10963 (TRAIN)')
    expect(ob.schedule).toEqual({ kind: 'annual_fixed', month: 10, day: 15 })
    expect(ob.ruleRef).toBe('income-tax.annualITRInstallment')
  })

  it('uses the October 15 date and the ₱2,000 floor of the rulebook rule annualITRInstallment', () => {
    const rule = incomeTax.annualITRInstallment
    expect(rule.value.secondInstallmentDue).toBe('October 15')
    expect(rule.notes).toContain('exceeds ₱2,000')
    const ob = OB.find(o => o.id === ID)
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    expect(`${months[ob.schedule.month - 1]} ${ob.schedule.day}`).toBe(rule.value.secondInstallmentDue)
    expect(ob.desc).toContain('over ₱2,000')
  })

  it('applies to 1701 filers (mixed income, itemized) and 1700 filers (two employers)', () => {
    const mixed = { ...defaultProfile('mixed'), name: 'M', regime: 'graduated_osd' }
    const itemized = { ...defaultProfile('individual'), name: 'I', regime: 'graduated_itemized' }
    const twoEmployers = { ...defaultProfile('employee'), name: 'E', multipleEmployers: true }
    for (const p of [mixed, itemized, twoEmployers]) {
      expect(installments(gen(p, '2026-01-01', '2027-12-31')).map(d => iso(d.date)), p.name)
        .toEqual(['2026-10-15', '2027-10-15'])
    }
  })

  it('not for employees under substituted filing or for corporations', () => {
    const sub = { ...defaultProfile('employee'), name: 'E' }
    const corp = { ...defaultProfile('corporation'), name: 'C' }
    expect(installments(gen(sub, '2026-01-01', '2027-12-31'))).toEqual([])
    expect(installments(gen(corp, '2026-01-01', '2027-12-31'))).toEqual([])
  })

  it('Oct 15, 2028 falls on a Sunday and moves to Mon Oct 16 (BIR next-working-day rule)', () => {
    const p = { ...defaultProfile('individual'), name: 'T', regime: '8pct' }
    const got = installments(gen(p, '2028-10-01', '2028-10-31'))
    expect(got.map(d => [iso(d.rawDate), iso(d.date), d.period])).toEqual([['2028-10-15', '2028-10-16', 'TY 2027']])
  })
})
