// The laws amending the Tax Code that the rules follow, in the order they were
// signed (L12). Used by the footer and the References "Primary statutes" box.
export const STATUTES = [
  { ra: 'RA 10963', name: 'TRAIN', title: 'the TRAIN Law', year: 2017, signed: '2017-12-19', covers: 'individual rate tables, 8% option, withholding structure' },
  { ra: 'RA 11534', name: 'CREATE', title: 'CREATE', year: 2021, signed: '2021-03-26', covers: 'corporate rates, MCIT reduction window, percentage-tax window' },
  { ra: 'RA 11976', name: 'Ease of Paying Taxes Act', title: 'the Ease of Paying Taxes Act', year: 2024, signed: '2024-01-05', covers: 'invoicing, classification, penalty reductions, filing venue' },
  { ra: 'RA 12023', name: 'VAT on Digital Services', title: 'the VAT on Digital Services Act', year: 2024, signed: '2024-10-02', covers: '12% VAT on digital services, including those of nonresident providers' },
  { ra: 'RA 12066', name: 'CREATE MORE', title: 'CREATE MORE', year: 2024, signed: '2024-11-08', covers: 'RBE enhanced-deduction regime, 20% RBE rate' },
]

// 'the TRAIN Law (RA 10963), CREATE (RA 11534), ... and CREATE MORE (RA 12066)'
export function statuteListText() {
  const parts = STATUTES.map(s => `${s.title} (${s.ra})`)
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
