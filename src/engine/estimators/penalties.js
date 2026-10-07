// Late filing/payment penalty estimator: surcharge + interest + compromise,
// with the EOPT reductions for micro & small taxpayers.
//
// Rounding: each line (surcharge, interest, compromise) is rounded half-up to
// the centavo, computed exactly in whole centavos (BigInt for amount × rate ×
// days), and the total is the sum of the rounded lines.

import pen from '../../data/rules/penalties.json'
import { toCentavos, fromCentavos, mulRate, mulFrac, rate } from '../../lib/money.js'

const SUR = pen.surcharge.value
const INT = pen.interest.value
const TIERS = pen.compromiseTiers.value

export function compromiseFor(taxDue, microSmall = false) {
  const tier = TIERS.find(t => t.taxDueUpTo === null || taxDue <= t.taxDueUpTo) || TIERS[TIERS.length - 1]
  return microSmall ? tier.amount * 0.5 : tier.amount
}

/**
 * @param {Object} in_ { taxDue, daysLate, microSmall, willful }
 */
export function estimatePenalty(in_) {
  const { taxDue = 0, daysLate = 0, microSmall = false, willful = false } = in_
  const surRate = willful ? SUR.willfulNeglect : microSmall ? SUR.microSmall : SUR.standard
  const intRate = microSmall ? INT.microSmallAnnualRate : INT.standardAnnualRate
  const dueC = toCentavos(taxDue)
  const surchargeC = mulRate(dueC, surRate)
  // Interest = tax × annual rate × days / 365, rounded once.
  const ir = rate(intRate)
  const days = Number.isFinite(daysLate) ? Math.trunc(daysLate) : 0
  const interestC = mulFrac(dueC, ir.num * BigInt(days), ir.den * 365n)
  const compromiseC = toCentavos(compromiseFor(taxDue, microSmall))
  return {
    surRate,
    intRate,
    surcharge: fromCentavos(surchargeC),
    interest: fromCentavos(interestC),
    compromise: fromCentavos(compromiseC),
    total: fromCentavos(dueC + surchargeC + interestC + compromiseC),
    references: [...pen.surcharge.legalBasis, ...pen.interest.legalBasis, ...pen.compromiseTiers.legalBasis],
  }
}
