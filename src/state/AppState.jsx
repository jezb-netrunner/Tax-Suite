// Auth + profile state for the whole app.
//
// In cloud mode (Supabase configured) users sign in and their profiles sync.
// In local mode there is no sign-in; profiles persist in this browser only.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
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
  const [loadError, setLoadError] = useState(null)
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

  // Every fetch carries a token. A response is applied only if it is still the
  // newest request AND was issued for the user who is signed in now — otherwise
  // a slow response from a previous session could paint another account's
  // profiles over this one's.
  const reqToken = useRef(0)

  const refreshProfiles = useCallback(async () => {
    const token = ++reqToken.current
    const forUser = userId
    setLoadError(null)
    if (hasCloud && !forUser) { setProfiles([]); setProfilesReady(true); return }
    try {
      const list = await listProfiles(forUser)
      if (token !== reqToken.current) return
      setProfiles(list)
    } catch (e) {
      if (token !== reqToken.current) return
      console.error('Failed to load profiles', e)
      // Don't render a failed fetch as "no profiles yet" — that reads as data
      // loss to someone who has clients saved.
      setLoadError(e)
      setProfiles([])
    }
    if (token === reqToken.current) setProfilesReady(true)
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
    loadError,
    retryLoad: refreshProfiles,
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
  }), [session, authReady, signedIn, profiles, profilesReady, loadError, active, userId, activeId, refreshProfiles])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
