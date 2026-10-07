// Late filing/payment penalty estimator: surcharge + interest + compromise,
// from the original due date and the payment date (Philippine calendar dates).
//
// Due date: a due date on a weekend or holiday moves to the next working day
// (the deadline engine's shiftToBusinessDay and holiday list). Paying on or
// before that day is not late: no surcharge, interest or compromise.
//
// Rates follow the (moved) due date, from the rulebook (penalties.json):
//   micro & small taxpayers, due on or after Jan 22, 2024 (EOPT): 10% surcharge, 6% interest
//   otherwise: 25% surcharge; interest 12% a year, 20% for days before Jan 1, 2018
//   willful neglect / fraud: 50% surcharge (never reduced)
// A micro or small taxpayer's tax that fell due before Jan 22, 2024 keeps the
// due-date rates for the whole period (default, rulebook eoptTransition).
//
// Interest counts each day from the day after the (moved) due date through the
// payment date, at actual days / 365 (default, rulebook interestDayCount).
//
// Compromise: the full RMO 7-2015 Annex A amount for every taxpayer size. Late
// filing or payment is a Sec 255 violation; RR 6-2024 halves the compromise
// only for invoicing violations (Secs 113, 237 and 238). The schedule does not
// cover fraud, so a willful neglect / fraud case gets no compromise amount
// (compromise null, compromiseOnSchedule false); the schedule amount is still
// reported as scheduleCompromise for a willful case that involves no fraud.
//
// Rounding: each line (surcharge, each interest period, compromise) is rounded
// half-up to the centavo, computed exactly in whole centavos (BigInt for
// amount × rate × days); the interest line is the sum of its periods and the
// total is the sum of the rounded lines.

import pen from '../../data/rules/penalties.json'
import { toCentavos, fromCentavos, mulRate, mulFrac, rate, sumCentavos } from '../../lib/money.js'
import { iso, addDays, daysBetween, isWeekend, shiftToBusinessDay } from '../dates.js'
import { HOLIDAY_SET } from '../../lib/deadlineData.js'

const SUR = pen.surcharge.value
const INT = pen.interest.value
const DAY_COUNT = pen.interestDayCount.value
const TIERS = pen.compromiseTiers.value

