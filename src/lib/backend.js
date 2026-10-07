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

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasCloud = Boolean(url && anonKey)
export const supabase = hasCloud ? createClient(url, anonKey) : null

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
    const { data, error } = await client
      .from('taxpayer_profiles')
      .select('id, data, updated_at')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data.map(r => ({ ...r.data, id: r.id }))
  }

  async function saveProfile(userId, profile) {
    if (!cloud) {
      const all = localLoad()
      if (!profile.id) profile = { ...profile, id: newId() }
      const i = all.findIndex(p => p.id === profile.id)
      if (i >= 0) all[i] = profile; else all.push(profile)
      localSave(all)
      return profile
    }
    const row = { user_id: userId, data: { ...profile, id: undefined } }
    if (profile.id) {
      const { data, error } = await client
        .from('taxpayer_profiles')
        .update({ data: row.data, updated_at: new Date().toISOString() })
        .eq('id', profile.id)
        .select('id')
        .single()
      if (error) throw error
      return { ...profile, id: data.id }
    }
    const { data, error } = await client
      .from('taxpayer_profiles')
      .insert(row)
      .select('id')
      .single()
    if (error) throw error
    return { ...profile, id: data.id }
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
    hasCloud: cloud, listProfiles, saveProfile, deleteProfile, exportData, eraseLocalData, deleteOwnAccount,
    localLeftovers, importLocalProfiles, eraseLocalLeftovers,
  }
}

const app = createBackend({ client: supabase })

export const listProfiles = (...a) => app.listProfiles(...a)
export const saveProfile = (...a) => app.saveProfile(...a)
export const deleteProfile = (...a) => app.deleteProfile(...a)
export const exportData = (...a) => app.exportData(...a)
export const eraseLocalData = (...a) => app.eraseLocalData(...a)
export const deleteOwnAccount = (...a) => app.deleteOwnAccount(...a)
export const localLeftovers = (...a) => app.localLeftovers(...a)
export const importLocalProfiles = (...a) => app.importLocalProfiles(...a)
export const eraseLocalLeftovers = (...a) => app.eraseLocalLeftovers(...a)
