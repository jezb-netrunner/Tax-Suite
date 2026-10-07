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

import { iso, fromISO, mkDate, lastDayOfMonth, addDays, daysBetween, shiftToBusinessDay, taxableYearQuarters, isWeekend, previousBusinessDay, nonWorkingReason, manilaToday } from './dates.js'
import { profileFlags, obligationApplies } from './profile.js'
import holidayRules from '../data/rules/holidays.json'
import obligationRules from '../data/rules/obligations.json'

// Weekend/holiday policy per agency (holidays.json rollOverByAgency):
//   next_working_day — the deadline moves to the next working day (BIR, SSS,
//                      PhilHealth, Pag-IBIG)
//   statutory_date   — the date set by law is shown as is, with the agency's
//                      note (LGU, SEC, DOLE); an agency missing from the list
//                      is treated the same way, the conservative choice
// Obligations marked noWeekendShift (13th-month pay, e-invoicing) never move
// later whatever the agency ('never_later', with noShiftNote).
const ROLL_OVER = holidayRules.rollOverByAgency
const NO_SHIFT_NOTE = holidayRules.noShiftNote
const STATUTORY_NOTE = ROLL_OVER.LGU.note

// Deadline extensions issued after the fact (obligations.json "overrides"):
// { obligationId, rawDate ('YYYY-MM-DD', the date set by law) or period
// (e.g. 'TY 2025', 'Q3 2026'), newDate, basis }. The new date replaces the
// usual (weekend-moved) date and is shown as "Extended to <date> by <basis>".
const OVERRIDES = obligationRules.overrides || []

// ---------------------------------------------------------------------------
// Confidence (H07, owner decision 8). Every rule in the rulebook carries
// confidence 'verified' or 'needs_review'; needs_review rules are shown with an
// "Unconfirmed: check with the agency" badge. A generated deadline is
// unconfirmed when its own rule is, and also when its date was moved past a
// weekend or holiday using a needs_review holiday list (holidays.json
// confidenceByYear, else the file's confidence) or a needs_review weekend rule
// of the agency (rollOverByAgency), or when it stays on a weekend or holiday
// under a needs_review agency rule. A rule with no confidence counts as
// unconfirmed.

export const UNCONFIRMED_RULE = 'This rule is not yet confirmed from an official source.'

export function unconfirmedHolidaysReason(year) {
  return `The ${year} holiday list is not confirmed, and this date was moved past a weekend or holiday.`
}

export function unconfirmedRollOverReason(agency) {
  return `The ${agency} rule for deadlines that fall on a weekend or holiday is not confirmed.`
}

// Confidence of the holiday list used for a year.
export function holidayYearConfidence(year, rules = holidayRules) {
  const byYear = rules.confidenceByYear || {}
  return byYear[String(year)] || rules.confidence || 'needs_review'
}

// True for a needs_review (or unrated) obligation or generated deadline.
export function isUnconfirmed(x) {
  return !x || x.confidence !== 'verified'
}

// Plain-language reasons why an item is unconfirmed ([] when it is verified).
// A generated deadline carries them in confidenceReasons; an obligation
// (checklist item) only has its own rule's confidence.
export function confidenceReasons(x) {
  if (x && Array.isArray(x.confidenceReasons)) return x.confidenceReasons
  return isUnconfirmed(x) ? [UNCONFIRMED_RULE] : []
}

function deadlineConfidence(ob, { rawDate, dueDate, shifted, nonWorkingDay, policy, agencyRule }) {
  const reasons = []
  if (isUnconfirmed(ob)) reasons.push(UNCONFIRMED_RULE)
  if (shifted) {
    const years = [...new Set([rawDate.getFullYear(), dueDate.getFullYear()])]
    for (const y of years) {
      if (holidayYearConfidence(y) !== 'verified') reasons.push(unconfirmedHolidaysReason(y))
    }
  }
  const agencyMatters = (policy === 'next_working_day' && shifted) || (policy === 'statutory_date' && nonWorkingDay)
  if (agencyMatters && (!agencyRule || agencyRule.confidence !== 'verified')) {
    reasons.push(unconfirmedRollOverReason(ob.agency))
  }
  return { confidence: reasons.length ? 'needs_review' : 'verified', confidenceReasons: reasons }
}

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

