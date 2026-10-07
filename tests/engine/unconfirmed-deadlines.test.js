// H07 (owner decision 8): rules the rulebook marks "needs_review" are shown with
// an "Unconfirmed: check with the agency" badge. Every generated deadline and
// checklist item carries its rule's confidence; a date moved past a weekend or
// holiday counts as unconfirmed when the holiday list of that year, or the
// agency's weekend rule, is itself marked needs_review.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import { HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import {
  generateDeadlines, generateChecklist, isUnconfirmed, confidenceReasons, holidayYearConfidence,
  UNCONFIRMED_RULE, unconfirmedHolidaysReason, unconfirmedRollOverReason,
} from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO, iso, addDays } from '../../src/engine/dates.js'

const OB = obligationsData.obligations
const TODAY = fromISO('2026-10-07')

function gen(profile, fromS, toS) {
  return generateDeadlines(OB, profile, {
    from: fromISO(fromS), to: fromISO(toS), holidays: HOLIDAY_SET, refDate: fromISO(fromS),
  })
}
const pick = (list, id, rawISO) => list.find(d => d.obligation.id === id && iso(d.rawDate) === rawISO)
const summary = d => ({ raw: iso(d.rawDate), due: iso(d.date), confidence: d.confidence, reasons: d.confidenceReasons })

const freelancer = { ...defaultProfile('individual'), name: 'Paolo Freelancer' }
const casPosEmployer = {
  ...defaultProfile('individual'), name: 'Shop', booksType: 'cas', usesCrmPos: true,
  hasEmployees: true, withholdsEwt: true, withholdsFwt: true, licensedProfessional: true,
}
const corp = { ...defaultProfile('corporation'), name: 'Corp Inc', hasEmployees: true }
const employee = { ...defaultProfile('employee'), name: 'Emil' }
const PROFILES = [freelancer, casPosEmployer, corp, employee]

describe('H07 the reason texts', () => {
  it('are plain-language sentences', () => {
    expect(UNCONFIRMED_RULE).toBe('This rule is not yet confirmed from an official source.')
    expect(unconfirmedHolidaysReason(2028)).toBe('The 2028 holiday list is not confirmed, and this date was moved past a weekend or holiday.')
    expect(unconfirmedRollOverReason('Pag-IBIG')).toBe('The Pag-IBIG rule for deadlines that fall on a weekend or holiday is not confirmed.')
  })
})

