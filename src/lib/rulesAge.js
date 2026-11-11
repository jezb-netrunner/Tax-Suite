// How old the rulebook is (audit Nov 11-12, 2026).
//
// The app is one file that people keep, email and open from disk, so a copy
// can be in use long after its rules were last checked. Tax rates, deadlines
// and holidays change every few months; an old copy must say so itself.
//
//   rulesAge(today) -> { verifiedISO, verifiedText, days, stale, clockBehind }
//   STALE_AFTER_DAYS   days after the last check when the notice appears
//
// `today` is a Manila calendar date (see dates.js manilaToday). clockBehind
// (X11): the device says it is earlier than the day the rules were checked,
// which cannot be right, so "today", the days left and this very check are
// all unreliable until the clock is fixed.

import meta from '../data/rules/meta.json'
import operator from '../data/operator.json'
import { fromISO, daysBetween, manilaToday } from '../engine/dates.js'

export const STALE_AFTER_DAYS = 90

export function rulesAge(today = manilaToday(), { verifiedISO = meta.verifiedISO, verifiedText = meta.verifiedDate } = {}) {
  const days = daysBetween(fromISO(verifiedISO), today)
  return { verifiedISO, verifiedText, days, stale: days > STALE_AFTER_DAYS, clockBehind: days < 0 }
}

// Where the newest copy is published (operator.json siteUrl), as plain text.
export function newestCopyText(siteUrl = operator.siteUrl) {
  const url = typeof siteUrl === 'string' ? siteUrl.trim() : ''
  return /^https:\/\/[^\s<>"']+$/.test(url) ? ` at ${url.replace(/^https:\/\//, '').replace(/\/$/, '')}` : ''
}

// The notice shown on every page (and on printouts) once the rules are stale,
// or when the device's date is earlier than the rules date.
export function staleRulesText(age, { siteUrl } = {}) {
  if (age.clockBehind) {
    return `This device's date is earlier than ${age.verifiedText}, the day this copy's rules were last checked, so its clock is wrong. ` +
      'Deadlines, "days left" and due-today notes may be off until the date is corrected.'
  }
  if (!age.stale) return null
  const months = Math.floor(age.days / 30)
  const ago = age.days >= 365
    ? `more than ${Math.floor(age.days / 365) === 1 ? 'a year' : `${Math.floor(age.days / 365)} years`} ago`
    : `about ${months} months ago`
  return `The tax rules in this copy were last checked on ${age.verifiedText}, ${ago}. Rates, deadlines and holidays may have changed since then. ` +
    `Get the newest copy of JEZ Tax Suite${newestCopyText(siteUrl)}, and confirm every amount and date with the BIR or the agency before you rely on it.`
}
