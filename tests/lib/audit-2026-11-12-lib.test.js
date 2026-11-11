// Audit of November 12, 2026 (AUDIT-2026-11-12.md): storage, restore, exports,
// the amount box and accounts-mode hardening. Each test names its finding.
import { describe, it, expect } from 'vitest'
import {
  createBackend, LS_KEY, STAMPS_KEY, BEFORE_RESTORE_KEY, DAMAGED_KEY_PREFIX, PENDING_FIGURES_KEY, LAST_BACKUP_KEY,
} from '../../src/lib/backend.js'
import { parseBackup, cleanProfile, PROFILE_MAX_CHARS } from '../../src/lib/backup.js'
import { replacementList, BACKUP_FILE_WARNING } from '../../src/pages/Profiles.jsx'
import { parseMoneyInput, parseIntegerInput, formatMoneyInput, formatIntegerInput, valueForText, textOnBlur } from '../../src/lib/format.js'
import { icsText, foldLine, deadlineIcs, deadlineIcsFileName, REMINDER_DAYS_BEFORE } from '../../src/lib/ics.js'
import { rulesAge, staleRulesText, newestCopyText } from '../../src/lib/rulesAge.js'
import { sessionFromRecovery, isRecoveryLink } from '../../src/lib/auth.js'
import { createInputSaver, flushPendingSaves } from '../../src/lib/inputSaver.js'
import { supabaseConnectSources } from '../../scripts/build-mode.js'
import { OBLIGATIONS, HOLIDAY_SET } from '../../src/lib/deadlineData.js'
import { generateDeadlines } from '../../src/engine/deadlines.js'
import { defaultProfile } from '../../src/engine/profile.js'
import { fromISO } from '../../src/engine/dates.js'
import fs from 'node:fs'
import path from 'node:path'
import { memoryStorage, mockClient } from './backend-fakes.js'

const ana = { ...defaultProfile('individual'), id: 'p-ana', name: 'Ana Santos', inputs: { individual: { gross: 2000000 } } }
const ben = { ...defaultProfile('employee'), id: 'p-ben', name: 'Ben Cruz' }
const local = profiles => {
  const storage = memoryStorage(profiles ? { [LS_KEY]: typeof profiles === 'string' ? profiles : JSON.stringify(profiles) } : {})
  return { be: createBackend({ storage }), storage }
}
const file = (profiles, more = {}) => JSON.stringify({ format: 'jez-tax-suite-export', version: 1, profiles, ...more })

describe('X1: stored data that cannot be read is never taken for "no profiles", and never written over', () => {
  const cut = JSON.stringify([ana, ben]).slice(0, 80) // a list cut short
  it('listing, saving, updating, deleting and restoring all refuse, and the text stays as it was', async () => {
    const { be, storage } = local(cut)
    await expect(be.listProfiles()).rejects.toMatchObject({ code: 'damaged-data' })
    await expect(be.saveProfile(null, { ...ben, id: null })).rejects.toMatchObject({ code: 'damaged-data' })
    await expect(be.updateProfile(null, 'p-ana', p => p)).rejects.toMatchObject({ code: 'damaged-data' })
    await expect(be.deleteProfile(null, 'p-ana')).rejects.toMatchObject({ code: 'damaged-data' })
    await expect(be.importProfiles(null, [ben])).rejects.toMatchObject({ code: 'damaged-data' })
    expect(storage.getItem(LS_KEY)).toBe(cut)
  })
  it('a copy of the unreadable text is kept under its own key', async () => {
    const { be, storage } = local(cut)
    await be.listProfiles().catch(() => {})
    const key = storage.keys().find(k => k.startsWith(DAMAGED_KEY_PREFIX))
    expect(storage.getItem(key)).toBe(cut)
  })
  it('"Download my data" hands over the unreadable text, marked, instead of an empty backup', async () => {
    const { be } = local(cut)
    const out = await be.exportData()
    expect(out.unreadable).toBe(true)
    expect(out.unreadableData).toBe(cut)
    expect(out.profiles).toEqual([])
  })
  it('after "Erase all data on this device" the app works again and a backup can be restored', async () => {
    const { be } = local(cut)
    be.eraseLocalData()
    expect(await be.listProfiles()).toEqual([])
    expect((await be.importProfiles(null, parseBackup(file([ana, ben])).profiles)).added).toBe(2)
  })
  it('deleting a profile leaves entries that are not profiles where they are', async () => {
    const { be, storage } = local([null, ana, 'text', ben])
    await be.deleteProfile(null, 'p-ana')
    expect(JSON.parse(storage.getItem(LS_KEY))).toEqual([null, 'text', ben])
  })
})

