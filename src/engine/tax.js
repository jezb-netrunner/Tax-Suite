// Shared tax-table math, exact to the centavo (see src/lib/money.js).

import { toCentavos, fromCentavos, rate, divRoundHalfUp } from '../lib/money.js'

// brackets: [{ over, base, rate }] sorted ascending by `over` (pesos, as in the rulebook).
// Tax = base of the bracket whose floor the amount exceeds, plus rate on the excess.

// Amount and result in integer centavos. The product is computed exactly and
// rounded once, half-up to the centavo (e.g. 21.30 × 15% = 3.195 -> 3.20).
export function bracketTaxCentavos(brackets, amountCentavos) {
  if (amountCentavos <= 0) return 0
  let b = brackets[0]
  for (const br of brackets) {
    if (amountCentavos > toCentavos(br.over)) b = br
    else break
  }
  const { num, den } = rate(b.rate)
  const excess = BigInt(amountCentavos - toCentavos(b.over))
  return toCentavos(b.base) + divRoundHalfUp(excess * num, den)
}

// Pesos in, pesos out (rounded half-up to the centavo).
export function bracketTax(brackets, amount) {
  return fromCentavos(bracketTaxCentavos(brackets, toCentavos(amount)))
}
