/**
 * @vitest-environment node
 *
 * Claude Code's suggested next prompt (`prompt_suggestion`,
 * docs/protocol-cc/03-inbound-messages.md §3.14) reaches the window as the
 * `session:prompt-suggestion` event, and the session asks for it at spawn.
 *
 * Mock scaffold mirrors `claude-session-rate-limit.test.ts`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { subscribeWindowToSync } from '../../../test/helpers/sync-subscriber-window'
import { clearSyncSubscribersForTests } from '../sync-host'

const { mockQuery, mockUpdateWindows } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockUpdateWindows: vi.fn()
}))

vi.mock('electron', async () => await import('../../../test/stubs/electron-shim'))

vi.mock('../../sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../sdk')>()
  return {
    ...actual,
    query: mockQuery,
    locateBunClaude: (): string => __filename,
    getCliVersion: (): string => '0.0.0-test'
  }
})

vi.mock('../../opencode/OpencodeServerManager', () => ({
  opencodeServerManager: {
    setServerStartedHook: () => {},
    isBinaryAvailable: (): boolean => false
  }
}))
vi.mock('../cross-engine-dispatcher', () => ({
  crossEngineDispatcher: { dispatch: vi.fn(), resolveApproval: vi.fn(), disposeFor: vi.fn() },
  crossEngineDispatchAvailable: (): boolean => false
}))
vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))
vi.mock('../ui-config', () => ({
  saveSlashCommands: vi.fn(),
  loadEngineConfig: vi.fn(() => ({}))
}))
vi.mock('../claude-mcp', () => ({
  loadMcpServers: vi.fn(() => ({})),
  readDisabledMcpServers: vi.fn(() => [])
}))
vi.mock('../session-history', () => ({
  computeTokenMetrics: vi.fn(async () => ({ totalTokens: 0, totalCostUsd: 0 })),
  fallbackBlockText: vi.fn(() => '')
}))
vi.mock('../skill-scanner', () => ({ scanSkills: vi.fn(async () => []) }))
vi.mock('../subagent-watcher', () => ({ unwatchAllSubagents: vi.fn() }))
vi.mock('../context-window', () => ({ getContextWindowSize: vi.fn(() => 200000) }))
vi.mock('../usage-fetcher', () => ({
  usageFetcher: { updateFromRateLimitWindows: mockUpdateWindows, fetch: vi.fn(async () => null) }
}))
vi.mock('../usage-provider', () => ({ resolveUsageProvider: vi.fn() }))
vi.mock('../../../main/services/account-manager', () => ({
  accountManager: { getState: vi.fn(() => ({ enabled: false, activeId: null })) }
}))
vi.mock('../../../main/auth/ClaudeAuthProvider', () => ({
  claudeAuthProvider: { buildAccountRef: vi.fn(() => null), updateAuthSource: vi.fn() }
}))

// Import AFTER mocks.
import { ClaudeSession } from '../claude-session'
import type { BrowserWindow } from 'electron'

const liveSessions: ClaudeSession[] = []

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  for (const s of liveSessions.splice(0)) s.cancel()
  clearSyncSubscribersForTests()
})

type Sent = Array<[string, ...unknown[]]>

/** Runs a session over a canned wire and answers what its own window was sent. */
async function runWire(routingId: string, wire: Array<Record<string, unknown>>): Promise<Sent> {
  // One record per window: a window from an earlier test may still be subscribed to the sync host.
  const sent: Sent = []
  mockQuery.mockImplementation(() => ({
    async *[Symbol.asyncIterator](): AsyncGenerator<unknown> {
      for (const m of wire) yield m
    },
    initializationResult: (): Promise<never> => new Promise<never>(() => {}),
    interrupt: vi.fn(async () => {})
  }))
  const win = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, ...args: unknown[]): void => {
        sent.push([channel, ...args])
      }
    }
  } as unknown as BrowserWindow
  subscribeWindowToSync(
    win as unknown as { webContents: { send: (c: string, ...a: unknown[]) => void } }
  )
  const session = new ClaudeSession(routingId, win, '/tmp/proj')
  liveSessions.push(session)
  await session.run('go')
  return sent
}

const suggestions = (sent: Sent): unknown[][] =>
  sent.filter(([channel]) => channel === 'session:prompt-suggestion').map(([, ...args]) => args)

describe('ClaudeSession — prompt_suggestion', () => {
  it('passes the suggestion on to the window for that chat', async () => {
    const sent = await runWire('routing-suggest', [
      { type: 'prompt_suggestion', suggestion: 'run the tests again', uuid: 'u1', session_id: 's' }
    ])
    expect(suggestions(sent)).toEqual([['routing-suggest', 'run the tests again']])
  })

  it('trims the suggestion', async () => {
    const sent = await runWire('routing-trim', [
      { type: 'prompt_suggestion', suggestion: '  commit this\n' }
    ])
    expect(suggestions(sent)).toEqual([['routing-trim', 'commit this']])
  })

  it('says nothing for an empty or missing suggestion', async () => {
    const sent = await runWire('routing-empty', [
      { type: 'prompt_suggestion', suggestion: '   ' },
      { type: 'prompt_suggestion' }
    ])
    expect(suggestions(sent)).toEqual([])
  })

  it('asks Claude Code for suggestions when it starts', async () => {
    await runWire('routing-opt-in', [])
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery.mock.calls[0][0].options.promptSuggestions).toBe(true)
  })
})
