import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'

/**
 * Which chats the Claude desktop app has archived. That app keeps one small file per chat under
 * `Claude/claude-code-sessions/<account>/<organization>/local_<id>.json`, with an `isArchived`
 * flag and the `cliSessionId` that names the conversation's transcript: the same id ClaudeUI
 * uses for the chat. This only reads those files; it never writes to them.
 */
export function desktopSessionsDir(): string {
  return join(app.getPath('appData'), 'Claude', 'claude-code-sessions')
}

async function subdirectories(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isDirectory()).map((entry) => join(dir, entry.name))
}

/** The transcript ids of every archived chat, or none when the desktop app is not installed. */
export async function readArchivedSessionIds(dir = desktopSessionsDir()): Promise<string[]> {
  const folders: string[] = []
  for (const account of await subdirectories(dir)) folders.push(...(await subdirectories(account)))

  const ids = new Set<string>()
  await Promise.all(
    folders.map(async (folder) => {
      const files = await readdir(folder).catch(() => [])
      await Promise.all(
        files
          .filter((name) => name.startsWith('local_') && name.endsWith('.json'))
          .map(async (name) => {
            try {
              const session = JSON.parse(await readFile(join(folder, name), 'utf8')) as {
                isArchived?: unknown
                cliSessionId?: unknown
              }
              if (session.isArchived === true && typeof session.cliSessionId === 'string') {
                ids.add(session.cliSessionId)
              }
            } catch {
              // A file mid-write or not ours: skip it.
            }
          })
      )
    })
  )
  return [...ids]
}