describe('X12: when each profile was last changed', () => {
  it('saving, changing and deleting keep the times; they sit beside the profiles, never inside them', async () => {
    const { be, storage } = local([])
    const saved = await be.saveProfile(null, { ...ana, id: null })
    expect(Object.keys(be.profileStamps())).toEqual([saved.id])
    expect('updatedAt' in (await be.listProfiles())[0]).toBe(false)
    const first = be.profileStamps()[saved.id]
    await be.updateProfile(null, saved.id, p => ({ ...p, name: 'Ana S.' }))
    expect(Date.parse(be.profileStamps()[saved.id])).toBeGreaterThanOrEqual(Date.parse(first))
    await be.deleteProfile(null, saved.id)
    expect(be.profileStamps()).toEqual({})
    expect(JSON.parse(storage.getItem(STAMPS_KEY))).toEqual({})
  })
  it('the backup file carries them, and a restore reads them back for the "last changed" line', async () => {
    const { be } = local([])
    const saved = await be.saveProfile(null, { ...ana, id: null })
    const out = await be.exportData()
    expect(out.records).toEqual([{ id: saved.id, updatedAt: be.profileStamps()[saved.id] }])
    expect(parseBackup(JSON.stringify(out)).stamps).toEqual({ [saved.id]: out.records[0].updatedAt })
  })
  it('accounts mode: the database\'s own time of each row', async () => {
    const client = mockClient({ respond: () => ({ data: [{ id: 'r1', data: { name: 'A', type: 'employee' }, updated_at: '2026-11-12T01:00:00+00:00' }], error: null }) })
    const be = createBackend({ client, storage: memoryStorage() })
    await be.listProfiles('u1')
    expect(be.profileStamps()).toEqual({ r1: '2026-11-12T01:00:00+00:00' })
  })
})

describe('X3, X6, X20: what a restore accepts', () => {
  it('amounts must be numbers from zero up, to the centavo; text is kept only for the known choices', () => {
    const p = cleanProfile({
      type: 'corporation', name: 'C',
      inputs: { corporation: { grossSales: '1e30', opex: -500000, costOfSales: 1234.567, cwt: 0, taxYear: 'earlier', deduction: 'osd', crossedMonth: 'DROP TABLE', qQuarter: 2, excessMcit: { 2024: 12000, 2025: -1, abc: 5, 20261: 5 }, other: { 2024: 1 } } },
    })
    expect(p.inputs.corporation).toEqual({ costOfSales: 1234.57, cwt: 0, taxYear: 'earlier', deduction: 'osd', qQuarter: 2, excessMcit: { 2024: 12000 } })
  })
  it('even a profile with every box of every tab filled stays within the size an account allows', () => {
    const big = { type: 'individual', name: 'Big', inputs: {} }
    for (const tab of ['individual', 'mixed', 'employee', 'corporation', 'payroll']) {
      big.inputs[tab] = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`field_${i}_${'x'.repeat(48)}`, 999999999999.99]))
    }
    expect(JSON.stringify(big).length).toBeLessThan(PROFILE_MAX_CHARS) // even every box of every tab fits
    expect(cleanProfile(big)).not.toBeNull()
  })
  it('ids that could name object internals are not kept', () => {
    for (const id of ['__proto__', 'constructor', 'prototype', '..', 'a b', 'x'.repeat(65)]) {
      expect(cleanProfile({ type: 'employee', name: 'E', id }).id, id).toBeNull()
    }
    expect(cleanProfile({ type: 'employee', name: 'E', id: '3f2a9c1e-aaaa-4bbb-8ccc-0123456789ab' }).id).toBe('3f2a9c1e-aaaa-4bbb-8ccc-0123456789ab')
  })
  it('whatever is handed to the restore is cleaned again before it is stored', async () => {
    const { be } = local([])
    await be.importProfiles(null, [{ type: 'individual', name: 'Raw', evil: '<script>', inputs: { individual: { gross: '1e9' } } }])
    const [p] = await be.listProfiles()
    expect('evil' in p).toBe(false)
    expect(p.inputs).toEqual({})
  })
  it('the profile that was selected in the backup is reported, when it is in the file', () => {
    expect(parseBackup(file([ana, ben], { activeProfileId: 'p-ben' })).activeProfileId).toBe('p-ben')
    expect(parseBackup(file([ana], { activeProfileId: 'p-gone' })).activeProfileId).toBeNull()
  })
})

