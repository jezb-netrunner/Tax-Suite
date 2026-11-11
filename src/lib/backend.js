// Persistence backend.
//
// Two modes behind one interface:
//  - Supabase mode: real accounts + cloud-saved profiles (multi-tenant SaaS).
//    Enabled when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
//  - Local mode: no server configured — profiles live in this browser's
//    localStorage, clearly labeled in the UI. Lets the product run anywhere
//    (demos, self-hosting without an account system).
//
// createBackend({ client, storage }) builds the functions around a Supabase
// client (null = local mode) and a storage object (localStorage by default),
// so the tests can pass a mock client and an in-memory storage. The named
// exports below are bound to this app's real client and storage.

import { createClient } from '@supabase/supabase-js'
import { iso, manilaToday } from '../engine/dates.js'
import { withChangedInputs, PROFILE_TYPES } from '../engine/profile.js'
import { cleanProfile } from './backup.js'
import { isRecoveryLink, authLinkError } from './auth.js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasCloud = Boolean(url && anonKey)
export const supabase = hasCloud ? createClient(url, anonKey) : null

// M28: read once, as the app loads, whether it was opened from a "reset your
// password" email link, or from an email link that failed. Supabase removes
// the link's tokens from the address bar soon after.
const startHref = hasCloud && typeof window !== 'undefined' ? window.location.href : ''
export const openedFromRecoveryLink = Boolean(startHref) && isRecoveryLink(startHref)
export const emailLinkError = startHref ? authLinkError(startHref) : null

// X8: Supabase reports a password-reset sign-in with a PASSWORD_RECOVERY
// event, which can fire before the screens are drawn. Listening from here,
// straight after the client is created, never misses it.
let recoveryEvent = false
if (supabase) {
  supabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') recoveryEvent = true
    if (event === 'SIGNED_OUT') recoveryEvent = false
  })
}
export function recoveryEventSeen() {
  return recoveryEvent
}

// Every key this app writes to browser storage starts with this prefix.
export const LOCAL_PREFIX = 'pv.'
export const LS_KEY = 'pv.profiles.v1'
export const ACTIVE_KEY = 'pv.activeProfile.v1'
// M06 (accounts mode): estimator figures not yet saved to the account when the
// page was hidden or closed, kept here until the next load after sign-in.
export const PENDING_FIGURES_KEY = 'pv.pendingFigures.v1'
// Audit Nov 11, 2026: the Manila date of the last "Download my data" in this
// browser (local mode), for the backup reminder on the Profiles page.
export const LAST_BACKUP_KEY = 'pv.lastBackup.v1'
// Remind when the newest backup is older than this many days.
export const BACKUP_REMINDER_DAYS = 30
// Audit Nov 12, 2026 (X12): when each local-mode profile was last changed,
// { [profile id]: ISO time }, kept beside the profiles (never inside them).
export const STAMPS_KEY = 'pv.profileStamps.v1'
// X5: the profile list as it was before the last restore that replaced
// profiles, for "Undo this restore": { savedAt, profiles, stamps }.
export const BEFORE_RESTORE_KEY = 'pv.profiles.beforeRestore.v1'
// X1: a copy of stored profile data that could not be read, kept untouched.
export const DAMAGED_KEY_PREFIX = 'pv.profiles.v1.damaged.'
// X7: figures kept in a browser for an account are dropped after this long.
export const STASH_MAX_AGE_DAYS = 7

// "Download my data" file name, dated in Manila.
export function exportFileName(now = new Date()) {
  return `jez-tax-suite-data-${iso(manilaToday(now))}.json`
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2)
}

const EXPORT_HEADER = { app: 'JEZ Tax Suite', format: 'jez-tax-suite-export', version: 1 }

// L17: the most profiles one account may hold. The database enforces it
// (supabase/migrations/0002); keep the two in step.
export const PROFILE_LIMIT = 500

// Database errors from saving a profile, in plain words. The server's own
// text is never shown.
function saveError(error) {
  const code = error && error.code
  const text = (error && error.message) || ''
  if (code === '23514' && text.includes('taxpayer_profiles_data_size')) {
    return new Error('This profile is too large to save. Clear figures you no longer need, or split it into two profiles.')
  }
  if (code === 'P0001' && text.includes('profile limit')) {
    return new Error(`This account already has ${PROFILE_LIMIT} profiles, the most it can hold. Delete profiles you no longer need, then try again.`)
  }
  return new Error('The profile could not be saved. Please try again.')
}