describe('H07 every needs_review obligation yields items flagged unconfirmed', () => {
  const review = OB.filter(o => o.confidence === 'needs_review')

  it('the rulebook has needs_review obligations to check', () => {
    expect(review.map(o => o.id)).toEqual([
      'bir-einvoicing', 'philhealth-self', 'pagibig-self', 'lgu-cedula', 'sec-afs-calendar',
      'bir-micro-abatement-2026', 'bir-crm-pos', 'bir-fbt-note',
    ])
  })

  for (const ob of OB.filter(o => o.confidence === 'needs_review')) {
    it(`${ob.id}`, () => {
      const dated = ob.schedule.kind !== 'ongoing' && ob.schedule.kind !== 'info'
      let found = 0
      for (const p of PROFILES) {
        if (dated) {
          const items = gen(p, '2026-01-01', '2027-12-31').filter(d => d.obligation.id === ob.id)
          for (const d of items) {
            expect(d.confidence, `${ob.id} ${iso(d.date)}`).toBe('needs_review')
            expect(isUnconfirmed(d)).toBe(true)
            expect(d.confidenceReasons[0]).toBe(UNCONFIRMED_RULE)
            expect(confidenceReasons(d)).toEqual(d.confidenceReasons)
          }
          found += items.length
        } else {
          const items = generateChecklist(OB, p, { today: TODAY }).filter(o => o.id === ob.id)
          for (const o of items) {
            expect(isUnconfirmed(o)).toBe(true)
            expect(confidenceReasons(o)).toEqual([UNCONFIRMED_RULE])
          }
          found += items.length
        }
      }
      expect(found, `${ob.id} appears for at least one test profile`).toBeGreaterThan(0)
    })
  }

  it('verified checklist items are not flagged', () => {
    const items = generateChecklist(OB, freelancer, { today: TODAY })
    const invoices = items.find(o => o.id === 'bir-invoices')
    expect(isUnconfirmed(invoices)).toBe(false)
    expect(confidenceReasons(invoices)).toEqual([])
  })

  it('a rule with no confidence field counts as unconfirmed (conservative)', () => {
    expect(isUnconfirmed({ id: 'x' })).toBe(true)
    expect(confidenceReasons({ id: 'x' })).toEqual([UNCONFIRMED_RULE])
  })

  it('default freelancer calendar (Oct 7, 2026 + 400 days): every PhilHealth and Pag-IBIG self-employed date is flagged, 1701Q is not', () => {
    const list = generateDeadlines(OB, freelancer, { from: TODAY, to: addDays(TODAY, 400), holidays: HOLIDAY_SET, refDate: TODAY })
    const flagged = list.filter(isUnconfirmed).map(d => d.obligation.id)
    const counts = flagged.reduce((m, id) => ({ ...m, [id]: (m[id] || 0) + 1 }), {})
    expect(counts).toEqual({ 'philhealth-self': 13, 'pagibig-self': 14, 'lgu-cedula': 1 })
    expect(list.filter(d => d.obligation.id === 'bir-1701q').every(d => d.confidence === 'verified')).toBe(true)
  })
})