describe('X4: a restore can be repeated without making duplicates', () => {
  it('local mode: the same file twice adds nothing the second time, also for entries with no id', async () => {
    const { be } = local([])
    const incoming = parseBackup(file([ana, { ...ben, id: null }, { ...ben, id: null, name: 'Ben Two' }])).profiles
    expect((await be.importProfiles(null, incoming)).added).toBe(3)
    const again = await be.importProfiles(null, incoming)
    expect(again).toMatchObject({ added: 0, replaced: 0, kept: 3 })
    expect((await be.listProfiles()).length).toBe(3)
  })
  it('accounts mode: profiles already in the account with the same content are not added again', async () => {
    const rows = []
    const client = mockClient({
      respond: ops => {
        const insert = ops.find(o => o[0] === 'insert')
        if (insert) { const r = { id: `row-${rows.length + 1}`, data: insert[1].data, updated_at: '2026-11-12T00:00:00+00:00' }; rows.push(r); return { data: { id: r.id }, error: null } }
        return { data: rows, error: null }
      },
    })
    const be = createBackend({ client, storage: memoryStorage() })
    const incoming = parseBackup(file([ana, ben])).profiles
    expect((await be.importProfiles('u1', incoming)).added).toBe(2)
    expect(await be.importProfiles('u1', incoming)).toMatchObject({ added: 0, kept: 2, failed: 0 })
    expect(rows.length).toBe(2)
  })
})

describe('X5: replacing shows what is replaced, and can be undone once', () => {
  it('each replacement names the profile here and the one in the file, and flags a different name or type', () => {
    const fileProfiles = [{ ...ana, name: 'Totally different person', type: 'employee' }, ben, { ...ben, id: 'p-new' }]
    const list = replacementList(fileProfiles, [ana, ben], { 'p-ana': '2026-10-01T02:00:00Z' }, { 'p-ana': '2026-11-11T17:00:00Z' })
    expect(list).toEqual([
      { id: 'p-ana', here: 'Ana Santos (Self-employed / Sole prop)', hereChanged: 'Nov 12, 2026', backup: 'Totally different person (Employee)', backupChanged: 'Oct 1, 2026', differs: true },
      { id: 'p-ben', here: 'Ben Cruz (Employee)', hereChanged: '', backup: 'Ben Cruz (Employee)', backupChanged: '', differs: false },
    ])
  })
  it('"Undo this restore" puts back the list as it was just before the replace', async () => {
    const edited = { ...ana, name: 'Ana (current)', inputs: { individual: { gross: 999 } } }
    const { be, storage } = local([edited, ben])
    expect(be.restoreUndoInfo()).toBeNull()
    const r = await be.importProfiles(null, parseBackup(file([ana])).profiles, { replaceExisting: true })
    expect(r).toMatchObject({ replaced: 1, canUndo: true })
    expect((await be.listProfiles())[0].name).toBe('Ana Santos')
    expect(be.restoreUndoInfo().count).toBe(2)
    expect(be.undoRestore()).toEqual({ restored: 2 })
    expect(await be.listProfiles()).toEqual([edited, ben])
    expect(storage.getItem(BEFORE_RESTORE_KEY)).toBeNull()
    expect(() => be.undoRestore()).toThrow('no restore to undo')
  })
  it('a restore that only adds keeps no undo copy; erasing everything removes it', async () => {
    const { be, storage } = local([ben])
    expect((await be.importProfiles(null, parseBackup(file([ana])).profiles)).canUndo).toBe(false)
    expect(storage.getItem(BEFORE_RESTORE_KEY)).toBeNull()
    await be.importProfiles(null, [{ ...ana, name: 'Changed' }], { replaceExisting: true })
    expect(storage.getItem(BEFORE_RESTORE_KEY)).not.toBeNull()
    be.eraseLocalData()
    expect(storage.keys()).toEqual([])
  })
})

