import { describe, it, expect } from 'vitest'
import { estimateCorporation, estimateCorporateQuarter } from '../../src/engine/estimators/corporation.js'
import corp from '../../src/data/rules/corporate.json'
import { FORMS_DATA } from '../../src/data/forms.js'

// M11: (1) excess MCIT from the last 3 years, credited against the regular tax
// only (never against the MCIT) and expiring after 3 years (NIRC Sec 27(E)(2));
// (2) itemized / OSD choice, OSD = 40% of gross income (sales less cost of
// sales; NIRC Sec 34(L), RR 16-2008); (3) a 1702Q quarter view on cumulative
// figures: RCIT vs MCIT to date, less income tax paid in earlier quarters
// (RR 12-2007).

const row = (rows, re) => rows.find(x => re.test(x.label))

describe('WH:WS-16 MCIT higher than RCIT: ₱150,000 to carry forward', () => {
  // Gross income 20,000,000; net taxable income 1,000,000; assets 150M; registered 2015; TY2026.
  const r = estimateCorporation({ grossSales: 20000000, costOfSales: 0, opex: 19000000, totalAssets: 150000000, registrationYear: 2015, taxYear: 2026 })
  it('RCIT 25% ₱250,000; MCIT ₱400,000; due ₱400,000', () => {
    expect(r.rcit).toBe(250000)
    expect(r.mcit).toBe(400000)
    expect(r.incomeTaxDue).toBe(400000)
  })
  it('excess MCIT ₱150,000 is carried forward to TY 2027 to TY 2029', () => {
    expect(r.excessMcitCarryForward).toEqual({ amount: 150000, usableFrom: 2027, usableTo: 2029 })
    const x = row(r.rows, /^Excess MCIT to carry forward/)
    expect(x.value).toBe(150000)
    expect(x.sub).toMatch(/TY 2027 to TY 2029/)
  })
})

describe('excess MCIT credit against the regular tax', () => {
  // TY2027: gross income 20M, taxable 3M, assets 150M -> RCIT 750,000 > MCIT 400,000.
  const y27 = { grossSales: 20000000, costOfSales: 0, opex: 17000000, totalAssets: 150000000, registrationYear: 2015, taxYear: 2027 }
  it('the ₱150,000 from TY2026 reduces the ₱750,000 regular tax to ₱600,000', () => {
    const r = estimateCorporation({ ...y27, excessMcit: [{ year: 2026, amount: 150000 }] })
    expect(r.incomeTaxDue).toBe(750000)
    expect(r.excessMcitApplied).toBe(150000)
    expect(row(r.rows, /^Less: excess MCIT from earlier years/).value).toBe(-150000)
    expect(r.netPayable).toBe(600000)
  })
  it('never more than the regular tax: ₱1,000,000 available, ₱750,000 used, ₱250,000 left', () => {
    const r = estimateCorporation({ ...y27, excessMcit: [{ year: 2026, amount: 1000000 }] })
    expect(r.excessMcitApplied).toBe(750000)
    expect(r.netPayable).toBe(0)
    expect(r.excessMcitLeft).toEqual([{ year: 2026, amount: 250000, usableTo: 2029 }])
  })
  it('never against the MCIT: when the MCIT is the tax due, nothing is credited and it stays available', () => {
    const r = estimateCorporation({ grossSales: 20000000, costOfSales: 0, opex: 19000000, totalAssets: 150000000, registrationYear: 2015, taxYear: 2027, excessMcit: [{ year: 2026, amount: 150000 }] })
    expect(r.usesMcit).toBe(true)
    expect(r.excessMcitApplied).toBe(0)
    expect(r.netPayable).toBe(400000)
    expect(r.excessMcitLeft).toEqual([{ year: 2026, amount: 150000, usableTo: 2029 }])
    expect(r.excessMcitNote).toMatch(/only against the regular tax/)
  })
  it('expires after 3 years: excess from TY2023 cannot be used in TY2027', () => {
    const r = estimateCorporation({ ...y27, excessMcit: [{ year: 2023, amount: 150000 }] })
    expect(r.excessMcitApplied).toBe(0)
    expect(r.excessMcitExpired).toBe(150000)
    expect(r.netPayable).toBe(750000)
  })
  it('oldest first: ₱120,000 (TY2024) then ₱80,000 of ₱150,000 (TY2026) against ₱200,000 of regular tax', () => {
    // TY2027, gross income 5M (MCIT 100,000), taxable 1M, assets 50M -> RCIT 20% 200,000.
    const r = estimateCorporation({
      grossSales: 5000000, costOfSales: 0, opex: 4000000, totalAssets: 50000000, registrationYear: 2015, taxYear: 2027,
      excessMcit: [{ year: 2026, amount: 150000 }, { year: 2024, amount: 120000 }],
    })
    expect(r.rcit).toBe(200000)
    expect(r.excessMcitApplied).toBe(200000)
    expect(r.excessMcitLeft).toEqual([{ year: 2026, amount: 70000, usableTo: 2029 }])
    expect(r.netPayable).toBe(0)
  })
})

