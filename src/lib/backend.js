// Persistence backend.
//
// Two modes behind one interface:
//  - Supabase mode: real accounts + cloud-saved profiles (multi-tenant SaaS).
//    Enabled when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set.
//  - Local mode: no server configured — profiles live in this browser's
//    localStorage, clearly labeled in the UI. Lets the product run anywhere
//    (demos, self-hosting without an account system).

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hasCloud = Boolean(url && anonKey)
export const supabase = hasCloud ? createClient(url, anonKey) : null

const LS_KEY = 'pv.profiles.v1'

function localLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function localSave(profiles) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(profiles)) } catch { /* storage full/blocked */ }
}

function newId() {
  return (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2)
}

export async function listProfiles(userId) {
  if (!hasCloud) return localLoad()
  const { data, error } = await supabase
    .from('taxpayer_profiles')
    .select('id, data, updated_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map(r => ({ ...r.data, id: r.id }))
}

export async function saveProfile(userId, profile) {
  if (!hasCloud) {
    const all = localLoad()
    if (!profile.id) profile = { ...profile, id: newId() }
    const i = all.findIndex(p => p.id === profile.id)
    if (i >= 0) all[i] = profile; else all.push(profile)
    localSave(all)
    return profile
  }
  const row = { user_id: userId, data: { ...profile, id: undefined } }
  if (profile.id) {
    const { data, error } = await supabase
      .from('taxpayer_profiles')
      .update({ data: row.data, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select('id')
      .single()
    if (error) throw error
    return { ...profile, id: data.id }
  }
  const { data, error } = await supabase
    .from('taxpayer_profiles')
    .insert(row)
    .select('id')
    .single()
  if (error) throw error
  return { ...profile, id: data.id }
}

export async function deleteProfile(userId, id) {
  if (!hasCloud) {
    localSave(localLoad().filter(p => p.id !== id))
    return
  }
  const { error } = await supabase.from('taxpayer_profiles').delete().eq('id', id)
  if (error) throw error
}
