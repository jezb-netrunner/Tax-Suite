// L15: plain-language explanations for the codes on calendar chips (SSS
// R-5/PRN, PhilHealth SPA/EPRS, Pag-IBIG MCRF, EIS, ORUS, ...) as an
// abbreviation with a screen-reader expansion, inside the calendar row
// details, and as a short glossary on the Forms page; the corporate
// estimator heading spells out RCIT and MCIT.
import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import obligationsData from '../../src/data/rules/obligations.json'
import { defaultProfile } from '../../src/engine/profile.js'

const corp = { ...defaultProfile('corporation'), id: 'c1', name: 'Corp Inc' }
vi.mock('../../src/state/AppState.jsx', () => ({
  useApp: () => ({
    authReady: true, hasCloud: false, signedIn: false, profilesReady: true,
    profiles: [corp], active: corp, loadError: null, save: async () => {},
  }),
}))

const { GLOSSARY, formCodeHint } = await import('../../src/data/glossary.js')
const { FormCode } = await import('../../src/components/FormCode.jsx')
const { DeadlineDetails } = await import('../../src/components/Confidence.jsx')
const { default: FormsPage } = await import('../../src/pages/Forms.jsx')
const { default: Estimator } = await import('../../src/pages/Estimator.jsx')

const h = React.createElement
const html = el => renderToStaticMarkup(h(MemoryRouter, null, el))
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ')

describe('L15 chip explanations', () => {
  it('SSS R-5/PRN', () => {
    expect(formCodeHint('SSS R-5/PRN')).toBe(
      'R-5: SSS Form R-5. The SSS contribution payment form for employers; payments now go through a PRN. ' +
      'PRN: Payment Reference Number. The number you generate in your My.SSS account for each SSS payment.')
  })
  it.each([
    ['PhilHealth SPA/EPRS', ['SPA: Statement of Premium Account.', 'EPRS: Electronic Premium Reporting System.']],
    ['Pag-IBIG MCRF', ['MCRF: Member\'s Contribution Remittance Form.']],
    ['EIS', ['EIS: Electronic Invoicing System.']],
    ['via ORUS', ['ORUS: Online Registration and Update System.']],
    ['via eAFS', ['eAFS: Electronic Audited Financial Statements.']],
    ['SEC eFAST', ['eFAST: Electronic Filing and Submission Tool.']],
  ])('%s', (form, parts) => {
    for (const p of parts) expect(formCodeHint(form)).toContain(p)
  })
  it('plain BIR form numbers have no hint (the Forms page explains them)', () => {
    expect(formCodeHint('1701Q')).toBe(null)
    expect(formCodeHint('—')).toBe(null)
  })
  it('every coded chip in the rulebook is explained', () => {
    const coded = ['R-5', 'PRN', 'SPA', 'EPRS', 'MCRF', 'EIS', 'ORUS', 'eAFS', 'eFAST', 'SAWT', 'SLSP', 'QAP', 'CTC', 'PTR', 'GIS']
    for (const ob of obligationsData.obligations) {
      const tokens = String(ob.form || '').split(/[\s/]+/)
      if (tokens.some(t => coded.includes(t))) expect(formCodeHint(ob.form), ob.id).toBeTruthy()
    }
    for (const c of [...coded, 'RCIT', 'MCIT']) expect(GLOSSARY.find(g => g.code === c), c).toBeTruthy()
  })
})

describe('L15 chip markup', () => {
  it('abbr with a tooltip, plus the expansion for screen readers', () => {
    const out = renderToStaticMarkup(h(FormCode, { form: 'Pag-IBIG MCRF' }))
    expect(out).toContain('<abbr title="MCRF: Member&#x27;s Contribution Remittance Form.')
    expect(out).toContain('>Pag-IBIG MCRF</abbr>')
    expect(out).toContain('<span class="sr-only"> (MCRF: Member&#x27;s Contribution Remittance Form.')
  })
  it('a plain form number is shown as is', () => {
    expect(renderToStaticMarkup(h(FormCode, { form: '1701Q' }))).toBe('<span class="boxcode">1701Q</span>')
  })
  it('the calendar row Details explain the codes', () => {
    const ob = obligationsData.obligations.find(o => o.id === 'sss-employer')
    const out = strip(renderToStaticMarkup(h(DeadlineDetails, { d: { obligation: ob, label: 'Sep 2026', confidence: 'verified', confidenceReasons: [] } })))
    expect(out).toContain('What the codes mean: R-5: SSS Form R-5.')
  })
})

describe('L15 Forms page glossary and corporate heading', () => {
  it('Forms page has a short glossary of the codes', () => {
    const out = strip(html(h(FormsPage)))
    expect(out).toContain('What the codes mean')
    for (const t of ['PRN Payment Reference Number', 'SPA Statement of Premium Account', 'EPRS Electronic Premium Reporting System',
      'MCRF Member\'s Contribution Remittance Form', 'EIS Electronic Invoicing System', 'ORUS Online Registration and Update System']) {
      expect(out).toContain(t)
    }
  })
  it('corporate estimator heading spells out RCIT and MCIT', () => {
    const out = strip(html(h(Estimator)))
    expect(out).toContain('Regular corporate income tax (RCIT) or minimum corporate income tax (MCIT): what will you owe?')
  })
})
