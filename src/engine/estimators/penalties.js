// Late filing/payment penalty estimator: surcharge + interest + compromise,
// with the EOPT reductions for micro & small taxpayers (surcharge and interest
// only: the compromise for late filing or payment, NIRC Sec 255, is the full
// RMO 7-2015 Annex A amount for every taxpayer size; RR 6-2024 halves the
// compromise only for invoicing violations, Secs 113, 237 and 238).
//
// Rounding: each line (surcharge, interest, compromise) is rounded half-up to
// the centavo, computed exactly in whole centavos (BigInt for amount × rate ×
// days), and the total is the sum of the rounded lines.

import pen from '../../data/rules/penalties.json'
import { toCentavos, fromCentavos, mulRate, mulFrac, rate } from '../../lib/money.js'

const SUR = pen.surcharge.value
const INT = pen.interest.value
const TIERS = pen.compromiseTiers.value

// RMO 7-2015 Annex A: each edge belongs to the lower tier ("not over").
// Compared in whole centavos, so ₱5,000.01 is in the ₱5,001-₱10,000 tier.
// The amount is the same for every taxpayer size (no micro/small reduction).
export function compromiseFor(taxDue) {
  const dueC = toCentavos(taxDue)
  const tier = TIERS.find(t => t.taxDueUpTo === null || dueC <= toCentavos(t.taxDueUpTo)) || TIERS[TIERS.length - 1]
  return tier.amount
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
  const compromiseC = toCentavos(compromiseFor(taxDue))
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
