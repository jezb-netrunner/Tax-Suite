// Year-to-date projector (Tools page): where a year's gross sales / receipts
// and the 8% income tax are heading, from the gross so far.
//
//   projected gross = gross so far / months in × 12   (months in: 1 to 12)
//   8% tax          = 8% × (projected gross − reduction)
//     reduction: ₱250,000 for the purely self-employed; none for mixed-income
//     earners (their ₱250,000 is inside the graduated tax on compensation).
//   The 8% option is not available to VAT-registered individuals, to
//   corporations, or above the ₱3,000,000 gross ceiling: no 8% figure then.
//
// All values come from the rulebook (income-tax.json eightPercent). Money is
// whole centavos: each figure is rounded half-up to the centavo; the page
// shows whole pesos.

import incomeTax from '../../data/rules/income-tax.json'
import { toCentavos, fromCentavos, mulFrac, mulRate, divRoundHalfUp } from '../../lib/money.js'

const EIGHT = incomeTax.eightPercent.value

export const MONTHS_MIN = 1
export const MONTHS_MAX = 12

// 'pure' | 'mixed' | 'vat' | 'corporation'
const KINDS = ['pure', 'mixed', 'vat', 'corporation']

/**
 * Which projection a profile gets. null = unknown (no profile, or an employee
 * profile): the page asks "Purely self-employed or mixed income?".
 */
export function projectorKind(profile) {
  if (!profile) return null
  if (profile.type === 'corporation') return 'corporation'
  if (profile.type === 'individual' || profile.type === 'mixed') {
    if (profile.vatRegistered) return 'vat'
    return profile.type === 'mixed' ? 'mixed' : 'pure'
  }
  return null
}

/**
 * @param {Object} in_ { grossSoFar (pesos), monthsIn (whole number 1-12), kind }
 * @returns { kind, monthsIn, projectedGross, overCeiling, eightPercentAvailable,
 *            notAvailableBecause: 'vat'|'corporation'|'over-ceiling'|null,
 *            reduction, taxableBase, eightPercentTax, setAsidePerMonth }
 *          (the last four are null when the 8% option is not available)
 */
export function projectYear(in_) {
  const { grossSoFar = 0, monthsIn, kind } = in_
  if (!Number.isInteger(monthsIn) || monthsIn < MONTHS_MIN || monthsIn > MONTHS_MAX) {
    throw new RangeError(`Months in must be a whole number from ${MONTHS_MIN} to ${MONTHS_MAX}: ${monthsIn}`)
  }
  if (!KINDS.includes(kind)) throw new RangeError(`Unknown kind of filer: ${kind}`)

  const projectedC = mulFrac(toCentavos(grossSoFar), 12, monthsIn)
  const overCeiling = projectedC > toCentavos(EIGHT.grossCeiling)
  const notAvailableBecause = kind === 'vat' ? 'vat'
    : kind === 'corporation' ? 'corporation'
      : overCeiling ? 'over-ceiling' : null
  const base = {
    kind,
    monthsIn,
    projectedGross: fromCentavos(projectedC),
    overCeiling,
    eightPercentAvailable: notAvailableBecause === null,
    notAvailableBecause,
  }
  if (notAvailableBecause) {
    return { ...base, reduction: null, taxableBase: null, eightPercentTax: null, setAsidePerMonth: null }
  }

  const reduction = kind === 'pure' ? EIGHT.allowanceForPureSelfEmployed : EIGHT.allowanceForMixedIncome
  const taxableC = Math.max(0, projectedC - toCentavos(reduction))
  const taxC = mulRate(taxableC, EIGHT.rate)
  return {
    ...base,
    reduction,
    taxableBase: fromCentavos(taxableC),
    eightPercentTax: fromCentavos(taxC),
    setAsidePerMonth: fromCentavos(divRoundHalfUp(taxC, 12)),
  }
}
