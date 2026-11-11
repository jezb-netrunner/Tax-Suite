// Calendar-app export (.ics, RFC 5545): audit Nov 12, 2026 (U12).
//
// The calendar could only be printed or downloaded as a spreadsheet, so a
// phone user had no way to get a reminder. This writes the upcoming due dates
// as all-day events that any calendar app (Google Calendar, Apple Calendar,
// Outlook) can import, each with two reminders: three days before and on the
// morning of the due date. Pure functions; the browser download is in
// exports.js (downloadText).
//
// The events are a snapshot: they do not update when the rules change, so
// each one says which rules it was built from and to check the app again.

import { iso, addDays } from '../engine/dates.js'
import { deadlineNotes } from './exports.js'
import meta from '../data/rules/meta.json'

// Text values: backslash, semicolon, comma and line breaks are escaped.
export function icsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    // Control characters have no place in a calendar entry.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
}

// Lines longer than 75 octets are folded (continued on the next line after a space).
export function foldLine(line) {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    const limit = parts.length ? 74 : 75 // continuation lines start with a space
    if (size + n > limit) {
      parts.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

const ymd = d => iso(d).replace(/-/g, '')

// The first reminder comes this many days before the due date, at 9:00 am
// (all-day events start at midnight, so the trigger is one day less, plus 15 hours).
export const REMINDER_DAYS_BEFORE = 3
const EARLY_TRIGGER = `-P${REMINDER_DAYS_BEFORE - 1}DT15H`

/**
 * @param {Object} in_ { upcoming: generated deadlines (dates today or later),
 *                       today: Manila date, profileName }
 * @returns the text of an .ics file (CRLF line ends)
 */
export function deadlineIcs({ upcoming = [], today, profileName = '' }) {
  const stamp = `${ymd(today)}T000000Z`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//JEZ Tax Suite//Deadline calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`Tax deadlines${profileName ? ` (${profileName})` : ''}`)}`,
  ]
  const seen = new Set()
  for (const d of upcoming) {
    if (seen.has(d.id)) continue
    seen.add(d.id)
    const ob = d.obligation
    const form = ob.form && ob.form !== '—' ? `${ob.form}: ` : ''
    const period = d.period || d.label || ''
    const notes = deadlineNotes(d)
    const description = [
      `${ob.agency}${period ? ` · ${period}` : ''}${profileName ? ` · ${profileName}` : ''}`,
      notes,
      `From JEZ Tax Suite, rules as of ${meta.verifiedDate}. A reminder, not advice: deadlines can be moved after this file was made, so check the app or the agency before relying on this date.`,
    ].filter(Boolean).join('\n')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsText(d.id)}@jez-tax-suite`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(d.date, 1))}`,
      `SUMMARY:${icsText(`${form}${ob.title}${period ? ` (${period})` : ''}`)}`,
      `DESCRIPTION:${icsText(description)}`,
      'TRANSP:TRANSPARENT',
      // Some days before at 9:00 am, and at 9:00 am on the due date.
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`Due in ${REMINDER_DAYS_BEFORE} days: ${form}${ob.title}`)}`, `TRIGGER:${EARLY_TRIGGER}`, 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(`Due today: ${form}${ob.title}`)}`, 'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export function deadlineIcsFileName(csvFileName) {
  return String(csvFileName).replace(/\.csv$/, '.ics')
}