// C07: a save never re-creates a profile that another window (or device)
// deleted, and never writes over a newer version of it.
export const PROFILE_GONE_MESSAGE = 'This profile was deleted in another window.'
export const PROFILE_CONFLICT_MESSAGE =
  'This profile was changed in another window or on another device at the same time, so this change was not saved. Please try again.'

function goneError() {
  const e = new Error(PROFILE_GONE_MESSAGE)
  e.code = 'profile-gone'
  return e
}

// X1: the stored profile list exists but cannot be read (cut short, or not a
// list). Nothing is written while it is in that state: a write would replace
// it, and whatever could still be recovered from it would be gone.
export const DAMAGED_DATA_MESSAGE =
  'The profiles saved in this browser could not be read, so nothing was changed. On the Profiles page, download a copy of the saved data, then erase the data on this device and restore your latest backup.'

function damagedError() {
  const e = new Error(DAMAGED_DATA_MESSAGE)
  e.code = 'damaged-data'
  return e
}

// X7: figures typed in this browser that are older than the account's copy.
function staleFiguresError(when) {
  const e = new Error(`Figures typed in this browser on ${when} were not saved, because this profile was changed later on another device or the figures were more than ${STASH_MAX_AGE_DAYS} days old.`)
  e.code = 'stale-figures'
  return e
}

// The same content whatever the order of the keys (X4: a profile that is
// already stored, apart from its id, is not added again by a restore).
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical)
  if (x && typeof x === 'object') {
    const out = {}
    for (const k of Object.keys(x).sort()) if (x[k] !== undefined) out[k] = canonical(x[k])
    return out
  }
  return x
}
function contentKey(profile) {
  const rest = { ...profile }
  delete rest.id
  return JSON.stringify(canonical(rest))
}

function conflictError() {
  const e = new Error(PROFILE_CONFLICT_MESSAGE)
  e.code = 'profile-conflict'
  return e
}

// How many times an accounts-mode update re-reads the row when another
// window or device saved it between the read and the write.
const UPDATE_ATTEMPTS = 3

// C07: calls onChange when the saved profiles may have been changed elsewhere,
// so this tab never keeps working on an old copy. Local mode: the browser's
// "storage" event, which fires in every other tab of this site when one tab
// writes the profile list (key null = storage cleared). Accounts mode: the tab
// becoming visible again (other devices do not fire storage events).
// Returns a function that stops watching.
export function watchProfileChanges(onChange, { cloud = hasCloud, win = globalThis.window, doc = globalThis.document } = {}) {
  if (!cloud) {
    if (!win || typeof win.addEventListener !== 'function') return () => {}
    const onStorage = e => { if (e.key === LS_KEY || e.key === null) onChange() }
    win.addEventListener('storage', onStorage)
    return () => win.removeEventListener('storage', onStorage)
  }
  if (!doc || typeof doc.addEventListener !== 'function') return () => {}
  const onVisible = () => { if (doc.visibilityState === 'visible') onChange() }
  doc.addEventListener('visibilitychange', onVisible)
  return () => doc.removeEventListener('visibilitychange', onVisible)
}

// Audit Nov 2026 (S11): only well-formed profiles reach the pages (an object
// with an id and a known taxpayer type). Anything else in storage (edited by
// hand, or written by another site on a shared address) used to blank every
// page; it is now left in storage untouched but not shown.
export function usableProfiles(list) {
  if (!Array.isArray(list)) return []
  return list.filter(p => p && typeof p === 'object' && typeof p.id === 'string' && p.id !== '' && Object.prototype.hasOwnProperty.call(PROFILE_TYPES, p.type))
}

