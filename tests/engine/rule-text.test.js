// H16: tax numbers in words come from the rulebook (src/engine/ruleText.js).
import { describe, it, expect } from 'vitest'
import {
  RT, percentText, pesoText, pesoMillions, ordinal, countText, payFactorText, fixedHolidayExamples,
  dueDayText, quarterlyDaysText, whenText, monthlyRemitText, daysAfterEnd, dayOfMonthText, daysBetweenDueDays,
} from '../../src/engine/ruleText.js'
import { ruleRegister } from '../../src/engine/rulebook.js'
import { pct } from '../../src/lib/format.js'
import meta from '../../src/data/rules/meta.json'
import corp from '../../src/data/rules/corporate.json'

describe('formatters (H16)', () => {
  it('percentText is exact', () => {
    expect(percentText(0.08)).toBe('8%')
    expect(percentText(0.125)).toBe('12.5%')
    expect(percentText(0.005)).toBe('0.5%')
    expect(percentText(0.4)).toBe('40%')
    expect(pct(0.125)).toBe('12.5%') // the Tools helper uses the same exact rule
  })
  it('pesoText, pesoMillions, ordinal, countText', () => {
    expect(pesoText(3000000)).toBe('₱3,000,000')
    expect(pesoText(755.5)).toBe('₱755.50')
    expect(pesoMillions(3000000)).toBe('₱3M')
    expect(pesoMillions(100000000)).toBe('₱100M')
    expect(pesoMillions(250000)).toBe('₱250,000')
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd'])
    expect(countText(1, 'year')).toBe('1 year')
    expect(countText(3, 'year')).toBe('3 years')
  })
})

describe('rule values in words (H16)', () => {
  it('match the rulebook today', () => {
    expect(RT).toMatchObject({
      zeroBandTop: '₱250,000', eightRate: '8%', eightAllowance: '₱250,000', eightCeiling: '₱3,000,000', eightCeilingShort: '₱3M',
      osdRate: '40%', thirteenthMonthCap: '₱90,000', auditedFsAboveShort: '₱3M', nolcoYears: '3 years', nolcoPandemicYears: '5 years',
      nolcoPandemicLossYears: '2020 and 2021',
      vatThreshold: '₱3,000,000', vatThresholdShort: '₱3M', vatRate: '12%', percentageTaxRate: '3%', invoiceThreshold: '₱500',
      rcitStandard: '25%', rcitSmall: '20%', smallCorpIncomeShort: '₱5M', smallCorpAssetsShort: '₱100M',
      mcitRate: '2%', mcitStartYear: '4th', mcitCarryYears: '3 years', corpOsdRate: '40%',
      microBelowShort: '₱3M', smallFromShort: '₱3M', smallBelowShort: '₱20M',
      sssMscCeiling: '₱35,000', sssWispThreshold: '₱20,000',
      pfIndividualLowerRate: '5%', pfIndividualStandardRate: '10%', fbtRate: '35%', fbtGrossUpDivisor: '65%',
      substantialUnderdeclaration: '30%', withholdingTablesFrom: 2023,
    })
  })
  it('pay factors and holiday examples', () => {
    expect(payFactorText(365)).toBe('365 (paid every day)')
    expect(payFactorText(313)).toBe('313 (six-day week)')
    expect(payFactorText(261)).toBe('261 (five-day week)')
    expect(fixedHolidayExamples()).toBe('May 1 and June 12')
  })
})

describe('due dates in words, from obligations.json (H16)', () => {
  it('the form guide "when" texts', () => {
    expect(quarterlyDaysText('bir-1701q')).toBe('May 15 · Aug 15 · Nov 15')
    expect(whenText('bir-1701a-annual')).toBe('April 15')
    expect(whenText('bir-1702q')).toBe('60 days after each quarter')
    expect(whenText('bir-1702-annual')).toBe('15th day of the 4th month after year-end')
    expect(whenText('bir-2551q')).toBe('25 days after each quarter')
    expect(whenText('bir-1601c')).toBe('10th of the following month (Dec: Jan 15)')
    expect(whenText('bir-0619e')).toBe('10th of the following month (months 1–2 of each quarter)')
    expect(whenText('bir-1601eq')).toBe('Last day of the month after each quarter')
    expect(whenText('bir-1604e')).toBe('March 1')
    expect(whenText('bir-inventory-list')).toBe('30 days after year-end')
    expect(dueDayText('bir-2316-issue', { short: true })).toBe('Jan 31')
    expect(dueDayText('lgu-cedula')).toBe('last day of February')
    expect(daysAfterEnd('bir-2307-issue')).toBe(20)
    expect(dayOfMonthText('bir-0619f')).toBe('10th')
    expect(monthlyRemitText('bir-1601c')).toBe('by the 10th of the following month (Jan 15 for December)')
    expect(daysBetweenDueDays('bir-1701a-annual', 'bir-eafs-itr-attachments-individual')).toBe(15)
  })
})

describe('rulebook values the app never read are wired up or gone (H16)', () => {
  it('meta.taxYearDefault is gone (the year comes from the Manila date)', () => {
    expect(meta).not.toHaveProperty('taxYearDefault')
  })
  it('meta.json no longer says rule changes need no code at all', () => {
    expect(meta.howToUpdate).not.toMatch(/No code changes needed\./)
    expect(meta.howToUpdate).toMatch(/still needs a code change/)
  })
  it('the MCIT start is a number the estimator uses; the duplicate carry-forward is gone', () => {
    expect(corp.mcit.value.startsInTaxableYear).toBe(4)
    expect(corp.excessMcitCredit.value).not.toHaveProperty('carryForwardYears')
  })
  it('the de minimis effective date is shown on the References page', () => {
    const reg = ruleRegister()
    const all = [...reg.computation]
    const dm = all.find(r => r.id === 'withholding-compensation.json:deMinimis')
    expect(dm).toBeTruthy()
    const fields = dm.value.fields.map(f => [f.label, f.value.text])
    expect(fields).toContainEqual(['Effective from', 'Jan 6, 2026'])
  })
})
