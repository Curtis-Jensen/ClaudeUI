import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { useSessionStore } from '../../stores/session-store'
import { useArchivedChats, useArchivedChatsRefresh } from '../../lib/archived-chats'
import { useAppMode, useProfile, useProfileRefresh } from '../../lib/profile'
import { expandDir, toggleDirExpanded, useExpandedDirs } from '../../lib/expanded-dirs'
import { isInsideOrEqual, KID_PROFILE_NAME } from '../../../../shared/profile'
import type { DirectoryGroup, EngineId, SessionInfo, WorktreeInfo } from '../../../../shared/types'
import { useAutomationStore } from '../../stores/automation-store'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { CodexDeletePlan } from '../../../../shared/codex-types'
import { SidebarView, type DeleteTarget } from './View'
import { mostRecentProject } from '../../lib/last-project'
import { cwdToProjectKey } from '../../../../shared/project-key'
import { planClaudeProjectDelete } from '../../../../shared/claude-project-delete'
import {
  beginTranscriptPlaceholder,
  ensureTranscriptLoaded,
  isTranscriptLoadInFlight,
  loadClickedSession,
  loadSessionIntoStore,
  opensResident,
  replaceOnClick
} from '../../lib/session-history-load'

/** Lightweight projection of session data needed by the sidebar for structural/display decisions */
type SidebarSessionData = {
  cwd: string
  isWatching: boolean
  firstUserText?: string
  /** The engine the session was born with (the replicated birth event's). */
  selectedEngineId: EngineId
}

function isCodexSession(sessionId: string): boolean {
  const state = useSessionStore.getState()
  return (
    state.sessions[sessionId]?.selectedEngineId === 'codex' ||
    state.sessionEngines[sessionId]?.engineId === 'codex' ||
    state.directories.some((group) =>
      group.sessions.some((info) => info.sessionId === sessionId && info.engineId === 'codex')
    )
  )
}

/**
 * A session that is in memory but not on disk yet (never spawned, or its
 * transcript not listed yet), as a sidebar row. Its harness comes from
 * `sessionEngines`, the record `createNewSession` writes: without it the row
 * reads as Claude (`SessionItem`'s fallback), which is how a pi session whose
 * first spawn failed showed Claude's logo in Recent (ADR-082 S7b).
 *
 * A session another client or the host created has no `sessionEngines` entry until
 * a model-bearing status arrives (Codex sends none before its first prompt); its
 * birth engine, replicated on `session:created`, stands in until then.
 */
function inMemorySessionInfo(
  sessionId: string,
  data: SidebarSessionData,
  engineId: EngineId | undefined,
  projectKey: string
): SessionInfo {
  const now = Date.now()
  return {
    sessionId,
    cwd: data.cwd,
    projectKey,
    title: data.firstUserText || 'New session',
    timestamp: now,
    lastActivityAt: now,
    engineId: engineId ?? data.selectedEngineId ?? 'claude'
  }
}

/** Structural equality for the sidebar session projection — avoids re-renders from unrelated session changes */
function sidebarSessionsEqual(
  a: Record<string, SidebarSessionData>,
  b: Record<string, SidebarSessionData>
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    const av = a[key],
      bv = b[key]
    if (!bv) return false
    if (
      av.cwd !== bv.cwd ||
      av.isWatching !== bv.isWatching ||
      av.firstUserText !== bv.firstUserText ||
      av.selectedEngineId !== bv.selectedEngineId
    )
      return false
  }
  return true
}

