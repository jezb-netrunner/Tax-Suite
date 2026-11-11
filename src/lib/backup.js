// Backup files: reading a "Download my data" file back in (audit Nov 11, 2026).
//
// "Download my data" (backend.js exportData) has always written every profile
// to one JSON file, but nothing could read that file back: a cleared browser,
// a new computer or a change of web address lost every client. parseBackup
// turns the text of such a file into clean profiles; backend.js importProfiles
// stores them.
//
// The file is untrusted input (it may have been edited, or come from someone
// else), so nothing is copied as-is:
//   - only the fields a profile really has are kept, each checked for its type
//     (a switch must be true/false, a regime one of the three, and so on);
//   - saved figures keep only plain numbers, short text, true/false and blank,
//     in the shapes the estimators write; anything else is dropped;
//   - "__proto__", "constructor" and "prototype" keys are never read;
//   - the marks saved by the old "Mark as filed" and checklist tick boxes are
//     not restored (nothing reads them any more).
// Pure functions: no browser APIs, so the tests run them directly.

import { defaultProfile, PROFILE_TYPES } from '../engine/profile.js'

export const BACKUP_FORMAT = 'jez-tax-suite-export'
export const BACKUP_VERSION = 1
// A full account (500 profiles with every box filled) is well under 2 MB.
export const BACKUP_MAX_BYTES = 5 * 1024 * 1024
export const BACKUP_MAX_PROFILES = 500
export const NAME_MAX_LENGTH = 120

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const ID_SHAPE = /^[A-Za-z0-9_.-]{1,64}$/
const REGIMES = { individual: ['8pct', 'graduated_osd', 'graduated_itemized'], corporation: ['corporate'] }
const BOOKS = ['manual', 'looseleaf', 'cas']
const BOOLEAN_FIELDS = [
  'vatRegistered', 'hasEmployees', 'withholdsEwt', 'withholdsFwt', 'receives2307', 'usesCrmPos', 'sellsGoods',
  'hasBusinessEstablishment', 'licensedProfessional', 'dtiRegistered', 'multipleEmployers', 'secRegistered',
]
// The estimator tabs that save figures (profile.inputs[key]).
const INPUT_KEYS = ['individual', 'mixed', 'employee', 'corporation', 'payroll']
const MAX_FIGURES_PER_TAB = 80
const MAX_TEXT = 60
// Amount boxes stop at ₱999,999,999,999.99 (format.js).
const MAX_AMOUNT = 999999999999.99

const isPlainObject = x => x !== null && typeof x === 'object' && !Array.isArray(x)

function fail(message) {
  const e = new Error(message)
  e.code = 'bad-backup'
  return e
}

// One saved figure: a number in the range an amount box accepts, short text
// (a chosen option), true/false, or blank.
function cleanFigure(v) {
  if (v === null || typeof v === 'boolean') return { ok: true, value: v }
  if (typeof v === 'number') return Number.isFinite(v) && Math.abs(v) <= MAX_AMOUNT ? { ok: true, value: v } : { ok: false }
  if (typeof v === 'string') return v.length <= MAX_TEXT ? { ok: true, value: v } : { ok: false }
  return { ok: false }
}

// The figures of one estimator tab: { field: figure }, plus one level of
// { year: amount } (the corporate tab's excess MCIT by year).
function cleanFigures(raw) {
  const out = {}
  if (!isPlainObject(raw)) return out
  let n = 0
  for (const k of Object.keys(raw)) {
    if (UNSAFE_KEYS.has(k) || k.length > MAX_TEXT || ++n > MAX_FIGURES_PER_TAB) continue
    const v = raw[k]
    if (isPlainObject(v)) {
      const inner = {}
      let m = 0
      for (const y of Object.keys(v)) {
        if (UNSAFE_KEYS.has(y) || y.length > MAX_TEXT || ++m > MAX_FIGURES_PER_TAB) continue
        const f = cleanFigure(v[y])
        if (f.ok) inner[y] = f.value
      }
      out[k] = inner
      continue
    }
    const f = cleanFigure(v)
    if (f.ok) out[k] = f.value
  }
  return out
}

/**
 * One profile from a backup file -> a clean profile, or null when it is not
 * a profile (no known taxpayer type). `thisYear` bounds the registration year.
 */
