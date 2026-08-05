// Deadline generator.
//
// Consumes the externalized obligation rules (src/data/rules/obligations.json)
// plus a taxpayer profile, and produces every dated occurrence in a window,
// weekend/holiday-shifted. Calculation logic lives here; the *rules* (which
// form, whose obligation, what schedule, on what legal basis) live in data.
//
// Schedule kinds understood (see obligations.json):
//   quarterly_fixed    — statutory fixed month/day per quarter of the CALENDAR
//                        year (e.g. 1701Q: May 15 / Aug 15 / Nov 15)
//   quarterly_offset   — relative to close of each taxable quarter
//                        { daysAfterEnd } or { monthAfterEnd, day|'last' };
//                        follows the profile's fiscal year for corporations
//                        unless calendarBasis: true (withholding returns are
//                        always calendar-quarter based)
//   monthly            — { day|'last', monthOffset (default 1),
//                          skipQuarterMonths: [3],  e.g. 0619-E skips month 3
//                          monthDayOverrides: {12: 15} } Dec 1601-C due Jan 15
//   annual_fixed       — { month, day|'last' } of every calendar year
//   annual_fy          — relative to fiscal-year end { monthsAfterEnd, day }
//                        or { daysAfterEnd }
//   once               — { date: 'YYYY-MM-DD' } single statutory deadline
//   ongoing            — no dates; surfaces on the compliance checklist
//   info               — no dates; informational only

import { iso, fromISO, mkDate, lastDayOfMonth, addDays, shiftToBusinessDay, taxableYearQuarters, isWeekend } from './dates.js'
import { profileFlags, obligationApplies } from './profile.js'

function resolveDay(year, month, day) {
  return day === 'last' ? lastDayOfMonth(year, month) : mkDate(year, month, day)
}

