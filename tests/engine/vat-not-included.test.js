import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'
import { estimateCorporation } from '../../src/engine/estimators/corporation.js'

// H05 (owner decision 4): VAT is not computed. Every VAT-case total says
// "Income tax and percentage tax only; VAT not included", the dead "see the
// VAT panel" pointer is gone, and the note applies to every VAT-registered
// taxpayer, not only those over ₱3M.

const NOTE = 'Income tax and percentage tax only; VAT not included.'
const opt = (r, key) => r.options.find(o => o.key === key)
const row = (rows, re) => rows.find(x => re.test(x.label))
const allText = rows => rows.map(x => `${x.label} ${x.sub || ''}`).join('\n')

describe('TB:W15 VAT-registered individual, ₱4,000,000 sales, ₱1,500,000 expenses', () => {
  const r = estimateIndividual({ gross: 4000000, expenses: 1500000, vatRegistered: true })
  it('income tax totals are unchanged: OSD ₱522,500, itemized ₱552,500 (VAT excluded)', () => {
    expect(opt(r, 'osd').total).toBe(522500)
    expect(opt(r, 'itemized').total).toBe(552500)
  })
  it('every option and the result carry the "VAT not included" note', () => {
    expect(r.vatNotIncluded).toBe(true)
    expect(r.vatNote).toBe(NOTE)
    expect(opt(r, 'osd').vatNotIncluded).toBe(true)
    expect(opt(r, 'itemized').vatNotIncluded).toBe(true)
  })
  it('no pointer to a VAT panel; the VAT row says it is not included', () => {
    for (const o of r.options) expect(allText(r.rowsFor(o))).not.toMatch(/VAT panel/)
    const vatRow = row(r.rows, /^Value-added tax/)
    expect(vatRow.value).toBe(null)
    expect(vatRow.sub).toBe('Not included in this estimate. VAT (12% of sales less creditable input VAT) is filed quarterly on Form 2550Q.')
    expect(row(r.rows, /^Total annual tax/).sub).toBe(NOTE)
  })
})

describe('VAT-registered under ₱3M also gets the note (UX-08)', () => {
  it('₱2,000,000 sales, VAT-registered', () => {
    const r = estimateIndividual({ gross: 2000000, expenses: 1000000, vatRegistered: true })
    expect(r.overThreshold).toBe(false)
    expect(r.vatNotIncluded).toBe(true)
    expect(opt(r, 'osd').vatNotIncluded).toBe(true)
    expect(opt(r, '8pct').reason).toBe('Not available to VAT-registered taxpayers.')
  })
  it('non-VAT under ₱3M: no VAT note', () => {
    const r = estimateIndividual({ gross: 2000000, expenses: 1000000 })
    expect(r.vatNotIncluded).toBe(false)
    expect(r.options.every(o => !o.vatNotIncluded)).toBe(true)
    expect(row(r.rows, /^Total annual tax/).sub).toBe(undefined)
  })
  it('crossing ₱3M mid-year: VAT for the rest of the year is not included', () => {
    const r = estimateIndividual({ gross: 3200000, expenses: 2000000, taxYear: 2026 })
    expect(r.vatNotIncluded).toBe(true)
    expect(opt(r, 'itemized').vatNotIncluded).toBe(true)
    expect(row(r.rows, /^Total annual tax/).sub).toBe(NOTE)
  })
})

describe('corporate estimator VAT text', () => {
  it('VAT corporation: not included, no "computed separately" promise', () => {
    const r = estimateCorporation({ grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000, taxYear: 2026, vatRegistered: true })
    expect(r.vatNotIncluded).toBe(true)
    expect(r.vatNote).toBe(NOTE)
    expect(row(r.rows, /^Value-added tax/).sub).toBe('Not included in this estimate. VAT (12% of sales less creditable input VAT) is filed quarterly on Form 2550Q.')
  })
  it('non-VAT corporation under ₱3M: no VAT note', () => {
    const r = estimateCorporation({ grossSales: 2000000, costOfSales: 500000, opex: 500000, totalAssets: 5000000, taxYear: 2026 })
    expect(r.vatNotIncluded).toBe(false)
    expect(row(r.rows, /^Value-added tax/)).toBe(undefined)
  })
})
