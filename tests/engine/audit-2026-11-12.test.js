// Audit of November 12, 2026 (AUDIT-2026-11-12.md): the law, calendar and
// calculator changes. Each test names the finding it covers.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import holidaysData from '../../src/data/rules/holidays.json'
import businessTax from '../../src/data/rules/business-tax.json'
import ewt from '../../src/data/rules/ewt-rates.json'
import { OBLIGATIONS, HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import {
  generateDeadlines, generateChecklist, regionalExtensionFor, pendingHolidayNotes, unconfirmedExtensionReason, isUnconfirmed,
} from '../../src/engine/deadlines.js'
import { deadlineNotes } from '../../src/lib/exports.js'
import { defaultProfile, changeProfileType } from '../../src/engine/profile.js'
import { estimateCorporateQuarter, estimateCorporation } from '../../src/engine/estimators/corporation.js'
import { fromISO, iso } from '../../src/engine/dates.js'

const gen = (p, from, to) => generateDeadlines(OBLIGATIONS, p, { from: fromISO(from), to: fromISO(to), holidays: HOLIDAY_SET, refDate: fromISO(from) })
const of = (list, id) => list.filter(d => d.obligation.id === id)
const dates = (list, id) => of(list, id).map(d => iso(d.date))
const checklist = p => generateChecklist(OBLIGATIONS, p, { today: fromISO('2026-11-12') }).map(o => o.id)
const freelancer = { ...defaultProfile('individual'), name: 'F', regime: 'graduated_osd' }
const employer = { ...freelancer, hasEmployees: true, withholdsEwt: true, withholdsFwt: true }
const corp = { ...defaultProfile('corporation'), name: 'C' }

describe('L1: Metro Manila offices may file returns due Nov 16-18, 2026 until Nov 19 (BIR tax advisory)', () => {
  it('the rulebook records it as an extension for one region and one agency', () => {
    expect(holidaysData.regionalExtensions.value).toEqual([expect.objectContaining({
      region: 'NCR', agency: 'BIR', dates: ['2026-11-16', '2026-11-17', '2026-11-18'], newDate: '2026-11-19',
    })])
    expect(regionalExtensionFor('2026-11-16', 'BIR').newDate).toBe('2026-11-19')
    expect(regionalExtensionFor('2026-11-16', 'PhilHealth')).toBeNull()
    expect(regionalExtensionFor('2026-11-19', 'BIR')).toBeNull()
    expect(holidaysData.regionalHolidays.notes).not.toContain('no BIR')
  })
  it('the Q3 2026 1701Q stays on Mon Nov 16 (the national date) and carries the Nov 19 note', () => {
    const [q3] = of(gen(freelancer, '2026-11-01', '2026-11-30'), 'bir-1701q')
    expect(iso(q3.date)).toBe('2026-11-16')
    expect(q3.regionalHoliday.region).toBe('NCR')
    expect(q3.regionalExtension.newDate).toBe('2026-11-19')
    expect(deadlineNotes(q3)).toContain('NCR-only holiday: BIR tax advisory of November 2026 allows until 2026-11-19')
  })
  it('a PhilHealth date on the same day gets no extension (none was found for that agency)', () => {
    const ph = of(gen(employer, '2026-11-01', '2026-11-30'), 'philhealth-employer').find(d => iso(d.date) === '2026-11-16')
    expect(ph.regionalHoliday.region).toBe('NCR')
    expect(ph.regionalExtension).toBeNull()
    expect(deadlineNotes(ph)).toContain('NCR-only holiday; national date shown')
  })
})

describe('L2: RMC 118-2026 moved returns due Nov 10, 2026 (eBIRForms) to Nov 13', () => {
  const list = gen(employer, '2026-11-01', '2026-11-30')
  it.each(['bir-1601c', 'bir-0619e', 'bir-0619f'])('%s for October 2026 is shown on Nov 13, with its scope', id => {
    const [d] = of(list, id)
    expect(iso(d.date)).toBe('2026-11-13')
    expect(d.extended.basis).toBe('RMC 118-2026')
    expect(d.extended.scope).toBe('For returns filed through eBIRForms; eFPS dates did not move.')
  })
  it('the list of returns in the circular was not seen, so these dates are flagged unconfirmed', () => {
    const [d] = of(list, 'bir-1601c')
    expect(isUnconfirmed(d)).toBe(true)
    expect(d.confidenceReasons).toEqual([unconfirmedExtensionReason('RMC 118-2026')])
    // The rule itself is confirmed: the month before and the month after are not flagged.
    expect(isUnconfirmed(of(gen(employer, '2026-12-01', '2026-12-31'), 'bir-1601c')[0])).toBe(false)
  })
  it('Pag-IBIG, due the same day, is not moved by a BIR circular', () => {
    expect(dates(list, 'pagibig-employer')).toEqual(['2026-11-10'])
  })
})

describe('L3 / D1: RMC 115-2026 moved the Q3 2026 Forms 2550Q and 2551Q to Oct 29, 2026', () => {
  it('percentage tax and VAT returns', () => {
    expect(dates(gen(freelancer, '2026-10-01', '2026-10-31'), 'bir-2551q')).toEqual(['2026-10-29'])
    expect(dates(gen({ ...freelancer, vatRegistered: true }, '2026-10-01', '2026-10-31'), 'bir-2550q')).toEqual(['2026-10-29'])
  })
  it('the SLSP is left on its own date (whether the circular covers it was not confirmed)', () => {
    expect(dates(gen({ ...freelancer, vatRegistered: true }, '2026-10-01', '2026-10-31'), 'bir-slsp')).toEqual(['2026-10-26'])
  })
})

describe('D2: monthly eSales report for cash register / POS users', () => {
  it('is dated on the 8th of the following month, moved off holidays, and flagged unconfirmed', () => {
    const list = gen({ ...freelancer, usesCrmPos: true }, '2026-12-01', '2027-01-31')
    expect(dates(list, 'bir-esales')).toEqual(['2026-12-09', '2027-01-08']) // Dec 8, 2026 is a holiday
    expect(of(list, 'bir-esales').every(isUnconfirmed)).toBe(true)
  })
  it('is not shown without a cash register or POS', () => {
    expect(dates(gen(freelancer, '2026-12-01', '2027-01-31'), 'bir-esales')).toEqual([])
  })
})

describe('D3: mandatory e-invoicing (Dec 31, 2026) is shown to computerized-accounting users only', () => {
  it('a POS user on manual books no longer gets it; a CAS user does', () => {
    expect(dates(gen({ ...freelancer, usesCrmPos: true }, '2026-11-12', '2027-03-31'), 'bir-einvoicing')).toEqual([])
    expect(dates(gen({ ...freelancer, booksType: 'cas' }, '2026-11-12', '2027-03-31'), 'bir-einvoicing')).toEqual(['2026-12-31'])
  })
})

describe('D4, L11: new checklist items', () => {
  it('corporations: beneficial owners go in the SEC HARBOR registry', () => {
    expect(checklist(corp)).toContain('sec-harbor-bo')
    expect(checklist(freelancer)).not.toContain('sec-harbor-bo')
  })
  it('businesses: 12% VAT on digital services bought abroad (Form 1600-VT); not for employees', () => {
    expect(checklist(freelancer)).toContain('bir-1600vt-digital')
    expect(checklist(corp)).toContain('bir-1600vt-digital')
    expect(checklist(defaultProfile('employee'))).not.toContain('bir-1600vt-digital')
    expect(businessTax.digitalServicesVat.value).toContain('whether VAT-registered or not')
  })
})

describe('D6: quarterly installments of local business tax are dated', () => {
  it('April 20, July 20 and October 20 for a profile with a place of business', () => {
    expect(dates(gen(freelancer, '2027-01-01', '2027-12-31'), 'lgu-business-tax-quarterly')).toEqual(['2027-04-20', '2027-07-20', '2027-10-20'])
    expect(dates(gen({ ...freelancer, hasBusinessEstablishment: false }, '2027-01-01', '2027-12-31'), 'lgu-business-tax-quarterly')).toEqual([])
  })
})

describe('D7: a mixed-income earner is reminded to collect Form 2316', () => {
  it('January 31 moves to the next working day (Mon Feb 1, 2027)', () => {
    expect(dates(gen({ ...defaultProfile('mixed'), name: 'M' }, '2027-01-01', '2027-02-28'), 'bir-2316-collect')).toEqual(['2027-02-01'])
  })
})

describe('D9: holidays proclaimed separately are named while they are pending', () => {
  it('Eid 2027: shown when 2027 is in the window, until the end of May 2027', () => {
    expect(pendingHolidayNotes(fromISO('2026-11-12'), fromISO('2027-12-17')).map(n => n.year)).toEqual([2027])
    expect(pendingHolidayNotes(fromISO('2026-11-12'), fromISO('2026-12-31'))).toEqual([])
    expect(pendingHolidayNotes(fromISO('2027-06-01'), fromISO('2028-06-30'))).toEqual([])
  })
})

describe('L5: NOLCO is deducted on the quarterly corporate return too (RR 14-2001)', () => {
  const base = { quarter: 1, grossSales: 1000000, costOfSales: 0, opex: 700000, taxYear: 2026, registrationYear: 2015, totalAssets: 1000000 }
  it('gross 1,000,000, expenses 700,000, NOLCO 200,000: taxable income to date 100,000 (was 300,000)', () => {
    const q = estimateCorporateQuarter({ ...base, nolcoPrior: 200000 })
    expect(q.taxableIncome).toBe(100000)
    expect(q.nolcoApplied).toBe(200000)
    expect(q.rcit).toBe(20000) // 20% of 100,000
    expect(estimateCorporateQuarter(base).taxableIncome).toBe(300000)
  })
  it('never against the MCIT, never more than the net income, and not in an OSD year', () => {
    const q = estimateCorporateQuarter({ ...base, nolcoPrior: 5000000 })
    expect(q.taxableIncome).toBe(0)
    expect(q.nolcoApplied).toBe(300000)
    expect(q.mcit).toBe(20000) // 2% of gross income, unchanged
    expect(q.taxDue).toBe(20000)
    expect(estimateCorporateQuarter({ ...base, deduction: 'osd', nolcoPrior: 200000 }).nolcoApplied).toBe(0)
  })
  it('the quarter and the year agree on the same figures', () => {
    const y = estimateCorporation({ grossSales: 1000000, costOfSales: 0, opex: 700000, nolcoPrior: 200000, taxYear: 2026, registrationYear: 2015, totalAssets: 1000000 })
    expect(y.taxableIncome).toBe(100000)
  })
})

describe('L6, L7, L9, L10: rule texts', () => {
  it('commissions carry their own tax codes, not the professional-fee codes', () => {
    const row = ewt.rates.value.find(r => r.payee.startsWith('Commissions'))
    expect(row.atc).toContain('WI139/WI140')
    expect(row.atc).toContain('WI515/WI516')
    expect(row.atc).not.toContain('WI010')
    expect(ewt.rates.value.every(r => r.atc !== '—')).toBe(true)
  })
  it('VAT registration after passing ₱3M: within the following month (RR 8-2018), now confirmed', () => {
    expect(businessTax.vatRegistrationDeadline.confidence).toBe('verified')
    expect(businessTax.vatRegistrationDeadline.value).toContain('within the month after the month your sales passed ₱3M')
  })
  it('the user-facing abatement note no longer carries maintenance wording', () => {
    const o = obligationsData.obligations.find(x => x.id === 'bir-micro-abatement-2026')
    expect(o.notes).not.toMatch(/hidden from|Time-boxed/)
  })
})

describe('U10: changing the taxpayer type in the wizard', () => {
  it('a NEW profile takes the new type\'s defaults for answers nobody touched (a new corporation withholds expanded tax)', () => {
    const fresh = defaultProfile('individual') // the wizard's starting point; no id yet
    expect(fresh.withholdsEwt).toBe(false)
    const c = changeProfileType({ ...fresh, name: 'New Corp' }, 'corporation')
    expect(c.withholdsEwt).toBe(true)
    expect(dates(gen(c, '2027-01-01', '2027-03-31'), 'bir-0619e').length).toBeGreaterThan(0)
  })
  it('an answer the user changed is carried over', () => {
    const c = changeProfileType({ ...defaultProfile('individual'), name: 'X', vatRegistered: true, hasEmployees: true }, 'corporation')
    expect(c.vatRegistered).toBe(true)
    expect(c.hasEmployees).toBe(true)
  })
  it('a SAVED self-employed profile changed to a corporation gets expanded withholding switched on for review', () => {
    const saved = { ...defaultProfile('individual'), id: 'p-1', name: 'Saved' }
    expect(changeProfileType(saved, 'corporation').withholdsEwt).toBe(true)
  })
  it('a saved corporation changed to self-employed keeps its switches (nothing is silently switched off)', () => {
    const saved = { ...defaultProfile('corporation'), id: 'c-1', name: 'Saved Corp', hasEmployees: true }
    const after = changeProfileType(saved, 'individual')
    expect(after.withholdsEwt).toBe(true)
    expect(after.hasEmployees).toBe(true)
  })
})
