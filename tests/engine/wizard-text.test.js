// H08: profile setup card text depends on the profile type. A mixed-income
// earner files Form 1701 whatever the deduction method (RMC 17-2019: the
// 1701A is only for income purely from business or profession), and the 8%
// card says the salary stays on graduated rates. Worksheet INF:W-INF-5.
import { describe, it, expect } from 'vitest'
import { regimeCardText } from '../../src/engine/wizardText.js'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

describe('H08 regime cards: mixed income', () => {
  it('INF:W-INF-5 VAT-registered mixed-income earner on OSD files 1701, not 1701A', () => {
    const t = regimeCardText({ type: 'mixed', vatRegistered: true })
    expect(t.graduated_osd).toBe('40% Optional Standard Deduction: simpler books, files 1701 (mixed income).')
    expect(t.graduated_osd).not.toContain('1701A')
    expect(t.graduated_itemized).toBe('Actual documented expenses: files the full 1701.')
  })

  it('the 8% card says: no ₱250,000 reduction, salary stays on graduated rates', () => {
    const t = regimeCardText({ type: 'mixed', vatRegistered: false })
    expect(t['8pct']).toBe('8% on business gross sales (no ₱250,000 reduction), in lieu of graduated rates and percentage tax on the business income; your salary stays on graduated rates. Elected each year on the Q1 return; files 1701.')
    expect(t.graduated_osd).toBe('Graduated rates on your salary plus business income after the 40% Optional Standard Deduction, plus 3% percentage tax on business sales; files 1701.')
    expect(t.graduated_itemized).toBe('Graduated rates on your salary plus business income after actual documented expenses, plus 3% percentage tax on business sales; files 1701.')
    for (const s of Object.values(t)) expect(s).not.toContain('1701A')
  })

  it('INF:W-INF-7 the engine agrees: mixed income, ₱600,000 business gross, ₱500,000 taxable pay: 8% option ₱90,500 on Form 1701', () => {
    const r = estimateIndividual({ mixed: true, gross: 600000, compensationTaxable: 500000, vatRegistered: false, taxYear: 2026 })
    const eight = r.options.find(o => o.key === '8pct')
    // 42,500 graduated tax on the salary + 8% x 600,000 = 48,000 on the business
    expect(eight.incomeTax).toBe(90500)
    expect(eight.returnForm).toBe('1701')
    expect(r.options.find(o => o.key === 'osd').returnForm).toBe('1701')
  })
})

describe('H08 regime cards: purely self-employed (unchanged rules, form named)', () => {
  it('non-VAT', () => {
    const t = regimeCardText({ type: 'individual', vatRegistered: false })
    expect(t['8pct']).toBe('8% on gross above ₱250,000, in lieu of graduated rates and percentage tax. Elected each year on the Q1 return; files 1701A.')
    expect(t.graduated_osd).toBe('Graduated rates on income after the 40% Optional Standard Deduction, plus 3% percentage tax; files 1701A.')
    expect(t.graduated_itemized).toBe('Graduated rates on income after actual documented expenses, plus 3% percentage tax; files the full 1701.')
  })
  it('VAT-registered', () => {
    const t = regimeCardText({ type: 'individual', vatRegistered: true })
    expect(t.graduated_osd).toBe('40% Optional Standard Deduction: simpler books, files 1701A.')
    expect(t.graduated_itemized).toBe('Actual documented expenses: files the full 1701.')
  })
})
