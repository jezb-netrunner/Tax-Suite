// Deadline-completeness audit: prints every dated obligation the engine
// generates for one profile of each taxpayer type over a TY window, plus the
// checklist set — the review artifact for a CPA checking the rulebook.
// Run: npm run audit:calendar
import obligationsData from '../src/data/rules/obligations.json'
import holidaysData from '../src/data/rules/holidays.json'
import { generateDeadlines, generateChecklist } from '../src/engine/deadlines.js'
import { defaultProfile } from '../src/engine/profile.js'
import { fromISO, iso } from '../src/engine/dates.js'

const OB = obligationsData.obligations
const HOLIDAYS = new Set(holidaysData.holidays.map(h => h.date))

const profiles = [
  ['EMPLOYEE (single employer)', { ...defaultProfile('employee'), name: 'E' }],
  ['EMPLOYEE (two employers, licensed professional)', { ...defaultProfile('employee'), name: 'E2', multipleEmployers: true, licensedProfessional: true }],
  ['SELF-EMPLOYED 8% (freelancer, no LGU premises)', { ...defaultProfile('individual'), name: 'F', regime: '8pct', hasBusinessEstablishment: false }],
  ['SOLE PROP graduated non-VAT + employees + EWT + LGU + DTI + inventory', { ...defaultProfile('individual'), name: 'S', regime: 'graduated_osd', hasEmployees: true, withholdsEwt: true, dtiRegistered: true, sellsGoods: true }],
  ['MIXED INCOME 8% on business', { ...defaultProfile('mixed'), name: 'M', regime: '8pct' }],
  ['CORPORATION calendar-year VAT + employees + EWT + CAS books', { ...defaultProfile('corporation'), name: 'C', vatRegistered: true, hasEmployees: true, withholdsEwt: true, booksType: 'cas', registrationYear: 2021, sellsGoods: true }],
  ['CORPORATION fiscal year ending June 30, non-VAT', { ...defaultProfile('corporation'), name: 'CF', fiscalYearEndMonth: 6, vatRegistered: false }],
]

for (const [label, p] of profiles) {
  const list = generateDeadlines(OB, p, {
    from: fromISO('2026-01-01'), to: fromISO('2027-04-30'), holidays: HOLIDAYS, refDate: fromISO('2026-01-01'),
  })
  console.log(`\n### ${label} — ${list.length} dated occurrences (2026-01-01 → 2027-04-30)`)
  for (const d of list) {
    const shift = d.shifted ? `  [moved from ${iso(d.rawDate)} (${d.shiftReason})]` : ''
    console.log(`${iso(d.date)}  ${(d.obligation.form || '—').padEnd(14)} ${d.obligation.title}${d.label ? ' — ' + d.label : ''}${shift}`)
  }
  const cl = generateChecklist(OB, p)
  console.log(`  checklist: ${cl.map(o => o.id).join(', ')}`)
}