describe('U7: the reminder knows a restored file is a backup', () => {
  it('the file\'s own date is recorded, never moved back, and never a date in the future', () => {
    const { be, storage } = local([ana])
    be.noteBackup(new Date('2026-10-01T03:00:00Z'), { onlyIfLater: true })
    expect(be.lastBackupDate()).toBe('2026-10-01')
    be.noteBackup(new Date('2026-09-01T03:00:00Z'), { onlyIfLater: true })
    expect(be.lastBackupDate()).toBe('2026-10-01')
    be.noteBackup(new Date('2099-01-01T03:00:00Z'), { onlyIfLater: true })
    expect(storage.getItem(LAST_BACKUP_KEY)).toBe('2026-10-01')
  })
  it('the download says what the file holds', () => {
    expect(BACKUP_FILE_WARNING).toContain('readable form')
    expect(BACKUP_FILE_WARNING).toContain('does not delete the file')
  })
})

describe('X7 (accounts): figures kept in a browser never overwrite a newer account copy', () => {
  const USER = 'u1'
  const stash = (stamp, values = { gross: 100 }) => memoryStorage({ [PENDING_FIGURES_KEY]: JSON.stringify([{ userId: USER, profileId: 'r1', key: 'individual', values, stamp }]) })
  const keptAt = Date.parse('2026-11-10T00:00:00Z')
  const now = new Date('2026-11-12T00:00:00Z')
  function account(updatedAt) {
    const writes = []
    const client = mockClient({
      respond: ops => {
        const update = ops.find(o => o[0] === 'update')
        if (update) { writes.push(update[1]); return { data: [{ id: 'r1', updated_at: 'later' }], error: null } }
        return { data: [{ id: 'r1', data: { name: 'Ana', type: 'individual', inputs: { individual: { gross: 250000 } } }, updated_at: updatedAt }], error: null }
      },
    })
    return { client, writes }
  }
  it('the account was changed after the figures were kept: they are dropped, with a notice', async () => {
    const { client, writes } = account('2026-11-11T00:00:00Z')
    const storage = stash(`${keptAt}-1`)
    const r = await createBackend({ client, storage }).replayStashedFigures(USER, { now })
    expect(r.saved).toBe(0)
    expect(r.problems[0].code).toBe('stale-figures')
    expect(r.problems[0].message).toContain('2026-11-10')
    expect(writes).toEqual([])
    expect(storage.getItem(PENDING_FIGURES_KEY)).toBeNull()
  })
  it('the account is older than the kept figures: they are saved as before', async () => {
    const { client, writes } = account('2026-11-09T00:00:00Z')
    const r = await createBackend({ client, storage: stash(`${keptAt}-1`) }).replayStashedFigures(USER, { now })
    expect(r.saved).toBe(1)
    expect(writes[0].data.inputs.individual.gross).toBe(100)
  })
  it('figures kept more than 7 days ago are dropped without asking the account', async () => {
    const { client, writes } = account('2026-01-01T00:00:00Z')
    const r = await createBackend({ client, storage: stash(`${Date.parse('2026-11-01T00:00:00Z')}-1`) }).replayStashedFigures(USER, { now })
    expect(r.problems[0].code).toBe('stale-figures')
    expect(writes).toEqual([])
  })
})

describe('X8 (accounts): "Set a new password" needs a real reset sign-in', () => {
  const token = amr => ({ access_token: `h.${Buffer.from(JSON.stringify({ sub: 'u', amr })).toString('base64url')}.s` })
  it('a typed address still looks like a recovery link, which is why the session is checked too', () => {
    expect(isRecoveryLink('https://tax.example.ph/index.html?type=recovery#/')).toBe(true)
  })
  it('a session opened with the password is not a recovery session', () => {
    expect(sessionFromRecovery(token([{ method: 'password', timestamp: 1 }]))).toBe(false)
    expect(sessionFromRecovery(token(['pwd']))).toBe(false)
  })
  it('a session from an emailed reset link is', () => {
    expect(sessionFromRecovery(token([{ method: 'recovery', timestamp: 1 }]))).toBe(true)
    expect(sessionFromRecovery(token([{ method: 'otp', timestamp: 1 }]))).toBe(true)
  })
  it('anything unreadable counts as not recovery', () => {
    for (const s of [null, {}, { access_token: 'x' }, { access_token: 'a.b.c' }, token(undefined)]) expect(sessionFromRecovery(s)).toBe(false)
  })
})

