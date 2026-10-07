import { describe, it, expect } from 'vitest'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'

// L02 (owner default): the overpayment text lists all three choices on the
// annual return (refund, tax credit certificate, carry over), with no
// irrevocability warning (unconfirmed for individuals).

const TEXT = 'On the return, choose one: refund, tax credit certificate, or carry over to next year.'

describe('TI:WS-08 overpayment of ₱20,700', () => {
  const r = estimateIndividual({ gross: 420000, cwt: 21000 })
  it('breakdown row offers refund, TCC or carry-over', () => {
    const row = r.rows.find(x => /^Overpayment/.test(x.label))
    expect(row.label).toBe('Overpayment')
    expect(row.value).toBe(20700)
    expect(row.sub).toBe(TEXT)
  })
  it('the annual-return preview carries the same note; none when tax is payable', () => {
    expect(r.annualReturn.overpaymentNote).toBe(TEXT)
    expect(estimateIndividual({ gross: 1200000 }).annualReturn.overpaymentNote).toBe(null)
  })
  it('no irrevocability wording', () => {
    const all = r.rows.map(x => `${x.label} ${x.sub || ''}`).join(' ')
    expect(all).not.toMatch(/irrevocab/i)
  })
})
