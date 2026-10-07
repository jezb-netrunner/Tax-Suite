import { describe, it, expect } from 'vitest'
import {
  parseMoneyInput, parseIntegerInput, formatMoneyInput, formatIntegerInput, MAX_MONEY_CENTAVOS,
} from '../../src/lib/format.js'

// C01 / M16: the amount boxes. Cases come from REVIEW.md worksheets
// TI:WS-20, TB:W17 and BUG:W1-W4, plus the edge inputs listed in the fix plan.
// Accepted amounts are checked to the exact centavo.

function ok(raw) {
  const r = parseMoneyInput(raw)
  expect(r.ok, `"${raw}" should be accepted (${r.error || ''})`).toBe(true)
  return r
}
function rejected(raw) {
  const r = parseMoneyInput(raw)
  expect(r.ok, `"${raw}" should be rejected`).toBe(false)
  expect(typeof r.error).toBe('string')
  expect(r.error.length).toBeGreaterThan(0)
  return r
}

describe('parseMoneyInput: TI:WS-20 amount-field parsing', () => {
  it("'1,234.56' -> 1,234.56", () => {
    expect(ok('1,234.56')).toMatchObject({ centavos: 123456, value: 1234.56, empty: false })
  })
  it("'480000.75' -> 480,000.75", () => {
    expect(ok('480000.75')).toMatchObject({ centavos: 48000075, value: 480000.75 })
  })
  it("'3,000,000.01' -> 3,000,000.01", () => {
    expect(ok('3,000,000.01')).toMatchObject({ centavos: 300000001, value: 3000000.01 })
  })
  it("'0.5' -> 0.50", () => {
    expect(ok('0.5')).toMatchObject({ centavos: 50, value: 0.5 })
  })
  it("'-500' is rejected with a message (no minus signs)", () => {
    expect(rejected('-500').error).toMatch(/minus/i)
  })
  it("'1e6' is rejected with a message (no exponents)", () => {
    expect(rejected('1e6').error).toMatch(/digits/i)
  })
  it("'abc' is rejected with a message", () => {
    expect(rejected('abc').error).toMatch(/digits/i)
  })
  it("'' is an empty box that counts as 0", () => {
    expect(ok('')).toMatchObject({ centavos: 0, value: 0, empty: true })
  })
  it("'₱ 1,000' -> 1,000", () => {
    expect(ok('₱ 1,000')).toMatchObject({ centavos: 100000, value: 1000 })
  })
  it("'4,800.00' -> 4,800.00", () => {
    expect(ok('4,800.00')).toMatchObject({ centavos: 480000, value: 4800 })
  })
})

describe('parseMoneyInput: worksheets TB:W17 and BUG:W1-W4', () => {
  it("TB:W17 '12,345.67' and '12345.67' -> 12,345.67", () => {
    expect(ok('12,345.67')).toMatchObject({ centavos: 1234567, value: 12345.67 })
    expect(ok('12345.67')).toMatchObject({ centavos: 1234567, value: 12345.67 })
  })
  it("BUG:W1 2307 credit '4,800.00' -> 4,800.00 (not 480,000)", () => {
    expect(ok('4,800.00').value).toBe(4800)
  })
  it("BUG:W2 gross '480,000.50' -> 480,000.50 (not 48,000,050)", () => {
    expect(ok('480,000.50')).toMatchObject({ centavos: 48000050, value: 480000.5 })
  })
  it("BUG:W3 tax due '1,234.56' -> 1,234.56 (not 123,456)", () => {
    expect(ok('1,234.56').value).toBe(1234.56)
  })
  it("BUG:W4 salary '15,000.75' -> 15,000.75 (not 1,500,075)", () => {
    expect(ok('15,000.75')).toMatchObject({ centavos: 1500075, value: 15000.75 })
  })
})

