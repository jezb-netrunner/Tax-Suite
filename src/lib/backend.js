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

// Every key this app writes to browser storage starts with this prefix.
export const LOCAL_PREFIX = 'pv.'
export const LS_KEY = 'pv.profiles.v1'
export const ACTIVE_KEY = 'pv.activeProfile.v1'

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

export function createBackend({ client = null, storage } = {}) {
  const cloud = Boolean(client)
  const store = () => (storage !== undefined ? storage : globalThis.localStorage)

  function localLoad() {
    try { return JSON.parse(store().getItem(LS_KEY) || '[]') } catch { return [] }
  }
  function localSave(profiles) {
    // Let the failure surface. Swallowing it told the user their client was
    // saved when private-mode or a full quota had discarded it.
    try {
      store().setItem(LS_KEY, JSON.stringify(profiles))
    } catch (e) {
      throw new Error(
        'This browser refused to save the profile (storage may be full or blocked in private browsing). ' +
        'Your changes were not kept.'
      )
    }
  }

  async function listProfiles(userId) {
    if (!cloud) return localLoad()
    if (!userId) return []
    // Filter by the signed-in user as well as relying on row-level security.
    const { data, error } = await client
      .from('taxpayer_profiles')
      .select('id, data, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(r => ({ ...r.data, id: r.id }))
  }

  // Saves a whole profile: a new one (no id) is created; an existing one is
  // replaced. To change part of a saved profile use updateProfile, which
  // starts from the newest stored copy instead of this tab's.
  async function saveProfile(userId, profile) {
    if (!cloud) {
      const all = localLoad()
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
  // one, so figures, filed marks and registration answers saved from other
  // windows are kept. Refuses (PROFILE_GONE_MESSAGE) if the profile was
  // deleted elsewhere: it is never re-created. In accounts mode the write is
  // made only if the row's updated_at is still the one read (optimistic
  // concurrency); otherwise the row is read again and the change re-applied,
  // and after UPDATE_ATTEMPTS tries the save is refused with a message.
  async function updateProfile(userId, id, change) {
    if (!id) throw new Error('updateProfile needs the id of a saved profile.')
    if (!cloud) {
      // Read, change and write in one go (no await in between), so no other
      // tab can save in the middle.
      const all = localLoad()
      const i = all.findIndex(p => p && p.id === id)
      if (i < 0) throw goneError()
      const next = { ...change(all[i]), id }
      all[i] = next
      localSave(all)
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

  async function deleteProfile(userId, id) {
    if (!cloud) {
      localSave(localLoad().filter(p => p.id !== id))
      return
    }
    const { error } = await client.from('taxpayer_profiles').delete().eq('id', id)
    if (error) throw error
  }

  // M25 "Download my data": every profile with its saved figures, filed
  // marks and checklist ticks, as one JSON object.
  async function exportData({ userId = null, email = null, now = new Date() } = {}) {
    const head = { ...EXPORT_HEADER, exportedAt: now.toISOString() }
    if (!cloud) {
      let activeProfileId = null
      try { activeProfileId = store().getItem(ACTIVE_KEY) || null } catch { /* ignore */ }
      return { ...head, storedIn: 'this browser', activeProfileId, profiles: localLoad() }
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
    const left = []
    let imported = 0
    for (const p of localLeftovers()) {
      try {
        await saveProfile(userId, { ...p, id: null })
        imported++
      } catch {
        left.push(p)
      }
    }
    if (left.length) localSave(left)
    else eraseLocalLeftovers()
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
    localLeftovers, importLocalProfiles, eraseLocalLeftovers,
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
