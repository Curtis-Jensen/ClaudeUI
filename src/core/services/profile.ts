import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { logger } from './logger'
import { isPathInside } from './path-containment'
import { writeJsonAtomic } from './write-json-atomic'
import {
  CHAT_FOLDER,
  KID_SANDBOX_FOLDER,
  isProfileId,
  type ProfileId,
  type ProfileInfo
} from '../../shared/profile'

const PROFILE_FILE = path.join(os.homedir(), '.claude', 'ui', 'profile.json')

/** The kid's sandbox folder. Chats in the kid profile run here and may only change files here. */
export function kidSandboxDir(): string {
  return path.join(os.homedir(), 'Tools', KID_SANDBOX_FOLDER)
}

/** The Chat tab's folder: conversations that are not about a project run here. */
export function chatDir(): string {
  return path.join(os.homedir(), 'Tools', CHAT_FOLDER)
}

/** The active profile. Read from disk each time, so a switch applies to the very next tool call. */
export function activeProfile(): ProfileId {
  try {
    const parsed = JSON.parse(fs.readFileSync(PROFILE_FILE, 'utf-8')) as { profile?: unknown }
    return isProfileId(parsed.profile) ? parsed.profile : 'curtis'
  } catch {
    return 'curtis'
  }
}

export function profileInfo(): ProfileInfo {
  fs.mkdirSync(chatDir(), { recursive: true })
  return { profile: activeProfile(), sandboxDir: kidSandboxDir(), chatDir: chatDir() }
}

/** Switches profile. Entering the kid profile makes sure the sandbox folder exists. */
export function setActiveProfile(profile: ProfileId): ProfileInfo {
  if (!isProfileId(profile)) throw new Error('Unknown profile')
  if (profile === 'kid') fs.mkdirSync(kidSandboxDir(), { recursive: true })
  writeJsonAtomic(PROFILE_FILE, { profile })
  logger.info('Profile', `Switched to ${profile}`)
  return profileInfo()
}

/**
 * Whether `candidate` is inside the kid sandbox, with symlinks resolved so a link planted in the
 * sandbox cannot lead out of it. A path that does not exist yet is judged by its nearest folder
 * that does.
 */
export function isInKidSandbox(candidate: string): boolean {
  const root = resolveThroughLinks(kidSandboxDir())
  const real = resolveThroughLinks(candidate)
  return real === root || isPathInside(root, real)
}

/** `p` made absolute with links followed as far as it exists; the rest is appended as written. */
function resolveThroughLinks(p: string): string {
  const resolved = path.resolve(p)
  let existing = resolved
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    existing = path.dirname(existing)
  }
  let real = existing
  try {
    real = fs.realpathSync(existing)
  } catch {
    // Keep the unresolved path.
  }
  return path.join(real, path.relative(existing, resolved))
}

/** Tools that write files, and the input field that names the file. */
const WRITE_TOOL_PATH_FIELDS: Record<string, string> = {
  Write: 'file_path',
  Edit: 'file_path',
  MultiEdit: 'file_path',
  NotebookEdit: 'notebook_path'
}

/**
 * The refusal for a tool call the kid profile may not make, or null when it is fine. File-writing
 * tools must name a file in the sandbox. Shell commands are held in by the sandbox cli.js is
 * started with in this profile, and the owner's other tools (mail, Slack, files in the cloud)
 * are closed off here.
 */
export function kidProfileDenial(toolName: string, input: Record<string, unknown>): string | null {
  const field = WRITE_TOOL_PATH_FIELDS[toolName]
  if (field) {
    const target = input[field]
    if (typeof target !== 'string' || !isInKidSandbox(target)) {
      return `In the kid profile files can only be changed inside ${kidSandboxDir()}.`
    }
    return null
  }
  if (
    toolName.startsWith('mcp__') &&
    !KID_ALLOWED_MCP_PREFIXES.some((p) => toolName.startsWith(p))
  ) {
    return "The owner's connected accounts, chats and tools are switched off in the kid profile."
  }
  return null
}

/** The only connected tools the kid profile keeps: diagrams and mockups, which only draw in the chat. */
const KID_ALLOWED_MCP_PREFIXES = ['mcp__claude-ui__', 'mcp__claude-ui-mockup__']
