import { describe, it, expect } from 'vitest'
import {
  toCentavos, fromCentavos, rate, mulRate, mulFrac, divRoundHalfUp, roundHalfUp, toWholePesos,
  pesoLine, centavoLine, sumCentavos, formatPesos, formatCentavos, groupThousands,
} from '../../src/lib/money.js'
import { money, money2 } from '../../src/lib/format.js'

// M03: one money module. Amounts are integer centavos; rates are exact
// fractions; one half-up rule (on the size of the amount).

describe('centavo conversion is exact', () => {
  it('pesos with up to 2 decimals become whole centavos', () => {
    expect(toCentavos(1234.56)).toBe(123456)
    expect(toCentavos(0.1 + 0.2)).toBe(30) // float noise snaps to the centavo
    expect(toCentavos(999999999999.99)).toBe(99999999999999)
    expect(toCentavos(-2.5)).toBe(-250)
    expect(toCentavos('')).toBe(0)
  })
  it('centavos become the expected peso Number', () => {
    expect(fromCentavos(320)).toBe(3.2)
    expect(fromCentavos(1278150)).toBe(12781.5)
    expect(fromCentavos(42)).toBe(0.42)
  })
})

describe('rates are exact fractions', () => {
  it('reads rulebook decimals exactly', () => {
    expect(rate(0.15)).toEqual({ num: 15n, den: 100n })
    expect(rate('0.035')).toEqual({ num: 35n, den: 1000n })
    expect(rate(0.4)).toEqual({ num: 4n, den: 10n })
    expect(rate([52, 12])).toEqual({ num: 52n, den: 12n })
  })
})

describe('one rounding rule: half-up on the size of the amount', () => {
  it('to the centavo', () => {
    expect(mulRate(2130, 0.15)).toBe(320)      // 21.30 × 15% = 3.195 -> 3.20 (WH:WS-20)
    expect(mulRate(277, 0.15)).toBe(42)        // 2.77 × 15% = 0.4155 -> 0.42
    expect(mulRate(-2130, 0.15)).toBe(-320)
    expect(divRoundHalfUp(5, 10)).toBe(1)
    expect(divRoundHalfUp(-5, 10)).toBe(-1)
    expect(divRoundHalfUp(4, 10)).toBe(0)
  })
  it('BIR whole-peso line: 49 centavos or less drop, 50 or more round up', () => {
    expect(toWholePesos(1278149)).toBe(1278100)
    expect(toWholePesos(1278150)).toBe(1278200)
    expect(toWholePesos(855)).toBe(900)        // ₱8.55 -> ₱9 (TI:WS-21)
    expect(toWholePesos(849)).toBe(800)
    expect(toWholePesos(-250)).toBe(-300)      // −₱2.50 -> −₱3
    expect(toWholePesos(-249)).toBe(-200)
    expect(pesoLine(12781.5)).toBe(12782)
    expect(pesoLine(166704.4)).toBe(166704)
    expect(centavoLine(3.195)).toBe(3.2)
    expect(roundHalfUp(12345, 50000)).toBe(0)
  })
  it('large products use BigInt and stay exact', () => {
    // ₱999,999,999,999.99 × 12% × 3,650 / 365 days = ₱1,199,999,999,999.988 -> .99
    expect(mulFrac(99999999999999, 12n * 3650n, 100n * 365n)).toBe(119999999999999)
    expect(mulRate(99999999999999, 0.35)).toBe(35000000000000) // 34,999,999,999,999.65 centavos -> up
  })
  it('sums are exact', () => {
    expect(sumCentavos(1234567, 308642, 12177, 500000)).toBe(2055386)
  })
})

describe('display formatting never re-rounds wrongly', () => {
  it('whole pesos', () => {
    expect(formatPesos(1278150)).toBe('₱12,782')
    expect(formatPesos(-250)).toBe('−₱3')
    expect(formatPesos(-40)).toBe('₱0')
    expect(money(2.5)).toBe('₱3')
    expect(money(-2.5)).toBe('−₱3')
    expect(money(12781.499999999998)).toBe('₱12,782') // a float-noise half still rounds up
    expect(money(11362.499999999998)).toBe('₱11,363')
    expect(money(0)).toBe('₱0')
    expect(money(-0.4)).toBe('₱0')
  })
  it('centavos', () => {
    expect(formatCentavos(320)).toBe('₱3.20')
    expect(formatCentavos(-123456)).toBe('−₱1,234.56')
    expect(money2(3.1949999999998906)).toBe('₱3.19') // the value itself is 3.19…; engine now returns 3.2
    expect(money2(3.2)).toBe('₱3.20')
    expect(money2(-0.5)).toBe('−₱0.50')
    expect(money2(1234567.891)).toBe('₱1,234,567.89')
    expect(money2(0)).toBe('₱0.00')
  })
  it('groups thousands', () => {
    expect(groupThousands(1234567)).toBe('1,234,567')
    expect(groupThousands(999)).toBe('999')
  })
})
