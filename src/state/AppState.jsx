// Auth + profile state for the whole app.
//
// In cloud mode (Supabase configured) users sign in and their profiles sync.
// In local mode there is no sign-in; profiles persist in this browser only.

import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  hasCloud, supabase, listProfiles, saveProfile, deleteProfile, exportData, eraseLocalData, deleteOwnAccount,
  localLeftovers, importLocalProfiles, eraseLocalLeftovers, openedFromRecoveryLink, emailLinkError,
  updateProfile as updateStoredProfile, watchProfileChanges, stashFigures, clearStashedFigures, replayStashedFigures,
  importProfiles, lastBackupDate, noteBackup, profileStamps, restoreUndoInfo, undoRestore, recoveryEventSeen,
} from '../lib/backend.js'
import { figuresNotSaved, flushPendingSaves } from '../lib/inputSaver.js'
import { sessionFromRecovery } from '../lib/auth.js'

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
  // C07: the last background save that failed (estimator figures), shown
  // by <SaveNotice /> until dismissed. An Error; its message is shown.
  const [saveProblem, setSaveProblem] = useState(null)
  // M27: profiles this browser saved in local mode, found after signing in.
  const [leftovers, setLeftovers] = useState([])
  // M28: true while the user, back from a "reset your password" email link,
  // still has to choose a new password.
  const [recovery, setRecovery] = useState(openedFromRecoveryLink)
  // True once Supabase itself reported a password-reset sign-in.
  const [recoveryEvent, setRecoveryEvent] = useState(() => recoveryEventSeen())
  const [backupDate, setBackupDate] = useState(() => lastBackupDate())
  // Audit Nov 12, 2026 (X12): when each profile was last changed, { id: ISO }.
  const [lastChanged, setLastChanged] = useState({})
  // X5: a restore that replaced profiles can be undone (local mode).
  const [undoInfo, setUndoInfo] = useState(() => restoreUndoInfo())
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || null } catch { return null }
  })

  useEffect(() => {
    if (!hasCloud) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    }).catch(() => {
      // X19: never leave a blank screen; the sign-in page is shown instead.
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setRecoveryEvent(true) }
      if (event === 'SIGNED_OUT') { setRecovery(false); setRecoveryEvent(false) }
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
  // The user whose profile list is on screen (null in local mode; undefined
  // before the first successful load).
  const loadedFor = useRef(undefined)

  // { background: true }: a check for changes made elsewhere (C07). If it
  // fails, the list already on screen for this user stays; nothing was lost.
  const refreshProfiles = useCallback(async (opts) => {
    const background = Boolean(opts && opts.background)
    const token = ++reqToken.current
    const forUser = userId
    if (!background) setLoadError(null)
    if (hasCloud && !forUser) { setProfiles([]); setProfilesReady(true); return }
    try {
      const list = await listProfiles(forUser)
      if (token !== reqToken.current) return
      setProfiles(list)
      setLastChanged(profileStamps())
      setLoadError(null)
      loadedFor.current = forUser
    } catch (e) {
      if (token !== reqToken.current) return
      console.error('Failed to load profiles', e)
      if (background && loadedFor.current === forUser) return
      // Don't render a failed fetch as "no profiles yet" — that reads as data
      // loss to someone who has clients saved.
      setLoadError(e)
      setProfiles([])
      loadedFor.current = undefined
    }
    if (token === reqToken.current) setProfilesReady(true)
  }, [userId])

  useEffect(() => { if (authReady) refreshProfiles() }, [authReady, refreshProfiles])

  // C07: profiles changed in another tab (or, in accounts mode, on another
  // device) are reloaded, so this tab never keeps working on an old copy.
  useEffect(() => {
    if (!authReady) return undefined
    return watchProfileChanges(() => { refreshProfiles({ background: true }) })
  }, [authReady, refreshProfiles])

  useEffect(() => { setLeftovers(hasCloud && userId ? localLeftovers() : []) }, [userId])

  // M06 (accounts mode): estimator figures kept in this browser because the
  // page was reloaded or closed before they reached the account are saved now,
  // after sign-in; a failure shows "Couldn't save your figures." (SaveNotice).
  useEffect(() => {
    if (!hasCloud || !authReady || !userId) return undefined
    let current = true
    replayStashedFigures(userId).then(r => {
      if (!current) return
      if (r.saved) refreshProfiles({ background: true })
      if (r.problems.length) setSaveProblem(figuresNotSaved(r.problems[0]))
    })
    return () => { current = false }
  }, [authReady, userId, refreshProfiles])

  const active = useMemo(
    () => profiles.find(p => p.id === activeId) || profiles[0] || null,
    [profiles, activeId]
  )

  // Audit Nov 2026 (U17): the profile in use was deleted in another window or
  // tab. The app used to switch to the next profile without a word, so the
  // next figure typed went to another client. Now it says so (SaveNotice) and
  // makes the profile it shows the active one. A delete made here is not
  // reported (removingId).
  const previousProfiles = useRef({ userId: null, list: [] })
  const removingId = useRef(null)
  useEffect(() => {
    const before = previousProfiles.current
    previousProfiles.current = { userId, list: profiles }
    // Only a switch to ANOTHER profile is risky; an emptied list (erased, or
    // signed out) or another signed-in user is not this case.
    if (!activeId || removingId.current === activeId || before.userId !== userId || profiles.length === 0) return
    const gone = before.list.find(p => p.id === activeId)
    if (!gone || profiles.some(p => p.id === activeId)) return
    const next = profiles[0]
    setSaveProblem(new Error(
      `${gone.name || 'The profile you were using'} was deleted in another window.` +
      ` Now showing ${next.name || 'another profile'}.`,
    ))
    setActiveId(next.id)
    try { localStorage.setItem(ACTIVE_KEY, next.id) } catch { /* ignore */ }
  }, [profiles, activeId, userId])

  const api = useMemo(() => ({
    hasCloud,
    session,
    authReady,
    signedIn,
    profiles,
    profilesReady,
    loadError,
    retryLoad: () => refreshProfiles(),
    active,
    setActive(id) {
      setActiveId(id)
      try { localStorage.setItem(ACTIVE_KEY, id || '') } catch { /* ignore */ }
    },
    async save(profile) {
      const saved = await saveProfile(userId, profile)
      // X2 (local mode): ask the browser not to clear this site's storage on
      // its own (some browsers drop it after a period without visits). The
      // answer is up to the browser; backups remain the real protection.
      if (!hasCloud) {
        try {
          if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {})
        } catch { /* not supported: nothing to do */ }
      }
      await refreshProfiles()
      if (!profile.id) {
        setActiveId(saved.id)
        try { localStorage.setItem(ACTIVE_KEY, saved.id) } catch { /* ignore */ }
      }
      return saved
    },
    // C07: changes part of a saved profile. change(latest) gets the newest
    // stored copy (not this tab's) and returns the new profile. A profile
    // deleted in another window is never re-created: the promise rejects with
    // "This profile was deleted in another window." The list is reloaded
    // either way.
    async updateProfile(id, change) {
      // X16: in accounts mode a saved figure used to reload every profile of
      // the account (up to 500) after each pause in typing. The one profile
      // is replaced on screen instead; a failure still reloads the list (the
      // profile may have been deleted or changed elsewhere). Local mode keeps
      // the reload: it is a read of this browser's storage.
      if (!hasCloud) {
        try {
          return await updateStoredProfile(userId, id, change)
        } finally {
          await refreshProfiles({ background: true })
        }
      }
      try {
        const next = await updateStoredProfile(userId, id, change)
        setProfiles(list => list.map(p => (p.id === id ? next : p)))
        setLastChanged(m => ({ ...m, [id]: new Date().toISOString() }))
        return next
      } catch (e) {
        await refreshProfiles({ background: true })
        throw e
      }
    },
    // M06 (accounts mode): a browser copy of figures not yet saved, taken when
    // the page is hidden or closed (see createInputSaver's stash).
    stashFigures(profileId, key, values) { return stashFigures({ userId, profileId, key, values }) },
    clearStashedFigures(profileId, key, stamp) { clearStashedFigures({ userId, profileId, key, stamp }) },
    saveProblem,
    reportSaveProblem(e) { setSaveProblem(e || null) },
    clearSaveProblem() { setSaveProblem(null) },
    async remove(id) {
      removingId.current = id
      try {
        await deleteProfile(userId, id)
        await refreshProfiles()
      } finally {
        removingId.current = null
      }
      if (activeId === id) {
        setActiveId(null)
        // Audit Nov 2026 (S7): forget the stored choice too, so "Download my
        // data" never names a deleted profile as the active one.
        try { localStorage.setItem(ACTIVE_KEY, '') } catch { /* ignore */ }
      }
    },
    async signOut() {
      if (!hasCloud) return
      // X14: figures typed in the last moment are saved while still signed in.
      try { await flushPendingSaves() } catch { /* a failed save is reported by its own notice */ }
      await supabase.auth.signOut()
    },
    userEmail: session?.user?.email || null,
    // X8: a hand-typed "?type=recovery" address used to open "Set a new
    // password" for anyone at a signed-in computer, with no current password
    // asked. The screen now needs the reset event from Supabase, or a session
    // that itself came from an emailed link.
    recovery: Boolean(session) && (recoveryEvent || (recovery && sessionFromRecovery(session))),
    endRecovery() { setRecovery(false); setRecoveryEvent(false) },
    linkError: emailLinkError,
    notice,
    clearNotice() { setNotice(null) },
    // M25 "Download my data": every profile and saved figure as one object.
    async exportData() {
      const data = await exportData({ userId, email: session?.user?.email || null })
      // Remember the date of this backup (local mode), unless the stored data
      // could not be read: that file is a rescue copy, not a backup.
      if (!data.unreadable) {
        noteBackup()
        setBackupDate(lastBackupDate())
      }
      return data
    },
    // Audit Nov 11, 2026: "Restore from a backup file" (see src/lib/backup.js).
    // opts: { replaceExisting, exportedAt, activeProfileId } (the last two from the file).
    async restoreBackup(profilesFromFile, opts = {}) {
      try {
        const r = await importProfiles(userId, profilesFromFile, opts)
        // U7: the file just restored is itself a backup, so the reminder does
        // not say "No backup yet" straight after it.
        if ((r.added || r.replaced || r.kept) && opts.exportedAt && !Number.isNaN(Date.parse(opts.exportedAt))) {
          noteBackup(new Date(opts.exportedAt), { onlyIfLater: true })
          setBackupDate(lastBackupDate())
        }
        return r
      } finally {
        setUndoInfo(restoreUndoInfo())
        await refreshProfiles()
        // U7: with no profile selected, the one that was selected in the backup is.
        if (!activeId && opts.activeProfileId) {
          setActiveId(opts.activeProfileId)
          try { localStorage.setItem(ACTIVE_KEY, opts.activeProfileId) } catch { /* ignore */ }
        }
      }
    },
    // X5: put back the profiles as they were before the last restore that replaced any.
    undoInfo,
    async undoRestore() {
      try {
        return undoRestore()
      } finally {
        setUndoInfo(restoreUndoInfo())
        await refreshProfiles()
      }
    },
    // X12: { [profile id]: ISO time it was last changed }.
    lastChanged,
    // 'YYYY-MM-DD' of the last "Download my data" in this browser (local mode), or null.
    lastBackup: backupDate,
    // M25 "Erase all data on this device" (local mode).
    async eraseAllData() {
      eraseLocalData()
      setBackupDate(null)
      setUndoInfo(null)
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
  }), [session, authReady, signedIn, profiles, profilesReady, loadError, active, userId, activeId, refreshProfiles, notice, leftovers, recovery, recoveryEvent, saveProblem, backupDate, lastChanged, undoInfo])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}
