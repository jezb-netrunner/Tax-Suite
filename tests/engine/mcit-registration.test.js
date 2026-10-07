import { describe, it, expect } from 'vitest'
import { estimateCorporation, registrationYearOptions, registrationYearChoice } from '../../src/engine/estimators/corporation.js'
import corp from '../../src/data/rules/corporate.json'

// H13: MCIT starts in the 4th taxable year after the year of BIR registration
// (RR 9-98). The profile asks "Year registered with the BIR (for MCIT)",
// accepting any year up to the current Manila year or "1997 or earlier". When
// the year is not set, the estimate shows both RCIT and MCIT with a warning
// instead of the regular tax alone (owner default).

const row = (rows, re) => rows.find(x => re.test(x.label))

// BUG:W6: sales 10,000,000; cost 2,000,000; opex 7,800,000; assets 1,000,000; TY2026.
const w6 = { grossSales: 10000000, costOfSales: 2000000, opex: 7800000, totalAssets: 1000000, taxYear: 2026 }

describe('BUG:W6 established corporation, year registered not set', () => {
  const r = estimateCorporation({ ...w6, registrationYear: null })
  it('shows both: RCIT ₱40,000 and MCIT ₱160,000 (MCIT no longer ₱0)', () => {
    expect(r.rcit).toBe(40000)
    expect(r.mcit).toBe(160000)
    expect(r.mcitStatus).toBe('unknown')
    expect(row(r.rows, /^Minimum corporate income tax/).value).toBe(160000)
  })
  it('income tax due assumes MCIT applies: ₱160,000 (not ₱40,000), labelled as an assumption', () => {
    expect(r.incomeTaxDue).toBe(160000)
    expect(r.usesMcit).toBe(true)
    expect(row(r.rows, /^Income tax due/).label).toBe('Income tax due, if MCIT applies')
  })
  it('the warning names both amounts and asks for the year', () => {
    expect(r.mcitWarning).toBe(
      'The year registered with the BIR is not set on the profile. If the corporation is in its 4th taxable year after that year or later, MCIT applies and income tax due is ₱160,000 (2% MCIT); if not, it is ₱40,000 (regular rate). Set the year on the profile (RR 9-98).',
    )
  })
  it('with "1997 or earlier" the MCIT applies: ₱160,000', () => {
    const k = estimateCorporation({ ...w6, registrationYear: 1997 })
    expect(k.mcitStatus).toBe('applies')
    expect(k.mcitApplies).toBe(true)
    expect(k.incomeTaxDue).toBe(160000)
    expect(k.mcitWarning).toBe(null)
  })
})

describe('year not set but the regular tax is higher anyway', () => {
  it('RCIT ₱600,000 > MCIT ₱120,000: due ₱600,000, "same either way"', () => {
    const r = estimateCorporation({ grossSales: 10000000, costOfSales: 4000000, opex: 3000000, totalAssets: 50000000, taxYear: 2026 })
    expect(r.mcitStatus).toBe('unknown')
    expect(r.incomeTaxDue).toBe(600000)
    expect(r.usesMcit).toBe(false)
    expect(r.mcitWarning).toBe('The year registered with the BIR is not set on the profile, but the regular tax (₱600,000) is higher than the 2% MCIT (₱120,000), so the tax due is the same either way.')
  })
})

describe('WH:WS-24 MCIT counted from the BIR registration year', () => {
  const lean = { grossSales: 6000000, costOfSales: 0, opex: 5900000, totalAssets: 50000000, taxYear: 2026 }
  it('registered with the BIR in 2022 (first sale 2023): TY2026 is the 4th year, ₱120,000', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2022 })
    expect(r.mcitStatus).toBe('applies')
    expect(r.incomeTaxDue).toBe(120000)
  })
  it('registered in 2023: not yet; the note cites the year of BIR registration and RR 9-98', () => {
    const r = estimateCorporation({ ...lean, registrationYear: 2023 })
    expect(r.mcitStatus).toBe('notYet')
    expect(r.incomeTaxDue).toBe(20000)
    expect(row(r.rows, /^Minimum corporate income tax/).sub).toBe('Not yet applicable: MCIT starts with TY 2027, the 4th taxable year after the year of BIR registration (RR 9-98).')
  })
})

describe('profile field "Year registered with the BIR (for MCIT)"', () => {
  it('options: Not sure, every year from the current Manila year down to 1998, then "1997 or earlier"', () => {
    const o = registrationYearOptions(2026)
    expect(o[0]).toEqual(['', 'Not sure'])
    expect(o[1]).toEqual(['2026', '2026'])
    expect(o[o.length - 2]).toEqual(['1998', '1998'])
    expect(o[o.length - 1]).toEqual(['1997', '1997 or earlier'])
    expect(o.length).toBe(1 + 29 + 1)
  })
  it('saved values map to an option without being lost: 1990 and 1900 show as "1997 or earlier"', () => {
    expect(registrationYearChoice(1990)).toBe('1997')
    expect(registrationYearChoice(1900)).toBe('1997')
    expect(registrationYearChoice(1997)).toBe('1997')
    expect(registrationYearChoice(2015)).toBe('2015')
    expect(registrationYearChoice(null)).toBe('')
  })
  it('rulebook: MCIT start counted from the year of BIR registration, citing RR 9-98', () => {
    // H16: a number the estimator uses (4 = the 4th taxable year immediately
    // following the year of registration), no longer a sentence nothing read.
    expect(corp.mcit.value.startsInTaxableYear).toBe(4)
    expect(corp.mcit.notes).toMatch(/4th taxable year immediately following the year of registration with the BIR/)
    expect(corp.mcit.legalBasis.join(' | ')).toMatch(/RR 9-98/)
  })
})
