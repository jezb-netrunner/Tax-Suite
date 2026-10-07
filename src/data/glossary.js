// Plain-language meaning of the codes shown on calendar chips and forms
// (L15). Used for the chip tooltips (src/components/FormCode.jsx), the
// calendar row "Details", and the glossary on the Forms page.
export const GLOSSARY = [
  { code: 'PRN', name: 'Payment Reference Number', meaning: 'The number you generate in your My.SSS account for each SSS payment.' },
  { code: 'R-5', name: 'SSS Form R-5', meaning: 'The SSS contribution payment form for employers; payments now go through a PRN.' },
  { code: 'SPA', name: 'Statement of Premium Account', meaning: 'The PhilHealth bill you generate before paying premiums.' },
  { code: 'EPRS', name: 'Electronic Premium Reporting System', meaning: 'PhilHealth\'s online system where employers report their employees\' premiums each month.' },
  { code: 'MCRF', name: 'Member\'s Contribution Remittance Form', meaning: 'The Pag-IBIG form listing each employee\'s monthly contribution, sent with the employer\'s payment.' },
  { code: 'EIS', name: 'Electronic Invoicing System', meaning: 'The BIR system that receives electronic invoices and sales data from covered taxpayers.' },
  { code: 'ORUS', name: 'Online Registration and Update System', meaning: 'The BIR website (orus.bir.gov.ph) for registering, updating your registration and registering books.' },
  { code: 'eAFS', name: 'Electronic Audited Financial Statements', meaning: 'The BIR portal where you upload the attachments of your income tax return.' },
  { code: 'eFAST', name: 'Electronic Filing and Submission Tool', meaning: 'The SEC website where corporations file their financial statements and General Information Sheet.' },
  { code: 'GIS', name: 'General Information Sheet', meaning: 'The SEC form listing a corporation\'s officers, directors and shareholders.' },
  { code: 'SAWT', name: 'Summary Alphalist of Withholding Taxes', meaning: 'The list of the 2307 certificates you claim as tax credits, sent with your return.' },
  { code: 'SLSP', name: 'Summary List of Sales and Purchases', meaning: 'The quarterly list of sales and purchases that VAT-registered taxpayers send to the BIR.' },
  { code: 'QAP', name: 'Quarterly Alphalist of Payees', meaning: 'The quarterly list of everyone you withheld tax from, sent with the 1601-EQ.' },
  { code: 'CTC', name: 'Community Tax Certificate', meaning: 'The cedula, paid each year to your city or municipality.' },
  { code: 'PTR', name: 'Professional Tax Receipt', meaning: 'The yearly tax licensed professionals pay to the city or province where they practise.' },
  { code: 'RCIT', name: 'Regular corporate income tax', meaning: '25% of a corporation\'s taxable income (20% for small corporations).' },
  { code: 'MCIT', name: 'Minimum corporate income tax', meaning: '2% of gross income, paid instead when it is higher than the regular tax, from the 4th taxable year after BIR registration.' },
]

const BY_CODE = Object.fromEntries(GLOSSARY.map(g => [g.code, g]))

// 'R-5: SSS Form R-5. The SSS contribution ... PRN: Payment Reference Number. ...'
// for every glossary code in a chip label ('SSS R-5/PRN'); null when none.
export function formCodeHint(form) {
  const hits = String(form || '').split(/[\s/]+/).map(t => BY_CODE[t]).filter(Boolean)
  if (!hits.length) return null
  return hits.map(g => `${g.code}: ${g.name}. ${g.meaning}`).join(' ')
}