// RMO 7-2015 Annex A: each edge belongs to the lower tier ("not over").
// Compared in whole centavos, so ₱5,000.01 is in the ₱5,001-₱10,000 tier.
// The amount is the same for every taxpayer size (no micro/small reduction).
export function compromiseFor(taxDue) {
  const dueC = toCentavos(taxDue)
  const tier = TIERS.find(t => t.taxDueUpTo === null || dueC <= toCentavos(t.taxDueUpTo)) || TIERS[TIERS.length - 1]
  return tier.amount
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

// 'YYYY-MM-DD' -> local-midnight Date, or null for anything that is not a real
// calendar date (e.g. '2026-02-30').
export function parseISODate(s) {
  const m = ISO_DATE.exec(String(s ?? ''))
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return dt
}

function requireDate(s, what) {
  const d = parseISODate(s)
  if (!d) throw new RangeError(`Not a valid ${what}: ${s}`)
  return d
}

// Is there a proclaimed holiday list for `year`? The app's holiday calendar
// (makeHolidayCalendar) knows; for a plain Set of ISO dates, a year counts as
// listed when any of its dates is in the set.
function hasProclaimedList(holidays, year) {
  if (typeof holidays.isProclaimed === 'function') return holidays.isProclaimed(year)
  for (const h of holidays) if (String(h).slice(0, 4) === String(year)) return true
  return false
}

/**
 * Move a due date off a weekend or holiday to the next working day.
 * @returns { dueDate, rolledDueDate, moved, reason: 'weekend'|'holiday'|null,
 *            holidayListMissing } — holidayListMissing is true when the app has
 *            no proclaimed holiday list for a year involved, so only weekends
 *            and the holidays fixed by law were skipped.
 */
export function rollDueDate(dueDate, holidays = HOLIDAY_SET) {
  const due = requireDate(dueDate, 'due date')
  const rolled = shiftToBusinessDay(due, holidays)
  const moved = rolled.getTime() !== due.getTime()
  const holidayListMissing = [due.getFullYear(), rolled.getFullYear()].some(y => !hasProclaimedList(holidays, y))
  return {
    dueDate: iso(due),
    rolledDueDate: iso(rolled),
    moved,
    reason: moved ? (isWeekend(due) ? 'weekend' : 'holiday') : null,
    holidayListMissing,
  }
}

// Interest periods from `first` to `last` (both counted), split where the
// annual rate changes. Reduced (EOPT) rate: one period.
function interestSchedule(first, last, reduced) {
  if (reduced) return [{ from: first, to: last, rate: INT.microSmallAnnualRate }]
  const cut = requireDate(INT.standardFrom, 'rulebook date')
  const out = []
  if (first < cut) out.push({ from: first, to: last < cut ? last : addDays(cut, -1), rate: INT.priorAnnualRate })
  if (last >= cut) out.push({ from: first < cut ? cut : first, to: last, rate: INT.standardAnnualRate })
  return out
}

/**
 * @param {Object} in_ {
 *   taxDue        basic tax due, pesos
 *   dueDate       original due date, 'YYYY-MM-DD' (Philippine calendar date)
 *   paymentDate   date paid (or to be paid), 'YYYY-MM-DD'
 *   microSmall    EOPT micro or small taxpayer
 *   willful       willful neglect to file, or a false or fraudulent return (50% surcharge)
 *   holidays      Set of ISO holiday dates (default: the app's holiday list)
 * }
 */
export function estimatePenalty(in_) {
  const { taxDue = 0, dueDate, paymentDate, microSmall = false, willful = false, holidays = HOLIDAY_SET } = in_
  const roll = rollDueDate(dueDate, holidays)
  const rolled = requireDate(roll.rolledDueDate, 'due date')
  const paid = requireDate(paymentDate, 'payment date')
  const dueC = toCentavos(taxDue)

  const reducedSurcharge = microSmall && !willful && roll.rolledDueDate >= SUR.microSmallFrom
  const reducedInterest = microSmall && roll.rolledDueDate >= INT.microSmallFrom
  const surRate = willful ? SUR.willfulNeglect : reducedSurcharge ? SUR.microSmall : SUR.standard
  const daysLate = Math.max(0, daysBetween(rolled, paid))
  const late = daysLate > 0

  const base = {
    dueDate: roll.dueDate,
    rolledDueDate: roll.rolledDueDate,
    dueDateMoved: roll.moved,
    movedBecause: roll.reason,
    holidayListMissing: roll.holidayListMissing,
    paymentDate: iso(paid),
    late,
    daysLate,
    reducedRates: reducedSurcharge || reducedInterest,
    willful,
    compromiseOnSchedule: !willful,
    surRate,
    references: [...pen.surcharge.legalBasis, ...pen.interest.legalBasis, ...pen.compromiseTiers.legalBasis],
  }

  if (!late) {
    const total = fromCentavos(dueC)
    return {
      ...base, interestPeriods: [], surcharge: 0, interest: 0, compromise: 0,
      scheduleCompromise: 0, total, totalWithScheduleCompromise: total,
    }
  }

  const surchargeC = mulRate(dueC, surRate)
  const periods = interestSchedule(addDays(rolled, 1), paid, reducedInterest).map(p => {
    const days = daysBetween(p.from, p.to) + 1
    const r = rate(p.rate)
    const interestC = mulFrac(dueC, r.num * BigInt(days), r.den * BigInt(DAY_COUNT.daysInYear))
    return { from: iso(p.from), to: iso(p.to), days, rate: p.rate, interestC }
  })
  const interestC = sumCentavos(periods.map(p => p.interestC))
  const scheduleC = toCentavos(compromiseFor(taxDue))
  const compromiseC = willful ? 0 : scheduleC

  return {
    ...base,
    interestPeriods: periods.map(({ interestC: c, ...p }) => ({ ...p, interest: fromCentavos(c) })),
    surcharge: fromCentavos(surchargeC),
    interest: fromCentavos(interestC),
    compromise: willful ? null : fromCentavos(compromiseC),
    scheduleCompromise: fromCentavos(scheduleC),
    total: fromCentavos(sumCentavos(dueC, surchargeC, interestC, compromiseC)),
    totalWithScheduleCompromise: fromCentavos(sumCentavos(dueC, surchargeC, interestC, scheduleC)),
  }
}
