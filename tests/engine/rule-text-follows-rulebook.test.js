// H16: when the rulebook changes, the words change with the math. The rule
// files are replaced here by changed copies (as the owner would edit them for
// a new law), and every label, note, card, form-guide entry and blog line
// must show the new numbers and none of the old ones.
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../src/data/rules/business-tax.json', async (importOriginal) => {
  const m = (await importOriginal()).default
  return { default: { ...m, vatThreshold: { ...m.vatThreshold, value: 3600000 }, vatRate: { ...m.vatRate, value: 0.15 }, percentageTaxRate: { ...m.percentageTaxRate, value: 0.025 }, invoiceIssuanceThreshold: { ...m.invoiceIssuanceThreshold, value: 600 } } }
})
vi.mock('../../src/data/rules/income-tax.json', async (importOriginal) => {
  const m = (await importOriginal()).default
  return {
    default: {
      ...m,
      eightPercent: { ...m.eightPercent, value: { ...m.eightPercent.value, rate: 0.09, allowanceForPureSelfEmployed: 300000, grossCeiling: 3600000 } },
      osd: { ...m.osd, value: { ...m.osd.value, rate: 0.45 } },
      thirteenthMonthExclusionCap: { ...m.thirteenthMonthExclusionCap, value: 120000 },
    },
  }
})
vi.mock('../../src/data/rules/corporate.json', async (importOriginal) => {
  const m = (await importOriginal()).default
  return {
    default: {
      ...m,
      rcit: { ...m.rcit, value: { ...m.rcit.value, standardRate: 0.24, smallCorpRate: 0.19 } },
      mcit: { ...m.mcit, value: { ...m.mcit.value, rate: 0.015, startsInTaxableYear: 5, excessCarryForwardYears: 4 } },
    },
  }
})
vi.mock('../../src/data/rules/obligations.json', async (importOriginal) => {
  const m = (await importOriginal()).default
  const obligations = m.obligations.map(o => {
    if (o.id === 'bir-1701a-annual') return { ...o, schedule: { ...o.schedule, day: 30 } }
    if (o.id === 'bir-1601c') return { ...o, schedule: { ...o.schedule, day: 12 } }
    return o
  })
  return { default: { ...m, obligations } }
})

const { estimateIndividual, VAT_ROW_NOTE } = await import('../../src/engine/estimators/individual.js')
const { estimateEmployee } = await import('../../src/engine/estimators/employee.js')
const { estimateCorporation } = await import('../../src/engine/estimators/corporation.js')
const { estimatePayroll } = await import('../../src/engine/estimators/payroll.js')
const { regimeCardText } = await import('../../src/engine/wizardText.js')
const { regimeLabel } = await import('../../src/engine/profile.js')
const { FORMS_DATA } = await import('../../src/data/forms.js')
const { POSTS } = await import('../../src/data/posts.js')
const { GLOSSARY } = await import('../../src/data/glossary.js')

const text = x => JSON.stringify(x)
const form = code => FORMS_DATA.find(f => f.code === code)

describe('labels follow a changed rulebook (H16)', () => {
  it('individual: 8% rate, allowance, ceiling, OSD and percentage tax', () => {
    const r = estimateIndividual({ gross: 1000000, expenses: 0, taxYear: 2026 })
    expect(r.options.map(o => o.name)).toEqual(['9% flat tax', 'Graduated + OSD (45%)', 'Graduated + itemized'])
    const rows8 = text(r.rowsFor(r.options[0]))
    expect(rows8).toContain('Less: ₱300,000 annual allowance')
    expect(rows8).toContain('Income tax @ 9%')
    expect(rows8).toContain('In lieu of graduated rates and the 2.5% percentage tax.')
    expect(text(r.rowsFor(r.options[1]))).toContain('Less: Optional Standard Deduction (45% of gross)')
    expect(text(r.rowsFor(r.options[1]))).toContain('Percentage tax (2.5% of gross)')
    // Every label, option and note the user sees (the legal citations quote the law's own history).
    const shown = text([r.options, r.options.map(o => r.rowsFor(o)), r.annualReturn, r.nolco])
    expect(shown).not.toMatch(/₱250,000|\b8%|40%|\b3%/)
    // ₱3.5M is under the new ₱3.6M line, so 8% (now 9%) stays available.
    expect(estimateIndividual({ gross: 3500000, taxYear: 2026 }).options[0].eligible).toBe(true)
    expect(estimateIndividual({ gross: 3700000, taxYear: 2026 }).options[0].reason).toBe('Not available: sales are over ₱3,600,000.')
    expect(VAT_ROW_NOTE).toContain('VAT (15% of sales')
  })

  it('profile cards and labels', () => {
    expect(regimeLabel('8pct')).toBe('9% flat tax')
    const cards = regimeCardText({ type: 'individual', vatRegistered: false })
    expect(cards['8pct']).toMatch(/^9% on gross above ₱300,000/)
    expect(cards.graduated_osd).toContain('the 45% Optional Standard Deduction, plus 2.5% percentage tax')
  })

  it('employee: 13th-month cap', () => {
    const e = estimateEmployee({ monthlyBasic: 50000, bonusesAnnual: 150000 })
    expect(text(e.annualRows)).toContain('Less: exclusion cap (₱120,000)')
  })

  it('corporation: MCIT rate, start year and carry-forward', () => {
    const notYet = estimateCorporation({ grossSales: 10000000, costOfSales: 6000000, opex: 3900000, totalAssets: 1000000, registrationYear: 2020, taxYear: 2024 })
    expect(notYet.mcitStatus).toBe('notYet')
    expect(text(notYet.rows)).toContain('MCIT starts with TY 2025, the 5th taxable year after the year of BIR registration')
    const applies = estimateCorporation({ grossSales: 10000000, costOfSales: 6000000, opex: 3900000, totalAssets: 1000000, registrationYear: 2020, taxYear: 2025 })
    expect(applies.mcitStatus).toBe('applies')
    expect(text(applies.rows)).toContain('Minimum corporate income tax @ 1.5% of gross income')
    expect(text(applies.rows)).toContain('for the next 4 years')
  })

  it('Forms-page glossary: RCIT and MCIT rates and the MCIT start year (H16 follow-up)', () => {
    const meaning = code => GLOSSARY.find(g => g.code === code).meaning
    expect(meaning('RCIT')).toBe('24% of a corporation\'s taxable income (19% for small corporations).')
    expect(meaning('MCIT')).toBe('1.5% of gross income, paid instead when it is higher than the regular tax, from the 5th taxable year after BIR registration.')
    expect(text(GLOSSARY)).not.toMatch(/25%|20%|\b2%|4th taxable/)
  })

  it('payroll: the 1601-C remittance day', () => {
    expect(text(estimatePayroll({ monthlyBasic: 30000 }).rows)).toContain('remit by the 12th of the following month (Jan 15 for December)')
  })

  it('form guide and blog', () => {
    expect(form('1701A').when).toBe('April 30')
    expect(form('1701A').name).toBe('Annual Income Tax Return (9% / OSD)')
    expect(form('1601-C').when).toBe('12th of the following month (Dec: Jan 15)')
    expect(form('2550Q').lines.map(l => l.desc).join(' ')).toContain('15% VAT on taxable sales')
    const blog = text(POSTS)
    expect(blog).toContain('1701A: your annual return, every April 30.')
    expect(blog).toContain('You pay a flat 9% on your gross receipts above ₱300,000')
    expect(blog).toContain('₱600 and up, or whenever the client asks')
    expect(blog).not.toMatch(/\b8%|₱250,000/)
  })
})