// All raw (unshifted) occurrences of one obligation intersecting [from, to].
function rawOccurrences(ob, profile, from, to) {
  const sched = ob.schedule
  const out = []
  const fyEnd = sched.calendarBasis ? 12
    : profile.type === 'corporation' ? (profile.fiscalYearEndMonth || 12) : 12
  const years = []
  for (let y = from.getFullYear() - 1; y <= to.getFullYear() + 1; y++) years.push(y)

  if (sched.kind === 'quarterly_fixed') {
    for (const y of years) {
      for (const e of sched.entries) {
        out.push({ date: mkDate(y, e.month, e.day), label: e.label || null, period: `${e.label || ''} ${y}`.trim() })
      }
    }
  } else if (sched.kind === 'quarterly_offset') {
    for (const y of years) {
      const quarters = taxableYearQuarters(y, fyEnd)
      for (const { q, end } of quarters) {
        if (sched.quarters && !sched.quarters.includes(q)) continue
        let date
        if (sched.daysAfterEnd != null) date = addDays(end, sched.daysAfterEnd)
        else {
          const m = end.getMonth() + 1 + (sched.monthAfterEnd || 1)
          const yy = end.getFullYear() + Math.floor((m - 1) / 12)
          const mm = ((m - 1) % 12) + 1
          date = resolveDay(yy, mm, sched.day)
        }
        out.push({ date, label: `Q${q}`, period: `Q${q} FY${y}` })
      }
    }
  } else if (sched.kind === 'monthly') {
    const offset = sched.monthOffset == null ? 1 : sched.monthOffset
    for (const y of years) {
      for (let m = 1; m <= 12; m++) {
        if (sched.skipQuarterMonths) {
          // Month position within the taxable quarter. A fiscal year ending in
          // month F spans two calendar years, so months after F belong to the
          // taxable year ending next calendar year — look in both.
          const d = mkDate(y, m, 15)
          const qs = [...taxableYearQuarters(y, fyEnd), ...(fyEnd === 12 ? [] : taxableYearQuarters(y + 1, fyEnd))]
          const inQ = qs.find(({ start, end }) => d >= start && d <= end)
          if (inQ) {
            const posInQuarter = ((m - (inQ.start.getMonth() + 1) + 12) % 12) + 1
            if (sched.skipQuarterMonths.includes(posInQuarter)) continue
          }
        }
        const dm = m + offset
        const yy = y + Math.floor((dm - 1) / 12)
        const mm = ((dm - 1) % 12) + 1
        const day = (sched.monthDayOverrides && sched.monthDayOverrides[m] != null)
          ? sched.monthDayOverrides[m]
          : sched.day
        const date = resolveDay(yy, mm, day)
        const periodLabel = mkDate(y, m, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        out.push({ date, label: periodLabel, period: periodLabel })
      }
    }
  } else if (sched.kind === 'annual_fixed') {
    // Most annual duties report on the year just ended, but some concern the
    // year they fall in (13th month pay, permit renewals), so the rule says so.
    for (const y of years) {
      const forCurrentYear = sched.periodBasis === 'current_year'
      out.push({
        date: resolveDay(y, sched.month, sched.day),
        label: null,
        period: forCurrentYear ? `${y}` : `TY ${y - 1}`,
      })
    }
  } else if (sched.kind === 'annual_fy') {
    for (const y of years) {
      const fyEndDate = lastDayOfMonth(y, fyEnd)
      let date
      if (sched.daysAfterEnd != null) date = addDays(fyEndDate, sched.daysAfterEnd)
      else {
        const m = fyEnd + sched.monthsAfterEnd
        const yy = y + Math.floor((m - 1) / 12)
        const mm = ((m - 1) % 12) + 1
        date = resolveDay(yy, mm, sched.day)
      }
      out.push({ date, label: null, period: `FY ending ${fyEndDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` })
    }
  } else if (sched.kind === 'once') {
    out.push({ date: fromISO(sched.date), label: null, period: null })
  }
  return out.filter(o => o.date >= from && o.date <= to)
}

// A statutory date can shift forward past several non-working days, so raw
// occurrences are generated from before the requested window and filtered on
// the SHIFTED date. Without this, a deadline whose statutory date fell on a
// Saturday would disappear from the calendar on the Monday it is actually due.
const SHIFT_LOOKBACK_DAYS = 21

/**
 * Generate the personalized deadline list.
 * @param {Array} obligations  rules from obligations.json
 * @param {Object} profile     taxpayer profile
 * @param {Object} opts        { from, to, holidays: Set<iso>, shift: true }
 * @returns [{ id, obligation, date, rawDate, shifted, label, period, daysAway }]
 */
export function generateDeadlines(obligations, profile, { from, to, holidays, refDate }) {
  const flags = profileFlags(profile)
  const out = []
  const scanFrom = addDays(from, -SHIFT_LOOKBACK_DAYS)
  for (const ob of obligations) {
    if (!obligationApplies(ob.appliesTo, flags)) continue
    if (ob.schedule.kind === 'ongoing' || ob.schedule.kind === 'info') continue
    for (const occ of rawOccurrences(ob, profile, scanFrom, to)) {
      const noShift = ob.noWeekendShift || ob.schedule.noWeekendShift
      const shiftedDate = noShift ? occ.date : shiftToBusinessDay(occ.date, holidays)
      // The effective due date decides membership in the window.
      if (shiftedDate < from || shiftedDate > to) continue
      out.push({
        id: `${ob.id}:${iso(occ.date)}`,
        obligation: ob,
        rawDate: occ.date,
        date: shiftedDate,
        shifted: iso(shiftedDate) !== iso(occ.date),
        shiftReason: iso(shiftedDate) !== iso(occ.date)
          ? (isWeekend(occ.date) ? 'weekend' : 'holiday')
          : null,
        label: occ.label,
        period: occ.period,
        daysAway: refDate ? Math.round((shiftedDate - refDate) / 86400000) : null,
      })
    }
  }
  out.sort((a, b) => a.date - b.date || a.obligation.title.localeCompare(b.obligation.title))
  return out
}

// Checklist = the ongoing/info obligations for this profile.
export function generateChecklist(obligations, profile) {
  const flags = profileFlags(profile)
  return obligations.filter(ob =>
    (ob.schedule.kind === 'ongoing' || ob.schedule.kind === 'info') &&
    obligationApplies(ob.appliesTo, flags)
  )
}