// An extension can move a date further than the weekend look-back, so scan
// far enough back to catch the longest one (a period-named one: 4 months).
function lookbackDays(overrides) {
  let days = SHIFT_LOOKBACK_DAYS
  for (const o of overrides) {
    const ext = o.rawDate ? daysBetween(fromISO(o.rawDate), fromISO(o.newDate)) : 120
    days = Math.max(days, ext + SHIFT_LOOKBACK_DAYS)
  }
  return days
}

/**
 * Generate the personalized deadline list.
 * @param {Array} obligations  rules from obligations.json
 * @param {Object} profile     taxpayer profile
 * @param {Object} opts        { from, to, holidays (Set<iso> or holiday calendar),
 *                              refDate, rollOver (default: the rulebook's policy per agency),
 *                              overrides (default: the rulebook's extensions) }
 * @returns [{ id, obligation, date, rawDate, shifted, shiftReason, label, period, daysAway,
 *             rollOver: 'next_working_day'|'statutory_date'|'never_later',
 *             nonWorkingDay: 'weekend'|'holiday'|null  (only when the shown date is one),
 *             lastWorkingDayBefore: Date|null, rollNote: string|null,
 *             extended: { basis, from: Date (the date it replaced), notes } | null,
 *             confidence: 'verified'|'needs_review', confidenceReasons: string[] }]
 */
export function generateDeadlines(obligations, profile, { from, to, holidays, refDate, rollOver = ROLL_OVER, overrides = OVERRIDES }) {
  const flags = profileFlags(profile)
  const out = []
  const scanFrom = addDays(from, -lookbackDays(overrides))
  for (const ob of obligations) {
    if (!obligationApplies(ob.appliesTo, flags)) continue
    if (ob.schedule.kind === 'ongoing' || ob.schedule.kind === 'info') continue
    const noShift = ob.noWeekendShift || ob.schedule.noWeekendShift
    const agencyRule = rollOver[ob.agency]
    const policy = noShift ? 'never_later' : (agencyRule && agencyRule.policy) || 'statutory_date'
    const rollNote = policy === 'never_later' ? NO_SHIFT_NOTE
      : policy === 'statutory_date' ? ((agencyRule && agencyRule.note) || STATUTORY_NOTE)
        : null
    const obOverrides = overrides.filter(o => o.obligationId === ob.id)
    for (const occ of rawOccurrences(ob, profile, scanFrom, to)) {
      const usualDate = policy === 'next_working_day' ? shiftToBusinessDay(occ.date, holidays) : occ.date
      const ov = obOverrides.find(o => (o.rawDate ? o.rawDate === iso(occ.date) : o.period === occ.period))
      const dueDate = ov ? fromISO(ov.newDate) : usualDate
      // The effective due date decides membership in the window.
      if (dueDate < from || dueDate > to) continue
      const shifted = !ov && iso(usualDate) !== iso(occ.date)
      const nonWorkingDay = policy === 'next_working_day' ? null : nonWorkingReason(dueDate, holidays)
      out.push({
        id: `${ob.id}:${iso(occ.date)}`,
        obligation: ob,
        rawDate: occ.date,
        date: dueDate,
        shifted,
        shiftReason: shifted ? (isWeekend(occ.date) ? 'weekend' : 'holiday') : null,
        label: occ.label,
        period: occ.period,
        daysAway: refDate ? daysBetween(refDate, dueDate) : null,
        rollOver: policy,
        nonWorkingDay,
        lastWorkingDayBefore: nonWorkingDay ? previousBusinessDay(dueDate, holidays) : null,
        rollNote,
        extended: ov ? { basis: ov.basis, from: usualDate, notes: ov.notes || null } : null,
        ...deadlineConfidence(ob, { rawDate: occ.date, dueDate, shifted, nonWorkingDay, policy, agencyRule }),
      })
    }
  }
  out.sort((a, b) => a.date - b.date || a.obligation.title.localeCompare(b.obligation.title))
  return out
}

// Deadlines (already in date order) grouped by calendar month of the due date:
// [{ key: 'YYYY-MM', label: 'October 2026', items: [...] }]. Used by the
// calendar's Timeline view, which shows every deadline in the window.
export function groupByMonth(list) {
  const groups = []
  for (const d of list) {
    const key = iso(d.date).slice(0, 7)
    let g = groups[groups.length - 1]
    if (!g || g.key !== key) {
      g = { key, label: d.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), items: [] }
      groups.push(g)
    }
    g.items.push(d)
  }
  return groups
}

