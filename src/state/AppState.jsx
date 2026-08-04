// Auth + profile state for the whole app.
//
// In cloud mode (Supabase configured) users sign in and their profiles sync.
// In local mode there is no sign-in; profiles persist in this browser only.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { hasCloud, supabase, listProfiles, saveProfile, deleteProfile } from '../lib/backend.js'

const Ctx = createContext(null)

export function useApp() {
  return useContext(Ctx)
}

const ACTIVE_KEY = 'pv.activeProfile.v1'

export function AppStateProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!hasCloud)
  const [profiles, setProfiles] = useState([])
  const [profilesReady, setProfilesReady] = useState(false)
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || null } catch { return null }
  })

  useEffect(() => {
    if (!hasCloud) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id || null
  const signedIn = hasCloud ? Boolean(userId) : true

  const refreshProfiles = useCallback(async () => {
    if (hasCloud && !userId) { setProfiles([]); setProfilesReady(true); return }
    try {
      const list = await listProfiles(userId)
      setProfiles(list)
    } catch (e) {
      console.error('Failed to load profiles', e)
      setProfiles([])
    }
    setProfilesReady(true)
  }, [userId])

  useEffect(() => { if (authReady) refreshProfiles() }, [authReady, refreshProfiles])

  const active = useMemo(
    () => profiles.find(p => p.id === activeId) || profiles[0] || null,
    [profiles, activeId]
  )

  const api = useMemo(() => ({
    hasCloud,
    session,
    authReady,
    signedIn,
    profiles,
    profilesReady,
    active,
    setActive(id) {
      setActiveId(id)
      try { localStorage.setItem(ACTIVE_KEY, id || '') } catch { /* ignore */ }
    },
    async save(profile) {
      const saved = await saveProfile(userId, profile)
      await refreshProfiles()
      if (!profile.id) {
        setActiveId(saved.id)
        try { localStorage.setItem(ACTIVE_KEY, saved.id) } catch { /* ignore */ }
      }
      return saved
    },
    async remove(id) {
      await deleteProfile(userId, id)
      await refreshProfiles()
      if (activeId === id) setActiveId(null)
    },
    async signOut() {
      if (hasCloud) await supabase.auth.signOut()
    },
  }), [session, authReady, signedIn, profiles, profilesReady, active, userId, activeId, refreshProfiles])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