describe('H07 dates moved past a weekend or holiday', () => {
  it('holiday list confidence by year: 2026 and 2027 verified, other years needs_review', () => {
    expect(holidayYearConfidence(2026)).toBe('verified')
    expect(holidayYearConfidence(2027)).toBe('verified')
    expect(holidayYearConfidence(2028)).toBe('needs_review')
    expect(holidayYearConfidence(2025)).toBe('needs_review')
    expect(holidaysData.confidence).toBe('needs_review')
  })

  it('1701Q Q3 2026: Sun Nov 15 -> Mon Nov 16, 2026 (verified 2026 list): verified', () => {
    const d = pick(gen(freelancer, '2026-11-01', '2026-11-30'), 'bir-1701q', '2026-11-15')
    expect(summary(d)).toEqual({ raw: '2026-11-15', due: '2026-11-16', confidence: 'verified', reasons: [] })
  })

  it('DL:WS-10 1601-EQ Q3 2027: Sun Oct 31 -> Wed Nov 3, 2027 (verified 2027 list): verified', () => {
    const d = pick(gen(casPosEmployer, '2027-10-01', '2027-11-30'), 'bir-1601eq', '2027-10-31')
    expect(summary(d)).toEqual({ raw: '2027-10-31', due: '2027-11-03', confidence: 'verified', reasons: [] })
  })

  it('DL:WS-14 1601-EQ Q1 2028: Sun Apr 30 -> Tue May 2, 2028 (no 2028 list): unconfirmed', () => {
    const d = pick(gen(casPosEmployer, '2028-04-01', '2028-05-31'), 'bir-1601eq', '2028-04-30')
    expect(summary(d)).toEqual({ raw: '2028-04-30', due: '2028-05-02', confidence: 'needs_review', reasons: [unconfirmedHolidaysReason(2028)] })
  })

  it('1601-C for May 2028: Sat Jun 10 -> Tue Jun 13, 2028 (Independence Day Monday): unconfirmed', () => {
    const d = pick(gen(casPosEmployer, '2028-06-01', '2028-06-30'), 'bir-1601c', '2028-06-10')
    expect(summary(d)).toEqual({ raw: '2028-06-10', due: '2028-06-13', confidence: 'needs_review', reasons: [unconfirmedHolidaysReason(2028)] })
  })

  it('1701Q Q1 2028 on Mon May 15, 2028 is not moved: stays verified', () => {
    const d = pick(gen(freelancer, '2028-05-01', '2028-05-31'), 'bir-1701q', '2028-05-15')
    expect(summary(d)).toEqual({ raw: '2028-05-15', due: '2028-05-15', confidence: 'verified', reasons: [] })
  })

  it('Pag-IBIG employer remittance for Sep 2026: Sat Oct 10 -> Mon Oct 12, 2026 under the needs_review Pag-IBIG roll-over rule: unconfirmed', () => {
    expect(holidaysData.rollOverByAgency['Pag-IBIG'].confidence).toBe('needs_review')
    const d = pick(gen(casPosEmployer, '2026-10-01', '2026-10-31'), 'pagibig-employer', '2026-10-10')
    expect(summary(d)).toEqual({ raw: '2026-10-10', due: '2026-10-12', confidence: 'needs_review', reasons: [unconfirmedRollOverReason('Pag-IBIG')] })
  })

  it('Pag-IBIG employer remittance for Oct 2026 on Tue Nov 10, 2026 is not moved: verified', () => {
    const d = pick(gen(casPosEmployer, '2026-11-01', '2026-11-30'), 'pagibig-employer', '2026-11-10')
    expect(summary(d)).toEqual({ raw: '2026-11-10', due: '2026-11-10', confidence: 'verified', reasons: [] })
  })

  it('Pag-IBIG self-employed for Sep 2026 (needs_review rule, moved): both reasons', () => {
    const d = pick(gen(freelancer, '2026-10-01', '2026-10-31'), 'pagibig-self', '2026-10-10')
    expect(summary(d)).toEqual({
      raw: '2026-10-10', due: '2026-10-12', confidence: 'needs_review',
      reasons: [UNCONFIRMED_RULE, unconfirmedRollOverReason('Pag-IBIG')],
    })
  })

  it('PTR due Sun Jan 31, 2027 stays on the legal date under the needs_review LGU rule: unconfirmed', () => {
    const d = pick(gen(casPosEmployer, '2027-01-01', '2027-02-28'), 'lgu-ptr', '2027-01-31')
    expect(summary(d)).toEqual({ raw: '2027-01-31', due: '2027-01-31', confidence: 'needs_review', reasons: [unconfirmedRollOverReason('LGU')] })
  })

  it('Business permit due Wed Jan 20, 2027 (a working day): verified', () => {
    const d = pick(gen(casPosEmployer, '2027-01-01', '2027-02-28'), 'lgu-business-permit', '2027-01-20')
    expect(summary(d)).toEqual({ raw: '2027-01-20', due: '2027-01-20', confidence: 'verified', reasons: [] })
  })

  it('SEC AFS (calendar year) due Sat May 29, 2027: rule and SEC weekend rule both unconfirmed', () => {
    const d = pick(gen(corp, '2027-05-01', '2027-05-31'), 'sec-afs-calendar', '2027-05-29')
    expect(summary(d)).toEqual({
      raw: '2027-05-29', due: '2027-05-29', confidence: 'needs_review',
      reasons: [UNCONFIRMED_RULE, unconfirmedRollOverReason('SEC')],
    })
  })

  it('13th-month pay due Thu Dec 24, 2026 (a holiday; never moved later): verified', () => {
    const d = pick(gen(corp, '2026-12-01', '2026-12-31'), 'dole-13th-month', '2026-12-24')
    expect(summary(d)).toEqual({ raw: '2026-12-24', due: '2026-12-24', confidence: 'verified', reasons: [] })
  })

  it('an extended date (RMC 30-2026) keeps the rule confidence: verified', () => {
    const d = pick(gen(freelancer, '2026-05-01', '2026-05-31'), 'bir-1701a-annual', '2026-04-15')
    expect(summary(d)).toEqual({ raw: '2026-04-15', due: '2026-05-15', confidence: 'verified', reasons: [] })
  })
})
