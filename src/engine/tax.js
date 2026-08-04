// Shared tax-table math.

// brackets: [{ over, base, rate }] sorted ascending by `over`.
// Tax = base of the bracket whose floor the amount exceeds, plus rate on the excess.
export function bracketTax(brackets, amount) {
  if (amount <= 0) return 0
  let b = brackets[0]
  for (const br of brackets) {
    if (amount > br.over) b = br
    else break
  }
  return b.base + (amount - b.over) * b.rate
}
