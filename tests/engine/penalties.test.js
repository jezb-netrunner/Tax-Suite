import { describe, it, expect } from 'vitest'
import { estimatePenalty, compromiseFor, rollDueDate } from '../../src/engine/estimators/penalties.js'

// REVIEW.md section 3.2 worksheets, expressed as due date + payment date
// (Asia/Manila calendar dates). Apr 15, 2026 is a Wednesday and not a holiday,
// so "N days late" cases use it as the due date and pay N days later.
//
// Interest runs from the day after the (rolled-over) due date through the
// payment date, at actual days / 365, rounded half-up to the centavo.
// The compromise is the full RMO 7-2015 Annex A amount for every taxpayer size:
// RR 6-2024 halves it only for invoicing violations (Secs 113, 237, 238), not
// for late filing or payment (Sec 255).
const pen = (taxDue, dueDate, paymentDate, microSmall = false, extra = {}) =>
  estimatePenalty({ taxDue, dueDate, paymentDate, microSmall, ...extra })

describe('late-filing penalty, 2026 violations', () => {
  it('TB:W08 ₱50,000 due Apr 15, 2026, paid Jun 14 (60 days), medium/large: total 73,486.30', () => {
    const r = pen(50000, '2026-04-15', '2026-06-14')
    expect(r.late).toBe(true)
    expect(r.daysLate).toBe(60)
    expect(r.surRate).toBe(0.25)
    expect(r.surcharge).toBe(12500)
    expect(r.interest).toBe(986.3)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBe(73486.3)
  })
  it('TB:W09 / INF:W-INF-6 same dates, micro/small: 10% and 6%, full compromise 10,000, total 65,493.15', () => {
    const r = pen(50000, '2026-04-15', '2026-06-14', true)
    expect(r.reducedRates).toBe(true)
    expect(r.surRate).toBe(0.1)
    expect(r.surcharge).toBe(5000)
    expect(r.interest).toBe(493.15)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBe(65493.15)
  })
  it('TB:W01 ₱10,000 paid May 15, 2026 (30 days), medium/large: total 15,598.63', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15')
    expect(r.daysLate).toBe(30)
    expect(r.surcharge).toBe(2500)
    expect(r.interest).toBe(98.63)
    expect(r.compromise).toBe(3000)
    expect(r.total).toBe(15598.63)
  })
  it('TB:W02 ₱10,000, 30 days, micro/small: compromise 3,000, total 14,049.32', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15', true)
    expect(r.surcharge).toBe(1000)
    expect(r.interest).toBe(49.32)
    expect(r.compromise).toBe(3000)
    expect(r.total).toBe(14049.32)
  })
  it('TB:W04 ₱0 tax due filed 30 days late, medium/large: compromise 1,000', () => {
    const r = pen(0, '2026-04-15', '2026-05-15')
    expect(r.surcharge).toBe(0)
    expect(r.interest).toBe(0)
    expect(r.compromise).toBe(1000)
    expect(r.total).toBe(1000)
  })
  it('TB:W05 ₱0 tax due filed 30 days late, micro/small: compromise 1,000 (not halved)', () => {
    const r = pen(0, '2026-04-15', '2026-05-15', true)
    expect(r.surcharge).toBe(0)
    expect(r.interest).toBe(0)
    expect(r.compromise).toBe(1000)
    expect(r.total).toBe(1000)
  })
  it('TB:W12 ₱33,333 paid May 2, 2026 (17 days), medium/large: total 51,852.55', () => {
    const r = pen(33333, '2026-04-15', '2026-05-02')
    expect(r.daysLate).toBe(17)
    expect(r.surcharge).toBe(8333.25)
    expect(r.interest).toBe(186.3)
    expect(r.compromise).toBe(10000)
    expect(r.total).toBe(51852.55)
  })
  it('TB:W13 ₱5,000,001 due Apr 15, 2025, paid Apr 15, 2026 (365 days): total 6,900,001.37', () => {
    const r = pen(5000001, '2025-04-15', '2026-04-15')
    expect(r.daysLate).toBe(365)
    expect(r.surcharge).toBe(1250000.25)
    expect(r.interest).toBe(600000.12)
    expect(r.compromise).toBe(50000)
    expect(r.total).toBe(6900001.37)
  })
  it('willful neglect surcharge is 50%', () => {
    const r = pen(100000, '2026-04-15', '2026-05-15', false, { willful: true })
    expect(r.surcharge).toBe(50000)
  })
})