export function createBackend({ client = null, storage } = {}) {
  const cloud = Boolean(client)
  const store = () => (storage !== undefined ? storage : globalThis.localStorage)

  // X1: { list, damaged, raw }. Missing or empty storage is an empty list;
  // text that is not a JSON list is "damaged" and is never taken for "no
  // profiles yet".
  function readStored() {
    let raw
    try { raw = store().getItem(LS_KEY) } catch { return { list: [], damaged: false, raw: null } }
    if (raw === null || raw === '') return { list: [], damaged: false, raw }
    try {
      const list = JSON.parse(raw)
      if (Array.isArray(list)) return { list, damaged: false, raw }
    } catch { /* not JSON */ }
    return { list: [], damaged: true, raw }
  }
  // Keeps the unreadable text under its own key (once per day), so it survives
  // whatever the user does next short of erasing everything.
  function keepDamagedCopy(raw) {
    try {
      const key = DAMAGED_KEY_PREFIX + iso(manilaToday())
      if (store().getItem(key) === null) store().setItem(key, raw)
    } catch { /* storage full or blocked: the original is still in place */ }
  }
  // For reading in accounts mode (leftovers) and for the export.
  function localLoad() {
    return readStored().list
  }
  // For every local-mode read or write of the live list: refuses damaged data.
  function localLoadStrict() {
    const r = readStored()
    if (r.damaged) {
      keepDamagedCopy(r.raw)
      throw damagedError()
    }
    return r.list
  }

  // X12: last-changed times of local-mode profiles.
  function readStamps() {
    try {
      const m = JSON.parse(store().getItem(STAMPS_KEY) || '{}')
      return m && typeof m === 'object' && !Array.isArray(m) ? m : {}
    } catch { return {} }
  }
  function writeStamps(map) {
    try { store().setItem(STAMPS_KEY, JSON.stringify(map)) } catch { /* the stamps are a convenience only */ }
  }
  function stamp(ids, now = new Date()) {
    const map = readStamps()
    const t = now.toISOString()
    for (const id of ids) map[id] = t
    writeStamps(map)
  }
  // Accounts mode: the database's updated_at of each profile, as last listed.
  let cloudStamps = {}
  // { [profile id]: ISO time of the last change }, for display.
  function profileStamps() {
    if (cloud) return { ...cloudStamps }
    const map = readStamps()
    const out = {}
    for (const k of Object.keys(map)) if (typeof map[k] === 'string' && !Number.isNaN(Date.parse(map[k]))) out[k] = map[k]
    return out
  }
  function localSave(profiles) {
    // Let the failure surface. Swallowing it told the user their client was
    // saved when private-mode or a full quota had discarded it.
    try {
      store().setItem(LS_KEY, JSON.stringify(profiles))
    } catch (e) {
      // L22: keep the browser's own error as the cause for debugging; the
      // message shown to the user stays in plain words.
      throw new Error(
        'This browser refused to save the profile (storage may be full or blocked in private browsing). ' +
        'Your changes were not kept.',
        { cause: e }
      )
    }
  }

  async function listProfiles(userId) {
    if (!cloud) return usableProfiles(localLoadStrict())
    if (!userId) return []
    // Filter by the signed-in user as well as relying on row-level security.
    const { data, error } = await client
      .from('taxpayer_profiles')
      .select('id, data, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    cloudStamps = Object.fromEntries(data.filter(r => r && r.updated_at).map(r => [r.id, r.updated_at]))
    return usableProfiles(data.map(r => ({ ...r.data, id: r.id })))
  }

  // Saves a whole profile: a new one (no id) is created; an existing one is
  // replaced. To change part of a saved profile use updateProfile, which
  // starts from the newest stored copy instead of this tab's.
  async function saveProfile(userId, profile) {
    if (!cloud) {
      const all = localLoadStrict()
      if (!profile.id) {
        profile = { ...profile, id: newId() }
        all.push(profile)
      } else {
        const i = all.findIndex(p => p && p.id === profile.id)
        // C07: deleted in another tab. Saving must not bring it back.
        if (i < 0) throw goneError()
        all[i] = profile
      }
      localSave(all)
      stamp([profile.id])
      return profile
    }
    const row = { user_id: userId, data: { ...profile, id: undefined } }
    if (profile.id) {
      // The database stamps updated_at (0002), so only the data is sent.
      const { data, error } = await client
        .from('taxpayer_profiles')
        .update({ data: row.data })
        .eq('id', profile.id)
        .eq('user_id', userId)
        .select('id')
        .single()
      // PGRST116: no row matched, so the profile was deleted elsewhere.
      if (error && error.code === 'PGRST116') throw goneError()
      if (error) throw saveError(error)
      return { ...profile, id: data.id }
    }
    const { data, error } = await client
      .from('taxpayer_profiles')
      .insert(row)
      .select('id')
      .single()
    if (error) throw saveError(error)
    return { ...profile, id: data.id }
  }

  // C07: changes one saved profile without writing back an old copy of it.
  // change(latest) receives the newest stored version and returns the new
  // one, so figures and registration answers saved from other windows are
  // kept. Refuses (PROFILE_GONE_MESSAGE) if the profile was
  // deleted elsewhere: it is never re-created. In accounts mode the write is
  // made only if the row's updated_at is still the one read (optimistic
  // concurrency); otherwise the row is read again and the change re-applied,
  // and after UPDATE_ATTEMPTS tries the save is refused with a message.
  // notNewerThan (X7, accounts mode): a time in ms; the change is refused
  // when the stored row was changed after it.
  async function updateProfile(userId, id, change, { notNewerThan = null, when = '' } = {}) {
    if (!id) throw new Error('updateProfile needs the id of a saved profile.')
    if (!cloud) {
      // Read, change and write in one go (no await in between), so no other
      // tab can save in the middle.
      const all = localLoadStrict()
      const i = all.findIndex(p => p && p.id === id)
      if (i < 0) throw goneError()
      const next = { ...change(all[i]), id }
      all[i] = next
      localSave(all)
      stamp([id])
      return next
    }
    for (let attempt = 0; attempt < UPDATE_ATTEMPTS; attempt++) {
      const { data: rows, error } = await client
        .from('taxpayer_profiles')
        .select('id, data, updated_at')
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw saveError(error)
      if (!rows || !rows.length) throw goneError()
      const row = rows[0]
      if (notNewerThan !== null && row.updated_at && Date.parse(row.updated_at) > notNewerThan) throw staleFiguresError(when)
      const next = { ...change({ ...row.data, id }), id }
      const { data: written, error: writeError } = await client
        .from('taxpayer_profiles')
        .update({ data: { ...next, id: undefined } })
        .eq('id', id)
        .eq('user_id', userId)
        .eq('updated_at', row.updated_at)
        .select('id, updated_at')
      if (writeError) throw saveError(writeError)
      if (written && written.length) return next
      // Nothing written: saved (or deleted) elsewhere since the read. Try again.
    }
    throw conflictError()
  }

  // M06 (accounts mode): saving to the account is a read and then a
  // conditional write over the network, which cannot finish while the page is
  // being reloaded or closed. stashFigures keeps the figures not yet saved in
  // this browser, synchronously, inside the pagehide / visibilitychange event;
  // each { userId, profileId, key } has one entry, later changes merged in. It
  // returns a stamp for clearStashedFigures, which removes the entry once the
  // save succeeded, unless newer figures were kept since. replayStashedFigures
  // runs on the next load after sign-in. Local mode needs none of this: its
  // save is done inside the event, so stashFigures does nothing there.
  function readStash() {
    try {
      const list = JSON.parse(store().getItem(PENDING_FIGURES_KEY) || '[]')
      return Array.isArray(list) ? list.filter(e => e && typeof e === 'object') : []
    } catch { return [] }
  }
  function writeStash(list) {
    if (list.length) store().setItem(PENDING_FIGURES_KEY, JSON.stringify(list))
    else store().removeItem(PENDING_FIGURES_KEY)
  }
  const sameEntry = (e, w) => e.userId === w.userId && e.profileId === w.profileId && e.key === w.key
  let stashCount = 0

  function stashFigures({ userId, profileId, key, values }) {
    if (!cloud || !profileId || !key) return null
    try {
      const list = readStash()
      const where = { userId, profileId, key }
      const i = list.findIndex(e => sameEntry(e, where))
      const stamp = `${Date.now()}-${++stashCount}`
      const entry = { ...where, values: { ...(i >= 0 ? list[i].values : {}), ...values }, stamp }
      if (i >= 0) list[i] = entry
      else list.push(entry)
      writeStash(list)
      return stamp
    } catch {
      return null // storage blocked or full: the account save still runs
    }
  }

  function clearStashedFigures({ userId, profileId, key, stamp }) {
    try {
      const list = readStash()
      const left = list.filter(e => !(sameEntry(e, { userId, profileId, key }) && e.stamp === stamp))
      if (left.length !== list.length) writeStash(left)
    } catch { /* nothing to clear */ }
  }

  // Saves this user's kept figures onto the newest stored profiles. Entries
  // saved, or whose profile was deleted meanwhile, are removed; entries that
  // failed for another reason stay for the next load. Returns
  // { saved, problems: [Error] }.
  async function replayStashedFigures(userId, { now = new Date() } = {}) {
    const result = { saved: 0, problems: [] }
    if (!cloud || !userId) return result
    for (const e of readStash().filter(x => x.userId === userId)) {
      let drop
      // X7: the entry's stamp starts with the time it was kept. Figures kept
      // long ago, or older than the account's copy of the profile (changed
      // since on another device), are dropped with a notice, never applied.
      const keptAt = Number(String(e.stamp || '').split('-')[0])
      const known = Number.isFinite(keptAt) && keptAt > 0
      const when = known ? iso(manilaToday(new Date(keptAt))) : 'an earlier visit'
      try {
        if (known && now.getTime() - keptAt > STASH_MAX_AGE_DAYS * 86400000) throw staleFiguresError(when)
        await updateProfile(userId, e.profileId, p => withChangedInputs(p, e.key, e.values || {}), known ? { notNewerThan: keptAt, when } : {})
        result.saved++
        drop = true
      } catch (err) {
        result.problems.push(err)
        drop = err && (err.code === 'profile-gone' || err.code === 'stale-figures')
      }
      if (drop) clearStashedFigures(e)
    }
    return result
  }

  async function deleteProfile(userId, id) {
    if (!cloud) {
      // Entries that are not profiles (X1) are left where they are.
      localSave(localLoadStrict().filter(p => !(p && p.id === id)))
      const map = readStamps()
      if (id in map) { delete map[id]; writeStamps(map) }
      return
    }
    // X15: like every other call, limited to the signed-in user's own rows.
    let q = client.from('taxpayer_profiles').delete().eq('id', id)
    if (userId) q = q.eq('user_id', userId)
    const { error } = await q
    if (error) throw error
  }

  // M25 "Download my data": every profile as stored (saved figures, and any
  // marks saved before "Mark as filed" and the checklist tick boxes were
  // removed), as one JSON object.
  async function exportData({ userId = null, email = null, now = new Date() } = {}) {
    const head = { ...EXPORT_HEADER, exportedAt: now.toISOString() }
    if (!cloud) {
      let activeProfileId = null
      try { activeProfileId = store().getItem(ACTIVE_KEY) || null } catch { /* ignore */ }
      const stored = readStored()
      // X1: stored data that cannot be read is handed over as it is, clearly
      // marked, never as an empty (and misleading) backup.
      if (stored.damaged) {
        keepDamagedCopy(stored.raw)
        return { ...head, storedIn: 'this browser', activeProfileId: null, profiles: [], unreadable: true, unreadableData: stored.raw }
      }
      const profiles = stored.list
      // Audit Nov 2026 (S7): never name a profile that is no longer stored.
      if (!profiles.some(p => p && p.id === activeProfileId)) activeProfileId = null
      // X12: when each profile was last changed, as in an account's export.
      const stamps = profileStamps()
      const records = profiles.filter(p => p && stamps[p.id]).map(p => ({ id: p.id, updatedAt: stamps[p.id] }))
      return { ...head, storedIn: 'this browser', activeProfileId, profiles, records }
    }
    const { data, error } = await client
      .from('taxpayer_profiles')
      .select('id, data, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw new Error('We could not fetch your data. Please try again in a moment.')
    return {
      ...head,
      storedIn: 'your account',
      account: { email },
      profiles: data.map(r => ({ ...r.data, id: r.id })),
      records: data.map(r => ({ id: r.id, createdAt: r.created_at, updatedAt: r.updated_at })),
    }
  }

  // Audit Nov 11, 2026: "Restore from a backup file". `incoming` are clean
  // profiles from parseBackup (src/lib/backup.js). A profile whose id is
  // already stored is left as it is unless replaceExisting is true; one with
  // a new id (or none) is added. Nothing is ever deleted, and the account
  // limit (PROFILE_LIMIT) holds. Local mode writes once, so a failed write
  // changes nothing. Returns { added, replaced, kept, overLimit, failed }.
  async function importProfiles(userId, incoming, { replaceExisting = false, now = new Date() } = {}) {
    const result = { added: 0, replaced: 0, kept: 0, overLimit: 0, failed: 0, canUndo: false }
    // X20: whatever is handed in is cleaned again here, so nothing unchecked
    // can be stored even if a caller forgets to.
    const thisYear = manilaToday(now).getFullYear()
    const list = (Array.isArray(incoming) ? incoming : []).map(p => cleanProfile(p, { thisYear })).filter(Boolean)
    if (!cloud) {
      const all = localLoadStrict()
      const before = JSON.stringify(all)
      // X4: a profile already stored with the same content (apart from its
      // id) is not added a second time, so a restore can be repeated safely.
      const contents = new Set(all.filter(x => x && typeof x === 'object').map(contentKey))
      const changed = []
      for (const p of list) {
        const i = p.id ? all.findIndex(x => x && x.id === p.id) : -1
        if (i >= 0) {
          if (replaceExisting && contentKey(all[i]) !== contentKey(p)) {
            all[i] = { ...p }
            changed.push(p.id)
            result.replaced++
          } else result.kept++
        } else if (contents.has(contentKey(p))) {
          result.kept++
        } else if (all.length >= PROFILE_LIMIT) {
          result.overLimit++
        } else {
          const added = { ...p, id: p.id || newId() }
          all.push(added)
          contents.add(contentKey(added))
          changed.push(added.id)
          result.added++
        }
      }
      if (changed.length) {
        // X5: what was here before a replace is kept for "Undo this restore".
        if (result.replaced) {
          try {
            store().setItem(BEFORE_RESTORE_KEY, JSON.stringify({ savedAt: now.toISOString(), profiles: JSON.parse(before), stamps: readStamps() }))
            result.canUndo = true
          } catch { /* no room for the copy: the restore still goes ahead */ }
        }
        localSave(all)
        stamp(changed, now)
      }
      return result
    }
    if (!userId) throw new Error('Sign in before restoring a backup.')
    const stored = await listProfiles(userId)
    const byId = new Map(stored.map(p => [p.id, p]))
    const contents = new Set(stored.map(contentKey))
    let count = stored.length
    for (const p of list) {
      const here = p.id ? byId.get(p.id) : null
      try {
        if (here) {
          if (!replaceExisting || contentKey(here) === contentKey(p)) { result.kept++; continue }
          await saveProfile(userId, p)
          result.replaced++
        } else if (contents.has(contentKey(p))) {
          result.kept++
        } else if (count >= PROFILE_LIMIT) {
          result.overLimit++
        } else {
          await saveProfile(userId, { ...p, id: null })
          contents.add(contentKey(p))
          count++
          result.added++
        }
      } catch {
        result.failed++
      }
    }
    return result
  }

  // X5 "Undo this restore" (local mode): puts back the profile list as it was
  // before the last restore that replaced profiles. Profiles added since (by
  // that restore or by hand) go too, which the button's text says.
  function restoreUndoInfo() {
    if (cloud) return null
    try {
      const u = JSON.parse(store().getItem(BEFORE_RESTORE_KEY) || 'null')
      return u && Array.isArray(u.profiles) && typeof u.savedAt === 'string' ? { savedAt: u.savedAt, count: usableProfiles(u.profiles).length } : null
    } catch { return null }
  }
  function undoRestore() {
    if (cloud) throw new Error('A restore into an account cannot be undone here.')
    let u = null
    try { u = JSON.parse(store().getItem(BEFORE_RESTORE_KEY) || 'null') } catch { /* handled below */ }
    if (!u || !Array.isArray(u.profiles)) throw new Error('There is no restore to undo.')
    localLoadStrict() // refuses while the stored list is unreadable
    localSave(u.profiles)
    if (u.stamps && typeof u.stamps === 'object') writeStamps(u.stamps)
    try { store().removeItem(BEFORE_RESTORE_KEY) } catch { /* ignore */ }
    return { restored: usableProfiles(u.profiles).length }
  }

  // The Manila date ('YYYY-MM-DD') of the last "Download my data" in this
  // browser, or null. Local mode only: an account's data is not lost with the
  // browser's storage.
  function lastBackupDate() {
    if (cloud) return null
    try {
      const v = store().getItem(LAST_BACKUP_KEY)
      return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
    } catch { return null }
  }
  // onlyIfLater: for a restored file's own date; never moves the date back,
  // and a date in the future (a wrong clock, an edited file) is ignored.
  function noteBackup(now = new Date(), { onlyIfLater = false } = {}) {
    if (cloud) return
    try {
      const d = iso(manilaToday(now))
      if (onlyIfLater) {
        const current = lastBackupDate()
        if ((current && current >= d) || d > iso(manilaToday())) return
      }
      store().setItem(LAST_BACKUP_KEY, d)
    } catch { /* the reminder simply stays */ }
  }

  // M25 / M27 "Erase all data on this device": removes every key this app
  // wrote (all start with "pv."), and nothing belonging to other sites or to
  // the sign-in session. Returns how many keys were removed.
  function eraseLocalData() {
    try {
      const s = store()
      const keys = []
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i)
        if (k && k.startsWith(LOCAL_PREFIX)) keys.push(k)
      }
      for (const k of keys) s.removeItem(k)
      return keys.length
    } catch {
      throw new Error("This browser blocked the erase. Clear this site's data in your browser settings instead.")
    }
  }

  // M27: profiles a browser saved in local mode stay in its storage when the
  // site switches to accounts mode. In accounts mode they are "leftovers" the
  // user may import into the account or erase; in local mode they are simply
  // the live profiles, so there are none.
  function localLeftovers() {
    if (!cloud) return []
    const list = localLoad()
    return Array.isArray(list) ? list.filter(p => p && typeof p === 'object') : []
  }

  // Saves each leftover as a new profile of this user. Profiles that could not
  // be saved stay in this browser, so nothing is lost.
  async function importLocalProfiles(userId) {
    const todo = localLeftovers()
    const left = []
    let imported = 0
    for (let i = 0; i < todo.length; i++) {
      try {
        await saveProfile(userId, { ...todo[i], id: null })
        imported++
      } catch {
        left.push(todo[i])
      }
      // X20: the browser copy shrinks as each one is saved, so an import that
      // is cut short never saves the same profile twice on the next try.
      const rest = [...left, ...todo.slice(i + 1)]
      if (rest.length) localSave(rest)
      else eraseLocalLeftovers()
    }
    return { imported, failed: left.length }
  }

  // "Erase them": removes only the leftover profile list, not the sign-in
  // session or the account's selected profile.
  function eraseLocalLeftovers() {
    try { store().removeItem(LS_KEY) } catch {
      throw new Error("This browser blocked the erase. Clear this site's data in your browser settings instead.")
    }
  }

  // M25 "Delete my account": the database function delete_own_account()
  // (supabase/migrations/0002) deletes the signed-in login; its profiles go
  // with it (ON DELETE CASCADE). Then the session is dropped on this device.
  async function deleteOwnAccount() {
    if (!cloud) throw new Error('There is no account to delete in local mode.')
    const { error } = await client.rpc('delete_own_account')
    if (error) throw new Error('We could not delete your account, so nothing was deleted. Please try again in a moment.')
    try { await client.auth.signOut({ scope: 'local' }) } catch { /* the login no longer exists */ }
    try { eraseLocalData() } catch { /* nothing left that matters */ }
  }

  return {
    hasCloud: cloud, listProfiles, saveProfile, updateProfile, deleteProfile, exportData, eraseLocalData, deleteOwnAccount,
    localLeftovers, importLocalProfiles, eraseLocalLeftovers, stashFigures, clearStashedFigures, replayStashedFigures,
    importProfiles, lastBackupDate, noteBackup, profileStamps, restoreUndoInfo, undoRestore,
  }
}

