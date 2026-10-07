// M22 (owner decision 12): the calendar's "Download CSV" and the line printed
// at the top of every printout. Pure helpers, except downloadText (browser).
import { toCsv } from './csv.js'
import { filedStatus } from '../engine/deadlines.js'
import { iso, daysBetween, fmtDate } from '../engine/dates.js'
import { BRAND } from './pageTitle.js'

export const DEADLINE_CSV_HEADER = ['Date', 'Form', 'Title', 'Agency', 'Period', 'Status']

// Due soon = within 30 days, the same cut-off as the calendar's Timeline view.
const DUE_SOON_DAYS = 30

// Status of one dated deadline on `today` (a Manila calendar date).
export function deadlineStatus(d, profile, today) {
  const marked = filedStatus(profile, d)
  if (marked === 'filed') return 'Filed'
  if (marked === 'n/a') return 'Does not apply'
  const days = daysBetween(today, d.date)
  if (days < 0) return 'Overdue'
  if (days === 0) return 'Due today'
  return days <= DUE_SOON_DAYS ? 'Due soon' : 'Upcoming'
}

function formCell(form) {
  return form && form !== '—' ? form : ''
}

// Every deadline the calendar shows: overdue ones, ones marked in the last
// 60 days, and the next 13 months, in date order. Dates are YYYY-MM-DD so
// spreadsheets sort them correctly.
export function deadlineCsv({ overdue = [], recent = [], upcoming = [], profile, today }) {
  const seen = new Set()
  const items = [...overdue, ...recent, ...upcoming].filter(d => (seen.has(d.id) ? false : seen.add(d.id)))
  items.sort((a, b) => a.date - b.date || a.obligation.title.localeCompare(b.obligation.title))
  const rows = items.map(d => [
    iso(d.date),
    formCell(d.obligation.form),
    d.obligation.title,
    d.obligation.agency,
    d.period || d.label || '',
    deadlineStatus(d, profile, today),
  ])
  return toCsv([DEADLINE_CSV_HEADER, ...rows])
}

function slug(text) {
  return String(text || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function deadlineCsvFileName(profileName, today) {
  const name = slug(profileName)
  return `jez-tax-suite-deadlines-${name ? name + '-' : ''}${iso(today)}.csv`
}

// "JEZ Tax Suite · Maria Santos · Tax year 2026 · Printed Oct 7, 2026"
export function printHeaderText({ profileName, taxYear, printedOn }) {
  return [BRAND, profileName, `Tax year ${taxYear}`, `Printed ${fmtDate(printedOn)}`].filter(Boolean).join(' · ')
}

// Browser only: save text as a file. The byte-order mark lets Excel read the
// file as UTF-8 (₱, ñ and the · separator).
export function downloadText(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿', text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