describe('X14 (accounts): signing out waits for figures typed a moment ago', () => {
  it('flushPendingSaves saves what is waiting and resolves after the save finished', async () => {
    const saved = []
    let finish
    const s = createInputSaver({ save: v => new Promise(res => { finish = () => { saved.push(v); res() } }), win: null, doc: null })
    s.schedule({ gross: 5 })
    let done = false
    const p = flushPendingSaves().then(() => { done = true })
    await Promise.resolve()
    expect(done).toBe(false)
    finish()
    await p
    expect(saved).toEqual([{ gross: 5 }])
    s.dispose()
  })
})

describe('X11, U5: old rules and a wrong clock', () => {
  const opts = { verifiedISO: '2026-11-12', verifiedText: 'November 12, 2026' }
  it('a device date before the rules date is reported as a wrong clock', () => {
    const age = rulesAge(new Date(2020, 0, 1), opts)
    expect(age.clockBehind).toBe(true)
    expect(staleRulesText(age)).toContain("This device's date is earlier than November 12, 2026")
    expect(rulesAge(new Date(2026, 10, 12), opts).clockBehind).toBe(false)
  })
  it('the old-rules notice names where the newest copy is published', () => {
    const t = staleRulesText(rulesAge(new Date(2027, 5, 1), opts), { siteUrl: 'https://tax.example.ph/app/' })
    expect(t).toContain('Get the newest copy of JEZ Tax Suite at tax.example.ph/app,')
    expect(newestCopyText('')).toBe('')
    expect(newestCopyText('javascript:alert(1)')).toBe('')
    expect(newestCopyText('http://insecure.example')).toBe('')
  })
})

describe('X17, X18: build and repository settings', () => {
  const root = path.resolve(__dirname, '../..')
  it('an accounts build may connect to the Supabase project over https only', () => {
    expect(supabaseConnectSources('https://abc.supabase.co')).toEqual(['https://abc.supabase.co'])
  })
  it('Dependabot watches npm packages and GitHub Actions', () => {
    const y = fs.readFileSync(path.join(root, '.github/dependabot.yml'), 'utf8')
    expect(y).toContain('package-ecosystem: npm')
    expect(y).toContain('package-ecosystem: github-actions')
  })
  it('CI stops on a high or critical advisory in a shipped package, and builds with the account secrets only from main', () => {
    const y = fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8')
    expect(y).toContain('npm audit --omit=dev --audit-level=high')
    expect(y).toContain("if: env.HAS_ACCOUNTS == 'true' && github.event_name != 'pull_request' && github.ref == 'refs/heads/main'")
  })
  it('the hardening migration keeps the constraint name the app recognises', () => {
    const sql = fs.readFileSync(path.join(root, 'supabase/migrations/0003_hardening.sql'), 'utf8')
    expect(sql).toContain('taxpayer_profiles_data_size check (octet_length(data::text) < 65536)')
    expect(sql).toContain("jsonb_typeof(data) = 'object'")
    expect(sql).toContain('force row level security')
  })
  it('deleting a profile in an account is limited to the signed-in user\'s rows', async () => {
    const client = mockClient()
    await createBackend({ client, storage: memoryStorage() }).deleteProfile('u1', 'r1')
    expect(client.queries[0]).toEqual([['from', 'taxpayer_profiles'], ['delete'], ['eq', 'id', 'r1'], ['eq', 'user_id', 'u1']])
  })
})

