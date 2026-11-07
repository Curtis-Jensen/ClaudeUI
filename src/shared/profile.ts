/**
 * Profiles: whose turn it is at the keyboard. "Curtis" is the owner's normal setup. The kid profile
 * (Dawson) is for a child who wants to join in: his chats live in their own sandbox folder and
 * Claude may only change files there, so his ideas never end up in the owner's app or projects.
 * Shared so the main process (which enforces it), the window (which shows it) and the tests agree.
 */
export type ProfileId = 'curtis' | 'kid'

export const PROFILE_IDS: readonly ProfileId[] = ['curtis', 'kid']

export const KID_PROFILE_NAME = 'Dawson'

/** The folder name of the kid sandbox, created under the home folder's `Tools`. */
export const KID_SANDBOX_FOLDER = 'dawson-sandbox'

/** The folder name of the owner's plain-chat folder, created under the home folder's `Tools`. */
export const CHAT_FOLDER = 'claude-chat'

/** What the window asks main for: the active profile, where the kid's sandbox is, and the chat folder. */
export interface ProfileInfo {
  profile: ProfileId
  sandboxDir: string
  /** Where the sidebar's Chat tab keeps its conversations (no project, just talking). */
  chatDir: string
}

export function isProfileId(value: unknown): value is ProfileId {
  return typeof value === 'string' && (PROFILE_IDS as readonly string[]).includes(value)
}

function trimTrailingSeparators(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '')
}

/**
 * Whether `candidate` is the folder `dir` or something below it. A plain text comparison, for
 * sorting sidebar rows; the main process uses real path resolution for anything that guards.
 */
export function isInsideOrEqual(dir: string, candidate: string): boolean {
  const root = trimTrailingSeparators(dir).toLowerCase()
  const path = trimTrailingSeparators(candidate).toLowerCase()
  return root !== '' && (path === root || path.startsWith(`${root}/`))
}

/** The system-prompt section added to every chat while the kid profile is active. */
export function kidProfilePromptSection(sandboxDir: string): string {
  return `
## Kid Profile (${KID_PROFILE_NAME})
You are talking with ${KID_PROFILE_NAME}, the owner's young son, who is joining in. Be friendly, encouraging and simple; keep replies short and fun.
- Build his ideas ONLY inside \`${sandboxDir}\`. That folder is his own sandbox: make a new folder in it for each idea.
- Never create, edit or delete anything outside the sandbox. In particular never touch the ClaudeUI app's own source or settings, or any of the owner's projects, notes, skills or memory. Changes outside the sandbox are blocked anyway.
- If he asks for something that would change the owner's app or projects, say it can't be done in his profile and offer to build it as a separate little project in his sandbox instead.
- Do not save memories about the owner's work. Keep content kid-appropriate.`
}
