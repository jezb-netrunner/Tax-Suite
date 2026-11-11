// Audit Nov 11, 2026: "Restore from a backup file", the backup reminder, and
// the notice shown when the rulebook is old.
import { describe, it, expect } from 'vitest'
import { createBackend, LS_KEY, LAST_BACKUP_KEY, PROFILE_LIMIT, BACKUP_REMINDER_DAYS } from '../../src/lib/backend.js'
import { parseBackup, cleanProfile, BACKUP_MAX_BYTES, NAME_MAX_LENGTH } from '../../src/lib/backup.js'
import { backupReminder, restoreResultText } from '../../src/pages/Profiles.jsx'
import { rulesAge, staleRulesText, STALE_AFTER_DAYS } from '../../src/lib/rulesAge.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { estimateIndividual } from '../../src/engine/estimators/individual.js'
import meta from '../../src/data/rules/meta.json'
import { memoryStorage } from './backend-fakes.js'

const maria = { ...defaultProfile('mixed'), id: 'p-maria', name: 'Maria Santos', inputs: { mixed: { gross: 480000, cwt: 4800.5 } } }
const corp = { ...defaultProfile('corporation'), id: 'p-corp', name: 'Santos Inc.', fiscalYearEndMonth: 6, registrationYear: 2021, inputs: { corporation: { grossSales: 9000000, taxYear: 'earlier', excessMcit: { 2024: 12000 } } } }

function backendWith(profiles) {
  const storage = memoryStorage(profiles ? { [LS_KEY]: JSON.stringify(profiles) } : {})
  return { be: createBackend({ storage }), storage }
}

describe('a downloaded backup can be restored (round trip)', () => {
  it('download, erase, restore: the same profiles and figures come back', async () => {
    const { be } = backendWith([maria, corp])
    const file = JSON.stringify(await be.exportData({ now: new Date('2026-11-11T02:00:00Z') }), null, 2)
    be.eraseLocalData()
    expect(await be.listProfiles()).toEqual([])
    const parsed = parseBackup(file, { thisYear: 2026 })
    expect(parsed.exportedAt).toBe('2026-11-11T02:00:00.000Z')
    expect(parsed.skipped).toBe(0)
    const r = await be.importProfiles(null, parsed.profiles)
    expect(r).toEqual({ added: 2, replaced: 0, kept: 0, overLimit: 0, failed: 0 })
    expect(await be.listProfiles()).toEqual([maria, corp])
  })

  it('the restored figures give the same estimate', async () => {
    const [p] = parseBackup(JSON.stringify({ format: 'jez-tax-suite-export', version: 1, profiles: [maria] })).profiles
    expect(estimateIndividual({ gross: p.inputs.mixed.gross, mixed: true, taxYear: 2026 }).best.total)
      .toBe(estimateIndividual({ gross: 480000, mixed: true, taxYear: 2026 }).best.total)
  })

  it('profiles already here are kept unless the user chooses to replace them', async () => {
    const changed = { ...maria, name: 'Maria S. (edited)', inputs: { mixed: { gross: 999 } } }
    const { be } = backendWith([changed])
    const incoming = parseBackup(JSON.stringify({ format: 'jez-tax-suite-export', version: 1, profiles: [maria, corp] })).profiles
    expect(await be.importProfiles(null, incoming)).toEqual({ added: 1, replaced: 0, kept: 1, overLimit: 0, failed: 0 })
    expect((await be.listProfiles()).map(p => p.name)).toEqual(['Maria S. (edited)', 'Santos Inc.'])
    expect(await be.importProfiles(null, incoming, { replaceExisting: true })).toEqual({ added: 0, replaced: 2, kept: 0, overLimit: 0, failed: 0 })
    expect((await be.listProfiles())[0]).toEqual(maria)
  })

  it('a restore never deletes a profile that is not in the file, and never passes the profile limit', async () => {
    const many = Array.from({ length: PROFILE_LIMIT }, (_, i) => ({ ...defaultProfile('employee'), id: `p-${i}`, name: `Client ${i}` }))
    const { be } = backendWith(many)
    const r = await be.importProfiles(null, [maria])
    expect(r).toEqual({ added: 0, replaced: 0, kept: 0, overLimit: 1, failed: 0 })
    expect((await be.listProfiles()).length).toBe(PROFILE_LIMIT)
  })

  it('a profile with no usable id gets a new one', async () => {
    const { be } = backendWith([])
    await be.importProfiles(null, [{ ...maria, id: null }])
    const [p] = await be.listProfiles()
    expect(typeof p.id).toBe('string')
    expect(p.id.length).toBeGreaterThan(8)
  })

  it('the error screen\'s copy ("Download a copy of my data") restores too', () => {
    const file = JSON.stringify({ exportedAt: '2026-11-11T00:00:00.000Z', storedData: { 'pv.profiles.v1': [maria], 'pv.activeProfile.v1': 'p-maria' } })
    expect(parseBackup(file).profiles.map(p => p.name)).toEqual(['Maria Santos'])
  })
})