describe('parseMoneyInput: other edge inputs', () => {
  it("'₱480,000.00' pasted with the peso sign", () => {
    expect(ok('₱480,000.00').value).toBe(480000)
  })
  it("'480,000.' keeps the trailing point while typing -> 480,000", () => {
    expect(ok('480,000.')).toMatchObject({ centavos: 48000000, value: 480000 })
  })
  it("'.5' -> 0.50 and '.' alone -> 0", () => {
    expect(ok('.5').centavos).toBe(50)
    expect(ok('.').centavos).toBe(0)
  })
  it("'12.345' (3 decimals) is rejected with a message", () => {
    expect(rejected('12.345').error).toMatch(/2 decimals/i)
  })
  it('two decimal points are rejected', () => {
    expect(rejected('1.2.3').error).toMatch(/one decimal point/i)
  })
  it('a decimal comma is rejected rather than read as thousands', () => {
    expect(rejected('4800,00').error).toMatch(/period/i)
    expect(rejected('1.234,56').error).toMatch(/period/i)
  })
  it('a comma moved by editing the middle of the number is still read as thousands', () => {
    // M16: cursor after the 4 in "480,000", type 5
    expect(ok('4580,000').value).toBe(4580000)
    expect(ok('1,2834,567').value).toBe(12834567)
  })
  it('with allowShortGroups (while deleting digits) "4,80" reads as 480', () => {
    expect(parseMoneyInput('4,80', { allowShortGroups: true })).toMatchObject({ ok: true, centavos: 48000 })
    expect(parseMoneyInput('4,80').ok).toBe(false)
  })
  it('spaces and a non-breaking space are ignored', () => {
    expect(ok(' 1 000.50 ').centavos).toBe(100050)
    expect(ok('₱ 2,500').centavos).toBe(250000)
  })
  it('the largest allowed amount is ₱999,999,999,999.99', () => {
    expect(ok('999,999,999,999.99').centavos).toBe(MAX_MONEY_CENTAVOS)
    expect(MAX_MONEY_CENTAVOS).toBe(99999999999999)
    expect(rejected('1,000,000,000,000').error).toMatch(/too large/i)
    expect(rejected('99999999999999999999').error).toMatch(/too large/i)
  })
  it('leading zeros are fine', () => {
    expect(ok('007').centavos).toBe(700)
  })
  it('other signs and symbols are rejected', () => {
    rejected('+500')
    rejected('12.5%')
    rejected('P1,000')
    expect(rejected('−500').error).toMatch(/minus/i) // Unicode minus
  })
})

describe('formatMoneyInput: thousands separators added when the box loses focus', () => {
  it('whole pesos have no decimals', () => {
    expect(formatMoneyInput(480000)).toBe('480,000')
    expect(formatMoneyInput(4800)).toBe('4,800')
    expect(formatMoneyInput(0)).toBe('0')
  })
  it('centavos keep two decimals', () => {
    expect(formatMoneyInput(1234.56)).toBe('1,234.56')
    expect(formatMoneyInput(480000.5)).toBe('480,000.50')
    expect(formatMoneyInput(0.5)).toBe('0.50')
    expect(formatMoneyInput(999999999999.99)).toBe('999,999,999,999.99')
  })
  it('an empty value stays empty (no forced 0)', () => {
    expect(formatMoneyInput(null)).toBe('')
    expect(formatMoneyInput(undefined)).toBe('')
    expect(formatMoneyInput('')).toBe('')
  })
})

describe('parseIntegerInput: whole-number boxes (Days late, Months in)', () => {
  it('reads whole numbers', () => {
    expect(parseIntegerInput('60')).toMatchObject({ ok: true, value: 60, empty: false })
    expect(parseIntegerInput(' 1,000 ')).toMatchObject({ ok: true, value: 1000 })
    expect(parseIntegerInput('')).toMatchObject({ ok: true, value: 0, empty: true })
  })
  it('rejects decimals, minus signs and letters with a message', () => {
    expect(parseIntegerInput('6.5').error).toMatch(/whole number/i)
    expect(parseIntegerInput('-3').error).toMatch(/minus/i)
    expect(parseIntegerInput('1e3').error).toMatch(/digits/i)
  })
  it('gives a message instead of clamping when outside min/max', () => {
    const r = parseIntegerInput('18', { min: 1, max: 12 })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Enter a number from 1 to 12.')
    expect(parseIntegerInput('12', { min: 1, max: 12 })).toMatchObject({ ok: true, value: 12 })
    expect(parseIntegerInput('0', { min: 1, max: 12 }).ok).toBe(false)
  })
  it('an empty box is out of range when 0 is below min', () => {
    expect(parseIntegerInput('', { min: 1, max: 12 }).ok).toBe(false)
  })
  it('formats with thousands separators', () => {
    expect(formatIntegerInput(3650)).toBe('3,650')
    expect(formatIntegerInput(null)).toBe('')
  })
})
