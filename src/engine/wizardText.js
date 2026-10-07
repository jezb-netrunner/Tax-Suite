// Profile setup card text (src/pages/ProfileWizard.jsx), built from the
// profile type so each taxpayer is told the right thing.

import { calendarYearDue } from './rulebook.js'
import { annualReturnForm } from './estimators/individual.js'
import { RT } from './ruleText.js'

// Text of the income-tax regime cards: { '8pct', graduated_osd, graduated_itemized }.
//
// H08: the annual return depends on the profile type. Form 1701A is only for
// individuals earning income purely from business or profession, on 8% or
// graduated rates with the OSD (RMC 17-2019); a mixed-income earner (salary
// plus business) files Form 1701 whatever the deduction method. For a
// mixed-income earner the 8% replaces graduated rates and percentage tax on
// the business income only, with no ₱250,000 reduction (RR 8-2018); the
// salary stays on graduated rates.
export function regimeCardText({ type, vatRegistered }) {
  const mixed = type === 'mixed'
  const form = regime => annualReturnForm({ mixed, regime })
  if (vatRegistered) {
    return {
      graduated_osd: `${RT.osdRate} Optional Standard Deduction: simpler books, files ${form('graduated_osd')}${mixed ? ' (mixed income)' : ''}.`,
      graduated_itemized: `Actual documented expenses: files the full ${form('graduated_itemized')}.`,
    }
  }
  if (mixed) {
    return {
      '8pct': `${RT.eightRate} on business gross sales (no ${RT.eightAllowance} reduction), in lieu of graduated rates and percentage tax on the business income; your salary stays on graduated rates. Elected each year on the Q1 return; files ${form('8pct')}.`,
      graduated_osd: `Graduated rates on your salary plus business income after the ${RT.osdRate} Optional Standard Deduction, plus ${RT.percentageTaxRate} percentage tax on business sales; files ${form('graduated_osd')}.`,
      graduated_itemized: `Graduated rates on your salary plus business income after actual documented expenses, plus ${RT.percentageTaxRate} percentage tax on business sales; files ${form('graduated_itemized')}.`,
    }
  }
  return {
    '8pct': `${RT.eightRate} on gross above ${RT.eightAllowance}, in lieu of graduated rates and percentage tax. Elected each year on the Q1 return; files ${form('8pct')}.`,
    graduated_osd: `Graduated rates on income after the ${RT.osdRate} Optional Standard Deduction, plus ${RT.percentageTaxRate} percentage tax; files ${form('graduated_osd')}.`,
    graduated_itemized: `Graduated rates on income after actual documented expenses, plus ${RT.percentageTaxRate} percentage tax; files the full ${form('graduated_itemized')}.`,
  }
}

// Text of the books-of-accounts cards: { looseleaf, cas, summary }.
//
// H11: built from the obligation rules (bir-looseleaf-books and bir-cas-books:
// a number of days after the taxable year ends), so a fiscal-year taxpayer is
// not told "January". fyEndMonth (1-12) adds that year-end's own dates.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function booksCardText(obligations, fyEndMonth = 12) {
  const rule = id => {
    const ob = obligations.find(o => o.id === id)
    return ob && ob.schedule
  }
  const loose = rule('bir-looseleaf-books')
  const cas = rule('bir-cas-books')
  const days = s => `${s.daysAfterEnd} days`
  const cal = s => calendarYearDue(s, { short: true })
  const own = s => calendarYearDue(s, { short: true, fyEndMonth })
  let summary = `Loose-leaf and computerized books are due ${days(loose)} (loose-leaf) / ${days(cas)} (computerized) after your taxable year ends (${cal(loose)} / ${cal(cas)} for calendar-year taxpayers).`
  if (fyEndMonth !== 12) summary += ` For your taxable year ending in ${MONTHS[fyEndMonth - 1]}: ${own(loose)} / ${own(cas)}.`
  return {
    looseleaf: `Printed/bound records under a BIR permit; bound copies due ${days(loose)} after your taxable year ends (${cal(loose)} for calendar-year taxpayers).`,
    cas: `BIR-registered accounting system; annual back-up/registration due ${days(cas)} after your taxable year ends (${cal(cas)} for calendar-year taxpayers).`,
    summary,
  }
}