// TB:W03: willful neglect or a false/fraudulent return (Sec 248(B)): 50%
// surcharge, never reduced for micro & small. Interest follows the usual rates.
// The RMO 7-2015 compromise schedule covers only violations not involving
// fraud, so no compromise is added; the schedule amount is reported separately.
describe('willful neglect / false or fraudulent return (L04)', () => {
  it('TB:W03 ₱10,000, 30 days, micro: 50% surcharge 5,000, interest 49.32, compromise not on the schedule', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15', true, { willful: true })
    expect(r.willful).toBe(true)
    expect(r.surRate).toBe(0.5)
    expect(r.surcharge).toBe(5000)
    expect(r.interest).toBe(49.32)
    expect(r.compromiseOnSchedule).toBe(false)
    expect(r.compromise).toBe(null)
    expect(r.total).toBe(15049.32)
    // If no fraud is involved and the schedule is applied anyway: tier 5,001-10,000.
    expect(r.scheduleCompromise).toBe(3000)
    expect(r.totalWithScheduleCompromise).toBe(18049.32)
  })
  it('medium/large: same 50% surcharge and 12% interest', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15', false, { willful: true })
    expect(r.surcharge).toBe(5000)
    expect(r.interest).toBe(98.63)
    expect(r.total).toBe(15098.63)
    expect(r.totalWithScheduleCompromise).toBe(18098.63)
  })
  it('a normal late return stays on the schedule', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15', true)
    expect(r.willful).toBe(false)
    expect(r.compromiseOnSchedule).toBe(true)
    expect(r.compromise).toBe(3000)
    expect(r.scheduleCompromise).toBe(3000)
    expect(r.totalWithScheduleCompromise).toBe(14049.32)
  })
  it('paid on time: no surcharge even when marked willful', () => {
    const r = pen(10000, '2026-04-15', '2026-04-15', true, { willful: true })
    expect(r.late).toBe(false)
    expect(r.surcharge).toBe(0)
    expect(r.compromise).toBe(0)
    expect(r.total).toBe(10000)
  })
})

describe('not late: paid on or before the (rolled-over) due date', () => {
  it('BUG:W5 ₱50,000 paid on the due date, micro/small: no surcharge, interest or compromise; total 50,000', () => {
    const r = pen(50000, '2026-04-15', '2026-04-15', true)
    expect(r.late).toBe(false)
    expect(r.daysLate).toBe(0)
    expect(r.surcharge).toBe(0)
    expect(r.interest).toBe(0)
    expect(r.compromise).toBe(0)
    expect(r.total).toBe(50000)
    expect(r.interestPeriods).toEqual([])
  })
  it('paid before the due date is not late (medium/large)', () => {
    const r = pen(50000, '2026-04-15', '2026-04-10')
    expect(r.late).toBe(false)
    expect(r.daysLate).toBe(0)
    expect(r.total).toBe(50000)
  })
  it('paid on the Monday a Saturday due date moved to is not late', () => {
    const r = pen(10000, '2026-07-25', '2026-07-27', true)
    expect(r.late).toBe(false)
    expect(r.total).toBe(10000)
  })
  it('paid on the Sunday between a Saturday due date and the Monday is not late', () => {
    expect(pen(10000, '2026-07-25', '2026-07-26', true).late).toBe(false)
  })
})

