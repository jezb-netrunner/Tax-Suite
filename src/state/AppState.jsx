// Auth + profile state for the whole app.
//
// In cloud mode (Supabase configured) users sign in and their profiles sync.
// In local mode there is no sign-in; profiles persist in this browser only.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  hasCloud, supabase, listProfiles, saveProfile, deleteProfile, exportData, eraseLocalData, deleteOwnAccount,
  localLeftovers, importLocalProfiles, eraseLocalLeftovers, openedFromRecoveryLink, emailLinkError,
} from '../lib/backend.js'

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
  // A one-off message for the sign-in screen (e.g. after deleting the account).
  const [notice, setNotice] = useState(null)
  // M27: profiles this browser saved in local mode, found after signing in.
  const [leftovers, setLeftovers] = useState([])
  // M28: true while the user, back from a "reset your password" email link,
  // still has to choose a new password.
  const [recovery, setRecovery] = useState(openedFromRecoveryLink)
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || null } catch { return null }
  })

  useEffect(() => {
    if (!hasCloud) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
    })
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

  useEffect(() => { setLeftovers(hasCloud && userId ? localLeftovers() : []) }, [userId])

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
    userEmail: session?.user?.email || null,
    recovery: recovery && Boolean(session),
    endRecovery() { setRecovery(false) },
    linkError: emailLinkError,
    notice,
    clearNotice() { setNotice(null) },
    // M25 "Download my data": every profile and saved figure as one object.
    exportData() {
      return exportData({ userId, email: session?.user?.email || null })
    },
    // M25 "Erase all data on this device" (local mode).
    async eraseAllData() {
      eraseLocalData()
      setActiveId(null)
      await refreshProfiles()
    },
    // M27: leftover local-mode profiles, offered for import after sign-in.
    leftovers,
    async importLeftovers() {
      const r = await importLocalProfiles(userId)
      setLeftovers(localLeftovers())
      await refreshProfiles()
      return r
    },
    eraseLeftovers() {
      eraseLocalLeftovers()
      setLeftovers([])
    },
    // M25 "Delete my account" (accounts mode): the server deletes the login
    // and its profiles; this device is signed out.
    async deleteAccount() {
      await deleteOwnAccount()
      setActiveId(null)
      setNotice('Your account and every profile saved in it were deleted.')
      setSession(null)
    },
  }), [session, authReady, signedIn, profiles, profilesReady, loadError, active, userId, activeId, refreshProfiles, notice, leftovers, recovery])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