describe('U1, U9: the amount box', () => {
  const money = { parse: parseMoneyInput, format: formatMoneyInput }
  it('text with an error is left exactly as typed when the box loses focus', () => {
    const typed = '480000,50'
    const r = parseMoneyInput(typed)
    expect(r.ok).toBe(false)
    expect(textOnBlur({ text: typed, error: r.error, ...money })).toBe(typed) // used to become "48,000,050"
    expect(textOnBlur({ text: '1,00', error: parseMoneyInput('1,00').error, ...money })).toBe('1,00')
  })
  it('valid text still gets its thousands separators', () => {
    expect(textOnBlur({ text: '480000.5', error: null, ...money })).toBe('480,000.50')
    expect(textOnBlur({ text: '', error: null, ...money })).toBe('')
  })
  it('invalid text gives the value the box had when editing began, never a half-typed one', () => {
    // "Months in" was 10; the user selects all and types 13: "1" is valid, "13" is not.
    const months = t => parseIntegerInput(t, { min: 1, max: 12 })
    expect(valueForText(months('1'), { atFocus: 10 })).toBe(1)
    expect(valueForText(months('13'), { atFocus: 10 })).toBe(10) // used to stay at 1
    // A money box that held 480,000: "1e6" is not an amount.
    expect(valueForText(parseMoneyInput('1'), { atFocus: 480000 })).toBe(1)
    expect(valueForText(parseMoneyInput('1e6'), { atFocus: 480000 })).toBe(480000) // used to stay at 1
  })
  it('an emptied box gives the empty value', () => {
    expect(valueForText(parseMoneyInput(''), { atFocus: 5, emptyValue: null })).toBeNull()
    expect(valueForText(parseIntegerInput('7', { min: 1, max: 12 }), { atFocus: 5 })).toBe(7)
    expect(formatIntegerInput(7)).toBe('7')
  })
})

describe('U12: calendar-app export (.ics)', () => {
  const today = fromISO('2026-11-12')
  const p = { ...defaultProfile('individual'), name: 'Santos; Design, Studio', regime: 'graduated_osd', hasEmployees: true }
  const upcoming = generateDeadlines(OBLIGATIONS, p, { from: today, to: fromISO('2027-02-28'), holidays: HOLIDAY_SET, refDate: today })
  const ics = deadlineIcs({ upcoming, today, profileName: p.name })
  const lines = ics.split('\r\n')
  it('is a calendar with one all-day event per due date and two reminders each', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines[lines.length - 2]).toBe('END:VCALENDAR')
    expect(ics.charCodeAt(0)).not.toBe(0xFEFF)
    const events = ics.match(/BEGIN:VEVENT/g).length
    expect(events).toBe(upcoming.length)
    expect(ics.match(/BEGIN:VALARM/g).length).toBe(events * 2)
    expect(ics).toContain(`TRIGGER:-P${REMINDER_DAYS_BEFORE - 1}DT15H`)
    expect(ics).toContain('TRIGGER:PT9H')
  })
  it('the Q3 1701Q is an all-day event on Nov 16, 2026, with the notes shown on screen', () => {
    const i = lines.findIndex(l => l.startsWith('SUMMARY:1701Q: File & pay quarterly income tax (Q3 2026)'))
    expect(i).toBeGreaterThan(0)
    const event = lines.slice(lines.lastIndexOf('BEGIN:VEVENT', i), lines.indexOf('END:VEVENT', i)).join('\n').replace(/\n /g, '')
    expect(event).toContain('DTSTART;VALUE=DATE:20261116')
    expect(event).toContain('DTEND;VALUE=DATE:20261117')
    expect(event).toContain('allows until 2026-11-19')
    expect(event).toContain('rules as of')
  })
  it('text is escaped, long lines are folded at 75 bytes, and the name cannot break the file', () => {
    expect(icsText('a;b,c\\d\ne')).toBe('a\\;b\\,c\\\\d\\ne')
    expect(ics).toContain('X-WR-CALNAME:Tax deadlines (Santos\\; Design\\, Studio)')
    for (const l of lines) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75)
    const folded = foldLine('SUMMARY:' + '₱'.repeat(60))
    expect(folded.split('\r\n ').join('')).toBe('SUMMARY:' + '₱'.repeat(60))
    expect(deadlineIcsFileName('jez-tax-suite-deadlines-x-2026-11-12.csv')).toBe('jez-tax-suite-deadlines-x-2026-11-12.ics')
  })
})