describe('optional standard deduction (40% of gross income)', () => {
  it('sales 10M less cost 4M = gross income 6M; OSD ₱2,400,000; taxable ₱3,600,000; RCIT 20% ₱720,000 (opex ignored)', () => {
    const r = estimateCorporation({ grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000, registrationYear: 2015, taxYear: 2026, deduction: 'osd' })
    expect(r.deduction).toBe('osd')
    expect(r.osd).toBe(2400000)
    expect(r.taxableIncome).toBe(3600000)
    expect(r.rcit).toBe(720000)
    expect(r.mcit).toBe(120000)
    expect(r.incomeTaxDue).toBe(720000)
    expect(row(r.rows, /^Less: optional standard deduction/).value).toBe(-2400000)
    expect(row(r.rows, /^Less: operating expenses/)).toBe(undefined)
  })
  it('OSD is a whole-peso line: gross income ₱1,000,001 -> OSD ₱400,000 (400,000.40), taxable ₱600,001, RCIT ₱120,000', () => {
    const r = estimateCorporation({ grossSales: 1000001, costOfSales: 0, totalAssets: 1000000, registrationYear: 2015, taxYear: 2026, deduction: 'osd' })
    expect(r.osd).toBe(400000)
    expect(r.taxableIncome).toBe(600001)
    expect(r.rcit).toBe(120000)
  })
  it('itemized stays the default', () => {
    const r = estimateCorporation({ grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000, registrationYear: 2015, taxYear: 2026 })
    expect(r.deduction).toBe('itemized')
    expect(r.taxableIncome).toBe(3000000)
  })
  it('the rulebook OSD rule is used', () => {
    expect(corp.osdCorporate.value.rate).toBe(0.4)
  })
})

describe('1702Q quarter view (cumulative figures to the end of the quarter)', () => {
  const base = { taxYear: 2026, registrationYear: 2015, totalAssets: 50000000 }
  it('Q2 itemized: RCIT ₱20,000 vs MCIT ₱60,000 to date -> ₱60,000, less Q1 ₱15,000 and 2307s ₱5,000 = ₱40,000', () => {
    const q = estimateCorporateQuarter({ ...base, quarter: 2, grossSales: 5000000, costOfSales: 2000000, opex: 2900000, paidEarlierQuarters: 15000, cwt: 5000 })
    expect(q.grossIncome).toBe(3000000)
    expect(q.taxableIncome).toBe(100000)
    expect(q.rcit).toBe(20000)
    expect(q.mcit).toBe(60000)
    expect(q.taxDue).toBe(60000)
    expect(q.payable).toBe(40000)
    expect(row(q.rows, /^Less: income tax paid in earlier quarters/).value).toBe(-15000)
  })
  it('Q2 OSD with ₱50,000 excess MCIT from TY2025 and ₱100,000 paid in Q1: ₱360,000 − 50,000 − 100,000 = ₱210,000', () => {
    const q = estimateCorporateQuarter({
      ...base, quarter: 2, grossSales: 5000000, costOfSales: 2000000, deduction: 'osd', paidEarlierQuarters: 100000,
      excessMcit: [{ year: 2025, amount: 50000 }],
    })
    expect(q.osd).toBe(1200000)
    expect(q.taxableIncome).toBe(1800000)
    expect(q.rcit).toBe(360000)
    expect(q.taxDue).toBe(360000)
    expect(q.excessMcitApplied).toBe(50000)
    expect(q.payable).toBe(210000)
  })
  it('more paid than due to date: no payment this quarter', () => {
    const q = estimateCorporateQuarter({ ...base, quarter: 3, grossSales: 5000000, costOfSales: 2000000, opex: 2900000, paidEarlierQuarters: 70000 })
    expect(q.payable).toBe(-10000)
    expect(row(q.rows, /^Overpayment to date/).value).toBe(10000)
  })
  it('names the quarter and its due date: Q2 2026 (Apr to Jun) due Sep 1, 2026; Q3 due Dec 1, 2026 (DL:WS-04)', () => {
    const q2 = estimateCorporateQuarter({ ...base, quarter: 2, grossSales: 1000000 })
    expect(q2.quarterLabel).toBe('Q2: April 1 to June 30, 2026')
    expect(q2.dueDate).toBe('2026-09-01')
    expect(estimateCorporateQuarter({ ...base, quarter: 3, grossSales: 1000000 }).dueDate).toBe('2026-12-01')
  })
  it('only quarters 1 to 3 (no 4th quarterly return)', () => {
    expect(() => estimateCorporateQuarter({ ...base, quarter: 4, grossSales: 1000000 })).toThrow(RangeError)
  })
  it('the 1702Q form card describes the cumulative MCIT comparison and the OSD choice', () => {
    const f = FORMS_DATA.find(x => x.code === '1702Q')
    const text = f.lines.map(l => `${l.box}: ${l.desc}`).join(' | ')
    expect(text).toMatch(/MCIT/)
    expect(text).toMatch(/cumulative gross income/)
    expect(text).toMatch(/40% OSD/)
    expect(text).toMatch(/excess MCIT \(only when the regular tax is due\)/)
  })
})