describe('a backup file is untrusted: only clean profiles come out', () => {
  const wrap = profiles => JSON.stringify({ format: 'jez-tax-suite-export', version: 1, profiles })

  it('refuses files that are not a backup, in plain words', () => {
    for (const bad of ['', '   ', 'not json', '[]', '{"profiles":[]}', '{"format":"other","profiles":[{}]}', wrap([]), wrap([{ name: 'x' }])]) {
      expect(() => parseBackup(bad)).toThrow(/backup|file/i)
    }
    expect(() => parseBackup('x'.repeat(BACKUP_MAX_BYTES + 1))).toThrow('too large')
    expect(() => parseBackup(JSON.stringify({ format: 'jez-tax-suite-export', version: 2, profiles: [maria] }))).toThrow('newer version')
    expect(() => parseBackup(wrap(Array.from({ length: 501 }, () => maria)))).toThrow('more than 500')
  })

  it('reads a file that starts with a byte-order mark', () => {
    expect(parseBackup('﻿' + wrap([maria])).profiles).toHaveLength(1)
  })

  it('"__proto__" and "constructor" keys never reach a profile or Object.prototype', () => {
    const file = '{"format":"jez-tax-suite-export","version":1,"profiles":[{"type":"individual","name":"X","__proto__":{"polluted":true},' +
      '"inputs":{"__proto__":{"polluted":true},"individual":{"gross":5,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}}}]}'
    const [p] = parseBackup(file).profiles
    expect({}.polluted).toBeUndefined()
    expect(p.polluted).toBeUndefined()
    expect(Object.keys(p.inputs)).toEqual(['individual'])
    expect(p.inputs.individual).toEqual({ gross: 5 })
  })

  it('keeps only real profile fields, each of the right kind', () => {
    const p = cleanProfile({
      type: 'individual', id: '<script>alert(1)</script>', name: '  Ana\n\tCruz  ' + 'x'.repeat(300), vatRegistered: 'yes', regime: 'made-up',
      booksType: 'cas', fiscalYearEndMonth: 99, registrationYear: 3000, hasEmployees: true, extra: { anything: 1 },
      filed: { a: true }, checklistDone: { b: true },
      inputs: { individual: { gross: 1e308, cwt: 'abc'.repeat(100), expenses: 1200.5, mwe: true, nested: { deep: { deeper: 1 } }, list: [1, 2] }, unknownTab: { gross: 1 } },
    }, { thisYear: 2026 })
    expect(p.id).toBeNull()
    expect(p.name.startsWith('Ana Cruz')).toBe(true)
    expect(p.name.length).toBe(NAME_MAX_LENGTH)
    expect(p.vatRegistered).toBe(false)
    expect(p.regime).toBe('8pct')
    expect(p.booksType).toBe('cas')
    expect(p.fiscalYearEndMonth).toBe(12)
    expect(p.registrationYear).toBeNull()
    expect(p.hasEmployees).toBe(true)
    expect('extra' in p || 'filed' in p || 'checklistDone' in p).toBe(false)
    expect(p.inputs).toEqual({ individual: { expenses: 1200.5, mwe: true, nested: {} } })
  })

  it('a VAT-registered individual never comes back on the 8% option', () => {
    expect(cleanProfile({ type: 'individual', name: 'V', vatRegistered: true, regime: '8pct' }).regime).toBe('graduated_osd')
  })

  it('entries that are not profiles are counted and skipped; duplicate ids are not kept twice', () => {
    const r = parseBackup(wrap([maria, null, 'text', { type: 'unknown' }, { ...maria, name: 'Copy' }]))
    expect(r.skipped).toBe(3)
    expect(r.profiles.map(p => p.id)).toEqual(['p-maria', null])
  })
})