export function Sidebar({
  style,
  onToggleCollapse
}: {
  style?: React.CSSProperties
  onToggleCollapse?: () => void
}): React.JSX.Element {
  const uiFontScale = useSessionStore((s) => s.settings.uiFontScale)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const directories = useSessionStore((s) => s.directories)
  const pinnedSessionIds = useSessionStore((s) => s.pinnedSessionIds)
  // Narrow projection: only extract fields the sidebar needs for structure/display.
  // Uses ref-based caching to prevent re-renders from streaming text, message updates, etc.
  const sidebarSessionsRef = useRef<Record<string, SidebarSessionData>>({})
  const sidebarSessions = useSessionStore((s) => {
    const result: Record<string, SidebarSessionData> = {}
    for (const [id, sess] of Object.entries(s.sessions)) {
      const firstUser = sess.messages.find((m) => m.role === 'user')
      result[id] = {
        cwd: sess.cwd,
        isWatching: !!sess.isWatching,
        selectedEngineId: sess.selectedEngineId,
        firstUserText: firstUser?.content
          .find((b) => b.type === 'text')
          ?.text?.slice(0, 80)
          ?.replace(/\n/g, ' ')
          ?.trim()
      }
    }
    // Return cached ref if structurally equal — prevents unnecessary re-renders
    if (sidebarSessionsEqual(sidebarSessionsRef.current, result)) {
      return sidebarSessionsRef.current
    }
    sidebarSessionsRef.current = result
    return result
  })
  const createNewSession = useSessionStore((s) => s.createNewSession)
  const switchSession = useSessionStore((s) => s.switchSession)
  const setWatching = useSessionStore((s) => s.setWatching)
  const pinSession = useSessionStore((s) => s.pinSession)
  const unpinSession = useSessionStore((s) => s.unpinSession)
  const removeRecentSession = useSessionStore((s) => s.removeRecentSession)
  const addRecentSession = useSessionStore((s) => s.addRecentSession)
  const setCustomTitle = useSessionStore((s) => s.setCustomTitle)
  const customTitles = useSessionStore((s) => s.customTitles)
  const reorderPinnedSessions = useSessionStore((s) => s.reorderPinnedSessions)
  const hiddenSessionIds = useSessionStore((s) => s.hiddenSessionIds)
  const hiddenProjectKeys = useSessionStore((s) => s.hiddenProjectKeys)
  const hideSession = useSessionStore((s) => s.hideSession)
  const unhideSession = useSessionStore((s) => s.unhideSession)
  const hideProject = useSessionStore((s) => s.hideProject)
  const unhideProject = useSessionStore((s) => s.unhideProject)
  const deleteSessionAction = useSessionStore((s) => s.deleteSession)
  const deleteProjectAction = useSessionStore((s) => s.deleteProject)
  const showWelcome = useSessionStore((s) => s.showWelcome)
  const requestWelcomeBrowse = useSessionStore((s) => s.requestWelcomeBrowse)
  const activeView = useSessionStore((s) => s.activeView)
  const setActiveView = useSessionStore((s) => s.setActiveView)
  const pluginViews = useSessionStore((s) => s.pluginViews)
  const sessionEngines = useSessionStore((s) => s.sessionEngines)
  const automationBadge = useAutomationStore((s) => s.notificationBadge)

  const isMobile = useIsMobile()
  // Monotonic token guarding async session selection: clicking slow-loading A
  // then fast-loading B must land on B. Each click bumps the token; a load only
  // commits if it's still the latest (gpt#18 / xhigh#14).
  const selectionTarget = useRef<string | null>(null)
  const expandedDirs = useExpandedDirs()
  const [worktreesModalCwd, setWorktreesModalCwd] = useState<string | null>(null)
  const [cleanupWorktree, setCleanupWorktree] = useState<{
    sessionId: string
    worktreeInfo: WorktreeInfo
  } | null>(null)
  const [renamingKey, setRenamingKey] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  // Chats the Claude desktop app archived: listed, or left out (the choice is the menu's toggle).
  useArchivedChatsRefresh()
  // Profiles: the kid's sandboxed profile sees only chats in his sandbox folder, and the owner's
  // profile never lists them, so neither profile's chats clutter the other's sidebar.
  useProfileRefresh()
  const profile = useProfile((s) => s.profile)
  const sandboxDir = useProfile((s) => s.sandboxDir)
  const switchProfile = useProfile((s) => s.switchTo)
  // The owner's Chat / Code toggle: Chat lists only conversations in the chat folder, Code lists
  // every other project. The kid profile has no toggle and keeps its own sandbox.
  const chatDir = useProfile((s) => s.chatDir)
  const appMode = useAppMode((s) => s.mode)
  const setAppMode = useAppMode((s) => s.setMode)
  const chatMode = profile === 'curtis' && !!chatDir && appMode === 'chat'
  const inProfile = useCallback(
    (cwd: string): boolean => {
      if (!sandboxDir) return profile === 'curtis'
      if (profile === 'kid') return isInsideOrEqual(sandboxDir, cwd)
      if (isInsideOrEqual(sandboxDir, cwd)) return false
      if (!chatDir) return true
      return isInsideOrEqual(chatDir, cwd) === chatMode
    },
    [profile, sandboxDir, chatDir, chatMode]
  )
  const archivedIds = useArchivedChats((s) => s.ids)
  const showArchived = useArchivedChats((s) => s.show)
  const toggleShowArchived = useArchivedChats((s) => s.toggle)
  // Bulk select: pick many chats with checkboxes, then hide or unhide them in one go.
  const hideSessionsAction = useSessionStore((s) => s.hideSessions)
  const unhideSessionsAction = useSessionStore((s) => s.unhideSessions)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [deletePlan, setDeletePlan] = useState<CodexDeletePlan | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const hiddenSessionSet = useMemo(() => new Set(hiddenSessionIds), [hiddenSessionIds])
  const hiddenProjectSet = useMemo(() => new Set(hiddenProjectKeys), [hiddenProjectKeys])
  const hasAnyHidden = hiddenSessionIds.length > 0 || hiddenProjectKeys.length > 0

  // Find the projectKey for a session from directories. The SESSION's key, not
  // its group's: a transcript cli.js relocated into a worktree's project dir is
  // listed under its home group, so the group key names a dir the file is not in
  // — and `writeCustomTitle` appends, so it would CREATE a stray one-line
  // transcript there.
  const findProjectKey = useCallback(
    (sessionId: string): string | undefined => {
      for (const group of directories) {
        const info = group.sessions.find((s) => s.sessionId === sessionId)
        if (info) return info.projectKey
      }
      return undefined
    },
    [directories]
  )

  // Set custom title in state and persist to JSONL
  const applyTitle = useCallback(
    (sessionId: string, title: string) => {
      setCustomTitle(sessionId, title)
      if (isCodexSession(sessionId)) return
      const projectKey = findProjectKey(sessionId)
      if (projectKey && title) {
        window.api.writeCustomTitle(sessionId, projectKey, title)
      }
    },
    [setCustomTitle, findProjectKey]
  )

  const handleRename = useCallback(
    async (sessionId: string, newTitle: string) => {
      setRenamingKey(null)
      if (!newTitle.trim() && isCodexSession(sessionId)) {
        setCustomTitle(sessionId, '')
        return
      }
      if (newTitle.trim()) {
        applyTitle(sessionId, newTitle.trim())
        return
      }
      // Auto-generate: collect text from session messages
      let session = useSessionStore.getState().sessions[sessionId]
      // If the transcript is not in memory (never loaded, or evicted and idle), load
      // it from disk; a resident or live entry is used as it is.
      if ((await ensureTranscriptLoaded(sessionId)) !== 'resident') {
        session = useSessionStore.getState().sessions[sessionId]
      }
      if (!session) return
      const texts: string[] = []
      let totalLen = 0
      for (let i = session.messages.length - 1; i >= 0; i--) {
        const msg = session.messages[i]
        if (msg.role !== 'user' && msg.role !== 'assistant') continue
        for (const block of msg.content) {
          if (block.type === 'text' && block.text) {
            texts.unshift(block.text)
            totalLen += block.text.length
          }
        }
        if (totalLen >= 1000) break
      }
      let conversationText = texts.join('\n')
      if (conversationText.length > 1000) {
        conversationText = conversationText.slice(-1000)
      }
      window.api.logError('AutoName', `text ${conversationText.length} chars for ${sessionId}`)
      if (!conversationText) return
      // Show a temporary "generating..." title
      setCustomTitle(sessionId, 'generating...')
      try {
        const generated = await window.api.generateTitle(conversationText)
        if (generated) {
          applyTitle(sessionId, generated)
        } else {
          // Fallback: kebab slug from first user message
          const firstText = session.messages
            .find((m) => m.role === 'user')
            ?.content.find((b) => b.type === 'text')?.text
          if (firstText) {
            const slug = firstText
              .slice(0, 60)
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .trim()
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .slice(0, 40)
            if (slug) applyTitle(sessionId, slug)
            else setCustomTitle(sessionId, '') // remove temp title
          } else {
            setCustomTitle(sessionId, '') // remove temp title
          }
        }
      } catch (err) {
        window.api.logError('Sidebar', `Auto-generate title failed for ${sessionId}: ${err}`)
        setCustomTitle(sessionId, '') // clear stuck "generating..." title
      }
    },
    [setCustomTitle, applyTitle]
  )

  const handleRenameRef = useRef(handleRename)
  handleRenameRef.current = handleRename

  // New threads: name them from the first message, emoji first.
  const autoNamedRef = useRef(new Set<string>())
  useEffect(() => {
    const userCounts = new Map<string, number>()
    const countUsers = (messages: { role: string }[]) =>
      messages.reduce((n, m) => n + (m.role === 'user' ? 1 : 0), 0)
    // Sessions already open at startup are not new threads; a session first seen after
    // this (created with its first message already in it) counts as having had 0.
    for (const [id, sess] of Object.entries(useSessionStore.getState().sessions)) {
      userCounts.set(id, countUsers(sess.messages))
    }
    return useSessionStore.subscribe((state) => {
      for (const [id, sess] of Object.entries(state.sessions)) {
        const now = countUsers(sess.messages)
        if (now === 1 && !autoNamedRef.current.has(id))
          window.api.logError(
            'AutoName',
            `seen ${id} users=${now} hist=${sess.isHistorical} evicted=${sess.evicted} title=${state.customTitles[id]}`
          )
        const prev = userCounts.get(id) ?? (sess.isHistorical || sess.evicted ? undefined : 0)
        userCounts.set(id, now)
        if (
          (prev === undefined || prev === 0) &&
          now === 1 &&
          !sess.isHistorical &&
          !sess.evicted &&
          !state.customTitles[id] &&
          !autoNamedRef.current.has(id)
        ) {
          autoNamedRef.current.add(id)
          window.api.logError('AutoName', `firing for ${id}`)
          setTimeout(() => handleRenameRef.current(id, ''), 1500)
        }
      }
    })
  }, [])

  const handleAutoRename = useCallback(
    (sessionId: string) => {
      handleRename(sessionId, '')
    },
    [handleRename]
  )

  // opencode's sessions are listed from its server (ADR-097 §6, S9), refreshed
  // in main in the background. The sidebar opening and the app coming to the
  // front are the moments a stale listing may be refreshed: this nudge is
  // answered from main's cache at once and never awaited — the list renders
  // from `directories`, and a refresh that changed it arrives as ONE
  // `session:directories-changed`.
  useEffect(() => {
    const nudge = (): void => {
      void window.api.listOpencodeSessionsGlobal?.().catch(() => {})
    }
    nudge()
    window.addEventListener('focus', nudge)
    return () => window.removeEventListener('focus', nudge)
  }, [])

  // NO refresh loop here any more. The three-query merge (Claude JSONL +
  // opencode + pi) and the 30 s poll moved to the MAIN process
  // (`services/sync-seed.ts`), and `session:directories-changed` now CARRIES the
  // merged listing, so `directories` reaches this component through the replica
  // fold like every other replicated slice. What that fixes: the merge used to
  // run per client and be written locally, while canonical held the Claude-only
  // subset — so every `sync-full` force-projected that subset over the merged
  // list and a reconnecting client lost its opencode/pi rows for up to 30 s.

  const handleNewSession = (): void => {
    // The kid profile skips the welcome screen's folder choice: a new chat opens in his sandbox.
    if (profile === 'kid' && sandboxDir) {
      createNewSession(uuid(), sandboxDir)
      if (isMobile && onToggleCollapse) onToggleCollapse()
      return
    }
    // Chat mode skips the folder choice too: a new conversation opens in the chat folder.
    if (chatMode) {
      createNewSession(uuid(), chatDir)
      if (isMobile && onToggleCollapse) onToggleCollapse()
      return
    }
    // Default to the project worked in last; the session's header lets the user change it.
    const lastProject = mostRecentProject(directories)
    if (lastProject) createNewSession(uuid(), lastProject.cwd)
    else showWelcome()
    if (isMobile && onToggleCollapse) onToggleCollapse()
  }

  // Switching tabs must not leave the other tab's session on screen: each tab remembers the
  // session that was open when it was left and comes back to it. A tab with nothing to return
  // to (or whose session was closed) drops to a new chat / the welcome screen, as before.
  const lastSessionByMode = useRef<Partial<Record<'chat' | 'code', string>>>({})
  const handleSetAppMode = (mode: 'chat' | 'code'): void => {
    setAppMode(mode)
    if (profile !== 'curtis' || !chatDir || mode === appMode) return
    const { activeSessionId, sessions } = useSessionStore.getState()
    const activeCwd = activeSessionId ? sessions[activeSessionId]?.cwd : ''
    if (activeSessionId && activeCwd) {
      const activeMode = isInsideOrEqual(chatDir, activeCwd) ? 'chat' : 'code'
      lastSessionByMode.current[activeMode] = activeSessionId
    }
    const remembered = lastSessionByMode.current[mode]
    const rememberedCwd = remembered ? sessions[remembered]?.cwd : ''
    if (
      remembered &&
      rememberedCwd &&
      isInsideOrEqual(chatDir, rememberedCwd) === (mode === 'chat')
    ) {
      switchSession(remembered)
      return
    }
    if (!activeCwd || isInsideOrEqual(chatDir, activeCwd) === (mode === 'chat')) return
    if (mode === 'chat') {
      createNewSession(uuid(), chatDir)
      return
    }
    const lastProject = mostRecentProject(directories)
    if (lastProject) createNewSession(uuid(), lastProject.cwd)
    else showWelcome()
  }

  const handleNewSessionDblClick = async (): Promise<void> => {
    if (profile === 'kid') return
    // The web client has no native dialog — `pickFolder()` resolves to null and
    // `session:pick-folder` declares `host`, so it is never registered on the
    // remote dispatcher — route to the welcome screen's host-backed browser
    // instead of no-oping (ADR-046).
    if (window.api.platform === 'web') {
      showWelcome()
      requestWelcomeBrowse()
      if (isMobile && onToggleCollapse) onToggleCollapse()
      return
    }
    const folder = await window.api.pickFolder()
    if (folder) {
      const routingId = uuid()
      createNewSession(routingId, folder)
    }
  }

  const handleSwitchProfile = async (): Promise<void> => {
    await switchProfile(profile === 'kid' ? 'curtis' : 'kid')
    // The open chat belongs to the profile just left: go back to the welcome screen.
    showWelcome()
  }

  const handleClickSession = async (info: SessionInfo): Promise<void> => {
    const routingId = info.sessionId
    // Name the selection first, so any in-flight slower load for a prior click sees
    // it moved on after its awaits and bails before committing. A target (not a
    // counter): clicking back to a session whose load is still running re-adopts
    // that load instead of restarting it.
    selectionTarget.current = routingId
    // Already loaded and still resident? An evicted entry that is idle is
    // re-hydrated from disk below, exactly like a never-loaded session. An evicted
    // one that is LIVE is resident: the live fold and `loadResumedTranscript` own it,
    // and a load here would stamp it historical. One whose load is already running
    // counts as resident too: it opens on its loading view and the load lands in it.
    const inMemory = useSessionStore.getState().sessions[routingId]
    if (opensResident(inMemory) || isTranscriptLoadInFlight(routingId)) {
      switchSession(routingId)
      if (isMobile && onToggleCollapse) onToggleCollapse()
      return
    }

    // Navigate first (ADR-102): a placeholder entry renders the loading view while
    // the transcript is read, instead of the sidebar sitting dead for seconds. The
    // per-engine load (opencode / pi / codex / Claude + subagent files) is shared
    // with the post-hydrate reload of the active session.
    const replace = replaceOnClick(inMemory)
    beginTranscriptPlaceholder(info)
    switchSession(routingId)
    // Close drawer on mobile after selecting a session
    if (isMobile && onToggleCollapse) onToggleCollapse()
    // `declined` kept the held transcript (the read failed or came back empty): the
    // entry stays evicted so the next click retries. A failure shows Retry.
    await loadClickedSession(info, {
      isCurrent: () => selectionTarget.current === routingId,
      onCodexError: setHistoryError,
      replace
    })
  }

  const handleDirClick = (projectKey: string): void => {
    toggleDirExpanded(projectKey)
  }

  const handleDirDoubleClick = (group: DirectoryGroup): void => {
    const routingId = uuid()
    createNewSession(routingId, group.cwd)
  }

  const handleToggleWatch = (info: SessionInfo): void => {
    const routingId = info.sessionId
    const session = useSessionStore.getState().sessions[routingId]
    if (session?.isWatching) {
      window.api.unwatchSession(routingId)
      setWatching(routingId, false)
    } else {
      // Load the transcript if it is not in memory (an idle evicted entry is resident
      // but empty), then watch the .jsonl file. A resident or live entry is used as is.
      if (!opensResident(session)) {
        void loadSessionIntoStore(info, {
          isCurrent: () => true,
          replace: replaceOnClick(session)
        }).then((result) => {
          if (result === 'skipped') return
          window.api.watchSession(routingId, info.sessionId, info.projectKey, info.cwd)
          setWatching(routingId, true)
        })
      } else {
        window.api.watchSession(routingId, info.sessionId, info.projectKey, info.cwd)
        setWatching(routingId, true)
      }
    }
  }

  // Helper to resolve a session ID to a SessionInfo
  const resolveSessionInfo = useCallback(
    (rid: string): SessionInfo | undefined => {
      let info: SessionInfo | undefined
      for (const group of directories) {
        info = group.sessions.find((s) => s.sessionId === rid)
        if (info) break
      }
      if (!info) {
        const data = sidebarSessions[rid]
        if (data) info = inMemorySessionInfo(rid, data, sessionEngines[rid]?.engineId, '')
      }
      // Apply custom title if set
      if (info && customTitles[rid]) {
        info = { ...info, title: customTitles[rid] }
      }
      return info
    },
    [directories, sidebarSessions, customTitles, sessionEngines]
  )

  // An archived chat is left out of every list while archived chats are switched off, except the
  // one open right now: it must not vanish from under you.
  const isArchivedAway = useCallback(
    (rid: string): boolean => !showArchived && archivedIds.has(rid) && rid !== activeSessionId,
    [showArchived, archivedIds, activeSessionId]
  )

  // Memoize derived lists — only recompute when their inputs change
  const pinnedSet = useMemo(() => new Set(pinnedSessionIds), [pinnedSessionIds])

  const pinnedSessions = useMemo(() => {
    const result: SessionInfo[] = []
    for (const rid of pinnedSessionIds) {
      if (!showHidden && hiddenSessionSet.has(rid)) continue
      if (isArchivedAway(rid)) continue
      const info = resolveSessionInfo(rid)
      if (info && inProfile(info.cwd)) result.push(info)
    }
    return result
  }, [
    pinnedSessionIds,
    resolveSessionInfo,
    hiddenSessionSet,
    showHidden,
    isArchivedAway,
    inProfile
  ])

  const watchingSessions = useMemo(() => {
    const result: SessionInfo[] = []
    for (const [rid, data] of Object.entries(sidebarSessions)) {
      if (!data.isWatching) continue
      if (pinnedSet.has(rid)) continue
      if (!showHidden && hiddenSessionSet.has(rid)) continue
      if (isArchivedAway(rid)) continue
      const info = resolveSessionInfo(rid)
      if (info && inProfile(info.cwd)) result.push(info)
    }
    return result
  }, [
    sidebarSessions,
    pinnedSet,
    resolveSessionInfo,
    hiddenSessionSet,
    showHidden,
    isArchivedAway,
    inProfile
  ])

  // Hiding the thread you are on must not leave it on screen: move to the most recently opened
  // thread of the same kind (chat or code) that is not itself being hidden. With none, stay put.
  const leaveIfActiveHidden = useCallback(
    (hiding: ReadonlySet<string>): void => {
      const {
        activeSessionId: activeId,
        sessions,
        recentSessionIds,
        pinnedSessionIds
      } = useSessionStore.getState()
      if (!activeId || !hiding.has(activeId)) return
      const kindOf = (cwd: string): 'chat' | 'code' =>
        chatDir && isInsideOrEqual(chatDir, cwd) ? 'chat' : 'code'
      const activeCwd = sessions[activeId]?.cwd
      if (!activeCwd) return
      const kind = kindOf(activeCwd)
      const target = [...recentSessionIds, ...pinnedSessionIds].find((id) => {
        if (id === activeId || hiding.has(id) || hiddenSessionSet.has(id)) return false
        if (!showArchived && archivedIds.has(id)) return false
        const cwd = sessions[id]?.cwd
        return !!cwd && kindOf(cwd) === kind
      })
      if (target) switchSession(target)
    },
    [chatDir, hiddenSessionSet, showArchived, archivedIds, switchSession]
  )

  const handleHideSession = useCallback(
    (info: SessionInfo) => {
      leaveIfActiveHidden(new Set([info.sessionId]))
      hideSession(info.sessionId)
    },
    [hideSession, leaveIfActiveHidden]
  )

  const handleUnhideSession = useCallback(
    (info: SessionInfo) => {
      unhideSession(info.sessionId)
    },
    [unhideSession]
  )

  const handleDeleteSessionRequest = useCallback((info: SessionInfo) => {
    if (!info.projectKey) return
    setDeleteTarget({
      kind: 'session',
      sessionId: info.sessionId,
      projectKey: info.projectKey,
      title: info.title,
      engineId: info.engineId
    })
  }, [])

  const handleDeleteProjectRequest = useCallback(
    (group: DirectoryGroup) => {
      if (!group.projectKey) return
      setDeleteTarget({
        kind: 'project',
        projectKey: group.projectKey,
        folderName: group.folderName,
        sessionCount: group.sessions.length,
        // From the LISTING (`directories`), not the rendered group: that is what
        // main plans from when the delete runs, and the in-memory rows merged
        // into the rendered group have no file to name yet.
        claudeFiles: planClaudeProjectDelete(directories, group.projectKey)
      })
    },
    [directories]
  )

  /**
   * What deleting the pending CODEX target would actually remove.
   *
   * Only Codex has a plan: its native delete is refused while a fork still
   * references the thread's history, so a branched session is a subtree delete
   * and the confirmation has to say so before the user agrees to it. The answer
   * is advisory — main recomputes the plan when the delete runs and never
   * trusts this copy — and a failed query just leaves the plain confirmation
   * standing rather than blocking the delete.
   */
  useEffect(() => {
    setDeletePlan(null)
    if (deleteTarget?.kind !== 'session' || deleteTarget.engineId !== 'codex') return
    let current = true
    void window.api
      .codexDeletePlan(deleteTarget.sessionId)
      .then((plan) => {
        if (current) setDeletePlan(plan)
      })
      .catch(() => {})
    return () => {
      current = false
    }
  }, [deleteTarget])

  const confirmDelete = useCallback(async (): Promise<void> => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'session') {
      await deleteSessionAction(
        deleteTarget.sessionId,
        deleteTarget.projectKey,
        deleteTarget.engineId
      )
    } else {
      await deleteProjectAction(deleteTarget.projectKey)
    }
    setDeleteTarget(null)
    // No refresh call: main re-reads the merged listing as part of the delete
    // itself (`handlers-core.deleteSession` / `deleteProject`) and replicates it,
    // so the row disappears on EVERY client rather than only on the one that
    // clicked — and without the Claude-only refetch that used to drop every
    // opencode/pi row here until the next 30 s poll.
  }, [deleteTarget, deleteSessionAction, deleteProjectAction])

  const augmentedDirs = useMemo(() => {
    // Build set of session IDs already on disk
    const dirSessionIds = new Set<string>()
    for (const group of directories) {
      for (const s of group.sessions) dirSessionIds.add(s.sessionId)
    }

    // Collect in-memory sessions not yet on disk, grouped by canonical projectKey
    const inMemoryByPk: Record<string, SessionInfo[]> = {}
    for (const [rid, data] of Object.entries(sidebarSessions)) {
      if (dirSessionIds.has(rid) || !data.cwd) continue
      const pk = cwdToProjectKey(data.cwd)
      const info = inMemorySessionInfo(rid, data, sessionEngines[rid]?.engineId, pk)
      if (!inMemoryByPk[pk]) inMemoryByPk[pk] = []
      inMemoryByPk[pk].push(info)
    }

    // Apply custom titles to a session list
    const applyCustomTitles = (sessions: SessionInfo[]): SessionInfo[] =>
      sessions.map((s) =>
        customTitles[s.sessionId] ? { ...s, title: customTitles[s.sessionId] } : s
      )

    // Track which in-memory pkGroups were merged into an existing group
    const mergedPks = new Set<string>()

    // Merge in-memory sessions into existing groups (match by projectKey OR exact cwd)
    const result: DirectoryGroup[] = directories.map((group) => {
      const pk = group.projectKey || cwdToProjectKey(group.cwd)
      const extra = inMemoryByPk[pk]
      if (!extra) {
        // Also try matching in-memory sessions whose cwd exactly matches this group's cwd
        // (fallback for the case where canonicalization diverges)
        const cwdExtra = Object.entries(inMemoryByPk).find(
          ([, sessions]) => sessions.length > 0 && sessions[0].cwd === group.cwd
        )
        if (!cwdExtra) {
          return { ...group, sessions: applyCustomTitles(group.sessions) }
        }
        const [cwdPk, cwdSessions] = cwdExtra
        mergedPks.add(cwdPk)
        return { ...group, sessions: applyCustomTitles([...cwdSessions, ...group.sessions]) }
      }
      mergedPks.add(pk)
      return { ...group, sessions: applyCustomTitles([...extra, ...group.sessions]) }
    })

    // Create new groups for in-memory sessions that don't match any existing directory
    for (const [pk, extraSessions] of Object.entries(inMemoryByPk)) {
      if (mergedPks.has(pk)) continue
      const cwd = extraSessions[0].cwd
      const folderName = cwd.split(/[\\/]/).pop() || cwd
      result.unshift({
        cwd,
        projectKey: pk,
        folderName,
        sessions: applyCustomTitles(extraSessions)
      })
    }
    // Only this profile's projects: the kid's sandbox, or everything but it.
    const profileResult = result.filter((group) => inProfile(group.cwd))
    // Archived chats switched off: leave them out of each project (the project itself stays).
    const visibleResult =
      showArchived || archivedIds.size === 0
        ? profileResult
        : profileResult.map((group) => ({
            ...group,
            sessions: group.sessions.filter((s) => !isArchivedAway(s.sessionId))
          }))
    // Most recently used project first, and each project's chats newest first.
    const newestIn = (group: DirectoryGroup): number =>
      group.sessions.reduce((max, s) => Math.max(max, s.lastActivityAt), 0)
    return visibleResult
      .map((group) => ({
        ...group,
        sessions: [...group.sessions].sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      }))
      .sort((a, b) => newestIn(b) - newestIn(a))
  }, [
    directories,
    sidebarSessions,
    customTitles,
    sessionEngines,
    showArchived,
    archivedIds,
    isArchivedAway,
    inProfile
  ])

  // Opening a thread opens its folder. Runs once per newly active thread, so a folder the
  // user then closes by hand stays closed; waits until the thread shows up in a group.
  const expandedForSession = useRef<string | null>(null)
  useEffect(() => {
    if (!activeSessionId || expandedForSession.current === activeSessionId) return
    const group = augmentedDirs.find((g) => g.sessions.some((s) => s.sessionId === activeSessionId))
    if (!group) return
    expandedForSession.current = activeSessionId
    expandDir(group.projectKey || group.cwd)
  }, [activeSessionId, augmentedDirs])

  // Every chat the project lists show right now: what "All" and "Archived" pick from.
  const visibleSessionIds = useMemo(
    () =>
      augmentedDirs.flatMap((group) =>
        group.sessions
          .map((s) => s.sessionId)
          .filter((id) => showHidden || !hiddenSessionSet.has(id))
      ),
    [augmentedDirs, showHidden, hiddenSessionSet]
  )
  const selectedHiddenCount = useMemo(
    () => [...selectedIds].filter((id) => hiddenSessionSet.has(id)).length,
    [selectedIds, hiddenSessionSet]
  )

  const leaveSelecting = useCallback((): void => {
    setSelecting(false)
    setSelectedIds(new Set())
  }, [])
  const toggleSelecting = useCallback((): void => {
    if (selecting) leaveSelecting()
    else setSelecting(true)
  }, [selecting, leaveSelecting])
  const toggleSelected = useCallback((sessionId: string): void => {
    setSelectedIds((was) => {
      const next = new Set(was)
      if (!next.delete(sessionId)) next.add(sessionId)
      return next
    })
  }, [])
  // A project's box: pick all of its chats, or, when they are all picked already, let them go.
  const toggleSelectedMany = useCallback((sessionIds: string[]): void => {
    setSelectedIds((was) => {
      const allPicked = sessionIds.every((id) => was.has(id))
      const next = new Set(was)
      for (const id of sessionIds) {
        if (allPicked) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }, [])
  const selectAll = useCallback(
    (): void => setSelectedIds(new Set(visibleSessionIds)),
    [visibleSessionIds]
  )
  const selectArchived = useCallback(
    (): void => setSelectedIds(new Set(visibleSessionIds.filter((id) => archivedIds.has(id)))),
    [visibleSessionIds, archivedIds]
  )
  const hideSelected = useCallback((): void => {
    const going = [...selectedIds].filter((id) => !hiddenSessionSet.has(id))
    leaveIfActiveHidden(new Set(going))
    hideSessionsAction(going)
    leaveSelecting()
  }, [selectedIds, hiddenSessionSet, hideSessionsAction, leaveSelecting, leaveIfActiveHidden])
  const unhideSelected = useCallback((): void => {
    unhideSessionsAction([...selectedIds].filter((id) => hiddenSessionSet.has(id)))
    leaveSelecting()
  }, [selectedIds, hiddenSessionSet, unhideSessionsAction, leaveSelecting])

  return (
    <>
      {historyError && (
        <div
          role="alert"
          data-testid="Sidebar.nativeHistoryError"
          className="fixed top-3 right-3 z-50 max-w-sm rounded-lg border border-border bg-bg-secondary p-3 text-sm"
        >
          {historyError}
          <button onClick={() => setHistoryError(null)} className="block mt-2">
            Dismiss
          </button>
        </div>
      )}
      <SidebarView
        style={style}
        platform={window.api.platform}
        uiFontScale={uiFontScale}
        activeSessionId={activeSessionId}
        activeView={activeView}
        pluginViews={pluginViews}
        automationBadge={automationBadge}
        pinnedSessionIds={pinnedSessionIds}
        pinnedSessions={pinnedSessions}
        watchingSessions={watchingSessions}
        augmentedDirs={augmentedDirs}
        hiddenSessionSet={hiddenSessionSet}
        hiddenProjectSet={hiddenProjectSet}
        hasAnyHidden={hasAnyHidden}
        showHidden={showHidden}
        hasAnyArchived={archivedIds.size > 0}
        showArchived={showArchived}
        onShowArchivedToggle={toggleShowArchived}
        selecting={selecting}
        selectedIds={selectedIds}
        selectedHiddenCount={selectedHiddenCount}
        onToggleSelecting={toggleSelecting}
        onToggleSelected={toggleSelected}
        onToggleSelectedMany={toggleSelectedMany}
        onSelectAll={selectAll}
        onSelectArchived={selectArchived}
        onClearSelection={() => setSelectedIds(new Set())}
        onHideSelected={hideSelected}
        onUnhideSelected={unhideSelected}
        expandedDirs={expandedDirs}
        renamingKey={renamingKey}
        worktreesModalCwd={worktreesModalCwd}
        deleteTarget={deleteTarget}
        deletePlan={deletePlan}
        cleanupWorktree={cleanupWorktree}
        onToggleCollapse={onToggleCollapse}
        onNewSession={handleNewSession}
        appMode={profile === 'curtis' && chatDir ? appMode : undefined}
        onSetAppMode={handleSetAppMode}
        profileLabel={profile === 'kid' ? KID_PROFILE_NAME : 'Curtis'}
        onSwitchProfile={window.api.setProfile ? handleSwitchProfile : undefined}
        onNewSessionDblClick={handleNewSessionDblClick}
        onSetActiveView={setActiveView}
        onShowHiddenToggle={() => setShowHidden((v) => !v)}
        onSetRenamingKey={setRenamingKey}
        onClickSession={handleClickSession}
        onToggleWatch={handleToggleWatch}
        onPin={pinSession}
        onUnpin={unpinSession}
        onReorderPinned={reorderPinnedSessions}
        onFinishRename={handleRename}
        onAutoRename={handleAutoRename}
        onDirClick={handleDirClick}
        onDirDoubleClick={handleDirDoubleClick}
        onSessionDoubleClick={(info) => addRecentSession(info.sessionId)}
        onViewWorktrees={(cwd) => setWorktreesModalCwd(cwd)}
        onCloseWorktreesModal={() => setWorktreesModalCwd(null)}
        onHideSession={handleHideSession}
        onUnhideSession={handleUnhideSession}
        onDeleteSession={handleDeleteSessionRequest}
        onHideProject={hideProject}
        onUnhideProject={unhideProject}
        onDeleteProject={handleDeleteProjectRequest}
        onConfirmDelete={confirmDelete}
        onCancelDelete={() => setDeleteTarget(null)}
        onWorktreeCleanupKeep={() => {
          if (cleanupWorktree) {
            removeRecentSession(cleanupWorktree.sessionId)
            setCleanupWorktree(null)
          }
        }}
        onWorktreeCleanupRemove={() => {
          if (cleanupWorktree) {
            // The server forgets the worktree entry itself (a client-side save of the whole map
            // could resurrect entries it already dropped).
            removeRecentSession(cleanupWorktree.sessionId)
            setCleanupWorktree(null)
          }
        }}
        onWorktreeCleanupCancel={() => setCleanupWorktree(null)}
      />
    </>
  )
}
