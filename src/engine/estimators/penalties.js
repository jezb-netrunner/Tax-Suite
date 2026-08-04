// Late filing/payment penalty estimator: surcharge + interest + compromise,
// with the EOPT reductions for micro & small taxpayers.

import pen from '../../data/rules/penalties.json'

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
  const surcharge = taxDue * surRate
  const interest = taxDue * intRate * (daysLate / 365)
  const compromise = compromiseFor(taxDue, microSmall)
  return {
    surRate,
    intRate,
    surcharge,
    interest,
    compromise,
    total: taxDue + surcharge + interest + compromise,
    references: [...pen.surcharge.legalBasis, ...pen.interest.legalBasis, ...pen.compromiseTiers.legalBasis],
  }
}
