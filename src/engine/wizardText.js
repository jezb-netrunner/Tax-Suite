// Profile setup card text (src/pages/ProfileWizard.jsx), built from the
// profile type so each taxpayer is told the right thing.

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
  if (vatRegistered) {
    return {
      graduated_osd: `40% Optional Standard Deduction: simpler books, files ${mixed ? '1701 (mixed income)' : '1701A'}.`,
      graduated_itemized: 'Actual documented expenses: files the full 1701.',
    }
  }
  if (mixed) {
    return {
      '8pct': '8% on business gross sales (no ₱250,000 reduction), in lieu of graduated rates and percentage tax on the business income; your salary stays on graduated rates. Elected each year on the Q1 return; files 1701.',
      graduated_osd: 'Graduated rates on your salary plus business income after the 40% Optional Standard Deduction, plus 3% percentage tax on business sales; files 1701.',
      graduated_itemized: 'Graduated rates on your salary plus business income after actual documented expenses, plus 3% percentage tax on business sales; files 1701.',
    }
  }
  return {
    '8pct': '8% on gross above ₱250,000, in lieu of graduated rates and percentage tax. Elected each year on the Q1 return; files 1701A.',
    graduated_osd: 'Graduated rates on income after the 40% Optional Standard Deduction, plus 3% percentage tax; files 1701A.',
    graduated_itemized: 'Graduated rates on income after actual documented expenses, plus 3% percentage tax; files the full 1701.',
  }
}