describe('due date on a weekend or holiday moves to the next working day', () => {
  it('2551Q due Sat Jul 25, 2026 moves to Mon Jul 27; paid Aug 3 = 7 days, micro: interest 11.51, total 14,011.51', () => {
    const r = pen(10000, '2026-07-25', '2026-08-03', true)
    expect(r.dueDate).toBe('2026-07-25')
    expect(r.rolledDueDate).toBe('2026-07-27')
    expect(r.dueDateMoved).toBe(true)
    expect(r.movedBecause).toBe('weekend')
    expect(r.daysLate).toBe(7)
    expect(r.interestPeriods).toEqual([
      { from: '2026-07-28', to: '2026-08-03', days: 7, rate: 0.06, interest: 11.51 },
    ])
    expect(r.surcharge).toBe(1000)
    expect(r.interest).toBe(11.51)
    expect(r.compromise).toBe(3000)
    expect(r.total).toBe(14011.51)
  })
  it('due Fri Aug 21, 2026 (Ninoy Aquino Day) moves past the weekend to Mon Aug 24; paid Sep 3 = 10 days', () => {
    const r = pen(10000, '2026-08-21', '2026-09-03', true)
    expect(r.rolledDueDate).toBe('2026-08-24')
    expect(r.movedBecause).toBe('holiday')
    expect(r.daysLate).toBe(10)
    expect(r.interest).toBe(16.44)
    expect(r.total).toBe(14016.44)
  })
  it('a working-day due date does not move', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15')
    expect(r.dueDateMoved).toBe(false)
    expect(r.movedBecause).toBe(null)
    expect(r.rolledDueDate).toBe('2026-04-15')
  })
  it('rollDueDate flags years with no holiday list (only weekends are skipped there)', () => {
    expect(rollDueDate('2026-07-25').holidayListMissing).toBe(false)
    expect(rollDueDate('2023-11-15').holidayListMissing).toBe(true)
    expect(rollDueDate('2017-04-15')).toEqual({
      dueDate: '2017-04-15', rolledDueDate: '2017-04-17', moved: true, reason: 'weekend', holidayListMissing: true,
    })
  })
})

describe('rates follow the due date (EOPT reduced rates from Jan 22, 2024)', () => {
  it('TB:W10 ₱20,000 1701Q due Nov 15, 2023, paid Jan 15, 2024, micro: regular 25% / 12%, total 30,401.10', () => {
    const r = pen(20000, '2023-11-15', '2024-01-15', true)
    expect(r.reducedRates).toBe(false)
    expect(r.daysLate).toBe(61)
    expect(r.surRate).toBe(0.25)
    expect(r.surcharge).toBe(5000)
    expect(r.interest).toBe(401.1)
    expect(r.compromise).toBe(5000)
    expect(r.total).toBe(30401.1)
  })
  it('TB:W11 ₱100,000 due Oct 25, 2023, paid Oct 25, 2024 (366 days over Feb 29), medium/large: total 152,032.88', () => {
    const r = pen(100000, '2023-10-25', '2024-10-25')
    expect(r.daysLate).toBe(366)
    expect(r.surcharge).toBe(25000)
    expect(r.interest).toBe(12032.88)
    expect(r.compromise).toBe(15000)
    expect(r.total).toBe(152032.88)
  })
  it('micro tax due before Jan 22, 2024 and paid after it keeps 25% / 12% for the whole period (default, needs review)', () => {
    const r = pen(10000, '2024-01-19', '2024-02-21', true)
    expect(r.reducedRates).toBe(false)
    expect(r.daysLate).toBe(33)
    expect(r.surcharge).toBe(2500)
    expect(r.interestPeriods).toEqual([
      { from: '2024-01-20', to: '2024-02-21', days: 33, rate: 0.12, interest: 108.49 },
    ])
    expect(r.total).toBe(15608.49)
  })
  it('a due date of Sat Jan 20, 2024 moves to Mon Jan 22, 2024, so the reduced rates apply', () => {
    const r = pen(10000, '2024-01-20', '2024-02-21', true)
    expect(r.rolledDueDate).toBe('2024-01-22')
    expect(r.reducedRates).toBe(true)
    expect(r.daysLate).toBe(30)
    expect(r.surcharge).toBe(1000)
    expect(r.interest).toBe(49.32)
    expect(r.total).toBe(14049.32)
  })
  it('medium/large never gets the reduced rates', () => {
    const r = pen(10000, '2026-04-15', '2026-05-15', false)
    expect(r.reducedRates).toBe(false)
    expect(r.surRate).toBe(0.25)
  })
})