// ---------------------------------------------------------------------------
// Filed / overdue state (M09). Marks are saved on the profile:
//   profile.filed          { [filedKey]: 'YYYY-MM-DD' marked }  dated deadlines
//   profile.checklistDone  { [obligation id]: 'YYYY-MM-DD' }     checklist items
// The key of a dated deadline is its id: obligation id + the date set by law
// (before any weekend move or extension), so it never changes for a period.

export const OVERDUE_DAYS = 60

export function filedKey(d) {
  return d.id
}

export function isFiled(profile, d) {
  return Boolean(profile && profile.filed && profile.filed[filedKey(d)])
}

// 'filed' | 'n/a' (an optional item the taxpayer says does not apply) | null
export function filedStatus(profile, d) {
  const v = profile && profile.filed && profile.filed[filedKey(d)]
  if (!v) return null
  return v === 'n/a' ? 'n/a' : 'filed'
}

// A copy of the profile with the mark set (on) or removed (off). The mark is
// the Manila date it was set, or 'n/a' when status is 'n/a'.
export function withFiled(profile, key, on, today, status = 'filed') {
  const filed = { ...(profile.filed || {}) }
  if (on) filed[key] = status === 'n/a' ? 'n/a' : iso(today)
  else delete filed[key]
  return { ...profile, filed }
}

// The same for several keys at once ("Mark all as filed" and its Undo).
export function withFiledMany(profile, keys, on, today) {
  return keys.reduce((p, key) => withFiled(p, key, on, today), profile)
}

/**
 * Deadlines whose (moved) due date has passed in the last `days` days and that
 * are not marked filed, oldest first, each with daysOverdue (1 = due yesterday).
 */
export function overdueDeadlines(obligations, profile, { today, holidays, rollOver, days = OVERDUE_DAYS }) {
  const list = generateDeadlines(obligations, profile, {
    from: addDays(today, -days), to: addDays(today, -1), holidays, refDate: today, rollOver,
  })
  return list
    .filter(d => !isFiled(profile, d))
    .map(d => ({ ...d, daysOverdue: -d.daysAway }))
}

// Income-tax rail: 'filed' (or 'n/a') only when the user marked it; otherwise
// 'passed' once the due date has gone by, else 'due'.
export function railStatus(profile, d, today) {
  const marked = filedStatus(profile, d)
  if (marked) return marked
  return d.date < today ? 'passed' : 'due'
}

export function isChecked(profile, ob) {
  return Boolean(profile && profile.checklistDone && profile.checklistDone[ob.id])
}

export function withChecked(profile, obligationId, on, today) {
  const done = { ...(profile.checklistDone || {}) }
  if (on) done[obligationId] = iso(today)
  else delete done[obligationId]
  return { ...profile, checklistDone: done }
}

// Years in [from, to] whose holidays are not yet proclaimed in the rulebook
// (their dates skip weekends and the holidays fixed by law only). `calendar`
// is a holiday calendar from makeHolidayCalendar; a plain Set has no
// proclamation data, so nothing is reported for it.
export function unproclaimedYears(calendar, from, to) {
  if (!calendar || typeof calendar.isProclaimed !== 'function') return []
  const out = []
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
    if (!calendar.isProclaimed(y)) out.push(y)
  }
  return out
}

// Calendar banner for those years, or null when there are none.
export function holidayGapNote(years) {
  if (!years || !years.length) return null
  const names = years.length === 1 ? String(years[0])
    : `${years.slice(0, -1).join(', ')} and ${years[years.length - 1]}`
  return `${names} holidays not yet proclaimed: a deadline may move one or more days later.`
}

// Checklist = the ongoing/info obligations for this profile. An item with
// showUntil ('YYYY-MM-DD', e.g. a time-boxed program) is listed through that
// date and dropped after it. `today` defaults to today's date in Manila.
export function generateChecklist(obligations, profile, { today = manilaToday() } = {}) {
  const flags = profileFlags(profile)
  const todayISO = iso(today)
  return obligations.filter(ob =>
    (ob.schedule.kind === 'ongoing' || ob.schedule.kind === 'info') &&
    obligationApplies(ob.appliesTo, flags) &&
    !(ob.showUntil && todayISO > ob.showUntil)
  )
}
