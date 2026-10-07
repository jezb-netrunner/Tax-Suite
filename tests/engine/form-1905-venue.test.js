// M14 (owner decision 15): Form 1905 updates and RDO transfers can be filed at
// any RDO under EOPT. The Forms page says the same as the Checklist item and
// both cite RA 11976 and RMC 91-2024.
import { describe, it, expect } from 'vitest'
import obligationsData from '../../src/data/rules/obligations.json'
import { FORMS_DATA } from '../../src/data/forms.js'

const VENUE = 'Under EOPT, transfers and updates can be filed at any RDO, with no transfer-first requirement (RA 11976; RMC 91-2024).'
const ob = obligationsData.obligations.find(o => o.id === 'bir-1905-updates')
const form = FORMS_DATA.find(f => f.code === '1905')

describe('M14 Form 1905 venue', () => {
  it('checklist item: any RDO, citing RA 11976 and RMC 91-2024', () => {
    expect(ob.notes).toBe(VENUE)
    expect(ob.legalBasis).toEqual(['NIRC Sec 236, as amended by RA 11976 (EOPT)', 'RMC 91-2024'])
  })
  it('Forms page says the same', () => {
    expect(form.summary).toContain(VENUE)
    expect(form.summary).not.toContain('business taxpayers file with their current RDO')
  })
})