const app = createBackend({ client: supabase })

export const listProfiles = (...a) => app.listProfiles(...a)
export const saveProfile = (...a) => app.saveProfile(...a)
export const updateProfile = (...a) => app.updateProfile(...a)
export const deleteProfile = (...a) => app.deleteProfile(...a)
export const exportData = (...a) => app.exportData(...a)
export const eraseLocalData = (...a) => app.eraseLocalData(...a)
export const deleteOwnAccount = (...a) => app.deleteOwnAccount(...a)
export const localLeftovers = (...a) => app.localLeftovers(...a)
export const importLocalProfiles = (...a) => app.importLocalProfiles(...a)
export const eraseLocalLeftovers = (...a) => app.eraseLocalLeftovers(...a)
export const stashFigures = (...a) => app.stashFigures(...a)
export const clearStashedFigures = (...a) => app.clearStashedFigures(...a)
export const replayStashedFigures = (...a) => app.replayStashedFigures(...a)
export const importProfiles = (...a) => app.importProfiles(...a)
export const lastBackupDate = (...a) => app.lastBackupDate(...a)
export const noteBackup = (...a) => app.noteBackup(...a)
export const profileStamps = (...a) => app.profileStamps(...a)
export const restoreUndoInfo = (...a) => app.restoreUndoInfo(...a)
export const undoRestore = (...a) => app.undoRestore(...a)