describe('backup reminder (local mode)', () => {
  const today = new Date(2026, 10, 11)
  it('no profiles, or accounts mode: no reminder', () => {
    expect(backupReminder({ hasCloud: false, profileCount: 0, lastBackup: null, today })).toBeNull()
    expect(backupReminder({ hasCloud: true, profileCount: 3, lastBackup: null, today })).toBeNull()
  })
  it('profiles and no backup yet', () => {
    expect(backupReminder({ hasCloud: false, profileCount: 2, lastBackup: null, today })).toContain('No backup yet')
  })
  it(`a backup within ${BACKUP_REMINDER_DAYS} days is quiet; an older one is named with its age`, () => {
    expect(backupReminder({ hasCloud: false, profileCount: 2, lastBackup: '2026-10-12', today })).toBeNull()
    expect(backupReminder({ hasCloud: false, profileCount: 2, lastBackup: '2026-10-11', today })).toContain('Oct 11, 2026 (31 days ago)')
  })
  it('"Download my data" records the Manila date; erasing everything forgets it', async () => {
    const { be, storage } = backendWith([maria])
    expect(be.lastBackupDate()).toBeNull()
    be.noteBackup(new Date('2026-11-10T17:30:00Z')) // 1:30 am on Nov 11 in Manila
    expect(storage.getItem(LAST_BACKUP_KEY)).toBe('2026-11-11')
    expect(be.lastBackupDate()).toBe('2026-11-11')
    be.eraseLocalData()
    expect(be.lastBackupDate()).toBeNull()
  })
  it('the result of a restore is said in one sentence', () => {
    expect(restoreResultText({ added: 2, replaced: 0, kept: 1, overLimit: 0, failed: 0 }))
      .toBe('Restore finished: 2 profiles added; 1 profile already here left as it is.')
    expect(restoreResultText({ added: 0, replaced: 0, kept: 0, overLimit: 0, failed: 0 })).toBe('Nothing was restored.')
  })
})

describe('old rulebook notice', () => {
  it('the rulebook carries its date in both forms, and they agree', () => {
    expect(meta.verifiedISO).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const [y, m, d] = meta.verifiedISO.split('-').map(Number)
    const text = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    expect(meta.verifiedDate).toBe(text)
  })
  it(`quiet for ${STALE_AFTER_DAYS} days after the last check, then says so on every page`, () => {
    const opts = { verifiedISO: '2026-11-11', verifiedText: 'November 11, 2026' }
    expect(staleRulesText(rulesAge(new Date(2026, 10, 11), opts))).toBeNull()
    expect(staleRulesText(rulesAge(new Date(2027, 1, 9), opts))).toBeNull() // day 90
    const t = staleRulesText(rulesAge(new Date(2027, 1, 10), opts)) // day 91
    expect(t).toContain('last checked on November 11, 2026, about 3 months ago')
    expect(t).toContain('Get the newest copy')
    expect(staleRulesText(rulesAge(new Date(2028, 5, 1), opts))).toContain('more than a year ago')
    expect(staleRulesText(rulesAge(new Date(2029, 5, 1), opts))).toContain('more than 2 years ago')
  })
  it('the shipped rulebook is not stale on the day it was checked', () => {
    const [y, m, d] = meta.verifiedISO.split('-').map(Number)
    expect(rulesAge(new Date(y, m - 1, d)).stale).toBe(false)
  })
})