describe('20% interest for days before Jan 1, 2018 (pre-TRAIN), 12% after', () => {
  it('₱100,000 annual ITR due Sat Apr 15, 2017 (moves to Apr 17), paid Apr 16, 2018: 258 days at 20% + 106 days at 12%', () => {
    const r = pen(100000, '2017-04-15', '2018-04-16')
    expect(r.rolledDueDate).toBe('2017-04-17')
    expect(r.daysLate).toBe(364)
    expect(r.interestPeriods).toEqual([
      { from: '2017-04-18', to: '2017-12-31', days: 258, rate: 0.2, interest: 14136.99 },
      { from: '2018-01-01', to: '2018-04-16', days: 106, rate: 0.12, interest: 3484.93 },
    ])
    expect(r.surcharge).toBe(25000)
    expect(r.interest).toBe(17621.92)
    expect(r.compromise).toBe(15000)
    expect(r.total).toBe(157621.92)
  })
  it('micro/small gets the same pre-2018 rates', () => {
    expect(pen(100000, '2017-04-15', '2018-04-16', true).total).toBe(157621.92)
  })
  it('a period wholly before 2018 is all at 20%: due Apr 15, 2016, paid Apr 18, 2017 (368 days)', () => {
    const r = pen(100000, '2016-04-15', '2017-04-18')
    expect(r.interestPeriods).toEqual([
      { from: '2016-04-16', to: '2017-04-18', days: 368, rate: 0.2, interest: 20164.38 },
    ])
    expect(r.total).toBe(160164.38)
  })
})

describe('inputs', () => {
  it('rejects impossible dates', () => {
    expect(() => pen(1000, '2026-02-30', '2026-03-10')).toThrow(RangeError)
    expect(() => pen(1000, '', '2026-03-10')).toThrow(RangeError)
    expect(() => pen(1000, '2026-03-10', 'tomorrow')).toThrow(RangeError)
  })
})

// TB:W06 / TB:W07: RMO 7-2015 Annex A tier edges. Each edge belongs to the
// lower tier (the brackets read "not over"). Same amounts for every size.
const TIER_EDGES = [
  [0, 1000], [1, 1000], [5000, 1000],
  [5001, 3000], [10000, 3000],
  [10001, 5000], [20000, 5000],
  [20001, 10000], [50000, 10000],
  [50001, 15000], [100000, 15000],
  [100001, 20000], [500000, 20000],
  [500001, 30000], [1000000, 30000],
  [1000001, 40000], [5000000, 40000],
  [5000001, 50000],
]

describe('compromise tiers (RMO 7-2015 Annex A, Sec 255)', () => {
  it.each(TIER_EDGES)('TB:W06 tax due %d -> %d', (taxDue, amount) => {
    expect(compromiseFor(taxDue)).toBe(amount)
  })
  it.each(TIER_EDGES)('TB:W07 micro/small, tax due %d -> %d (no 50% cut)', (taxDue, amount) => {
    expect(compromiseFor(taxDue, true)).toBe(amount)
    expect(pen(taxDue, '2026-04-15', '2026-05-15', true).compromise).toBe(amount)
  })
  it('a centavo above an edge moves to the next tier', () => {
    expect(compromiseFor(5000.01)).toBe(3000)
    expect(compromiseFor(4999.99)).toBe(1000)
  })
  it('very large amounts stay in the top tier', () => {
    expect(compromiseFor(10000000)).toBe(50000)
    expect(compromiseFor(999999999999.99)).toBe(50000)
  })
})