export function cleanProfile(raw, { thisYear = new Date().getFullYear() } = {}) {
  if (!isPlainObject(raw)) return null
  const type = typeof raw.type === 'string' && Object.prototype.hasOwnProperty.call(PROFILE_TYPES, raw.type) ? raw.type : null
  if (!type) return null
  const p = defaultProfile(type)
  p.id = typeof raw.id === 'string' && ID_SHAPE.test(raw.id) ? raw.id : null
  // Control characters (tabs, line breaks) become spaces; the rest is kept as typed.
  // eslint-disable-next-line no-control-regex
  const name = typeof raw.name === 'string' ? raw.name.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, NAME_MAX_LENGTH) : ''
  p.name = name || 'Unnamed profile'
  for (const k of BOOLEAN_FIELDS) if (typeof raw[k] === 'boolean') p[k] = raw[k]
  const regimes = type === 'corporation' ? REGIMES.corporation : REGIMES.individual
  if (regimes.includes(raw.regime)) p.regime = raw.regime
  if (BOOKS.includes(raw.booksType)) p.booksType = raw.booksType
  const fy = Number(raw.fiscalYearEndMonth)
  if (Number.isInteger(fy) && fy >= 1 && fy <= 12) p.fiscalYearEndMonth = fy
  const reg = raw.registrationYear
  if (reg !== null && reg !== undefined && reg !== '') {
    const y = Number(reg)
    if (Number.isInteger(y) && y >= 1900 && y <= thisYear + 1) p.registrationYear = y
  }
  // The same rule the profile wizard applies: VAT registration rules out 8%.
  if ((type === 'individual' || type === 'mixed') && p.vatRegistered && p.regime === '8pct') p.regime = 'graduated_osd'
  const inputs = {}
  if (isPlainObject(raw.inputs)) {
    for (const k of INPUT_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(raw.inputs, k)) continue
      const figures = cleanFigures(raw.inputs[k])
      if (Object.keys(figures).length) inputs[k] = figures
    }
  }
  p.inputs = inputs
  return p
}

/**
 * The text of a backup file -> { profiles, skipped, exportedAt, storedIn }.
 * Accepts the "Download my data" file and the copy offered by the error
 * screen ("Download a copy of my data"). Throws an Error (code 'bad-backup')
 * with a plain-language message for anything else.
 */
export function parseBackup(text, { thisYear } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw fail('That file is empty.')
  if (text.length > BACKUP_MAX_BYTES) throw fail('That file is too large to be a JEZ Tax Suite backup.')
  let data
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text)
  } catch {
    throw fail('That file could not be read. Choose the .json file saved by "Download my data".')
  }
  let list = null
  let exportedAt = null
  let storedIn = null
  if (isPlainObject(data) && data.format === BACKUP_FORMAT) {
    if (Number(data.version) > BACKUP_VERSION) {
      throw fail('That backup was made by a newer version of JEZ Tax Suite. Open the newest copy of the app and restore it there.')
    }
    list = data.profiles
    storedIn = typeof data.storedIn === 'string' ? data.storedIn.slice(0, MAX_TEXT) : null
  } else if (isPlainObject(data) && isPlainObject(data.storedData)) {
    // The error screen's copy: the raw browser keys.
    list = data.storedData['pv.profiles.v1']
  }
  if (isPlainObject(data) && typeof data.exportedAt === 'string' && !Number.isNaN(Date.parse(data.exportedAt))) {
    exportedAt = data.exportedAt
  }
  if (!Array.isArray(list)) {
    throw fail('That file is not a JEZ Tax Suite backup. Choose the .json file saved by "Download my data".')
  }
  if (list.length > BACKUP_MAX_PROFILES) {
    throw fail(`That file holds more than ${BACKUP_MAX_PROFILES} profiles, the most the app keeps.`)
  }
  const profiles = []
  const seen = new Set()
  let skipped = 0
  for (const raw of list) {
    const p = cleanProfile(raw, { thisYear })
    if (!p) { skipped++; continue }
    // Two profiles in one file never share an id.
    if (p.id && seen.has(p.id)) p.id = null
    if (p.id) seen.add(p.id)
    profiles.push(p)
  }
  if (!profiles.length) throw fail('That backup holds no profiles.')
  return { profiles, skipped, exportedAt, storedIn }
}
