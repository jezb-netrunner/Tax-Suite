// Audit Nov 11, 2026: how old the rulebook is.
//
// The app is one file that people keep, email and open from disk, so a copy
// can be in use long after its rules were last checked. Tax rates, deadlines
// and holidays change every few months; an old copy must say so itself.
//
//   rulesAge(today) -> { verifiedISO, verifiedText, days, stale }
//   STALE_AFTER_DAYS   days after the last check when the notice appears
//
// `today` is a Manila calendar date (see dates.js manilaToday).

import meta from '../data/rules/meta.json'
import { fromISO, daysBetween, manilaToday } from '../engine/dates.js'

export const STALE_AFTER_DAYS = 90

export function rulesAge(today = manilaToday(), { verifiedISO = meta.verifiedISO, verifiedText = meta.verifiedDate } = {}) {
  const days = daysBetween(fromISO(verifiedISO), today)
  return { verifiedISO, verifiedText, days, stale: days > STALE_AFTER_DAYS }
}

// The notice shown on every page (and on printouts) once the rules are stale.
export function staleRulesText(age) {
  if (!age.stale) return null
  const months = Math.floor(age.days / 30)
  const ago = age.days >= 365
    ? `more than ${Math.floor(age.days / 365) === 1 ? 'a year' : `${Math.floor(age.days / 365)} years`} ago`
    : `about ${months} months ago`
  return `The tax rules in this copy were last checked on ${age.verifiedText}, ${ago}. Rates, deadlines and holidays may have changed since then. ` +
    'Get the newest copy of JEZ Tax Suite, and confirm every amount and date with the BIR or the agency before you rely on it.'
}
