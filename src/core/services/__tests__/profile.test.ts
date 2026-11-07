import { describe, expect, it } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import { isInKidSandbox, kidProfileDenial, kidSandboxDir } from '../profile'
import { isInsideOrEqual } from '../../../shared/profile'

describe('kid profile', () => {
  const inside = path.join(kidSandboxDir(), 'game', 'index.html')

  it('lets file tools write inside the sandbox, including files that do not exist yet', () => {
    expect(isInKidSandbox(inside)).toBe(true)
    expect(kidProfileDenial('Write', { file_path: inside })).toBeNull()
    expect(kidProfileDenial('Edit', { file_path: kidSandboxDir() })).toBeNull()
  })

  it('refuses writes outside the sandbox, by sibling prefix or ..', () => {
    const sibling = `${kidSandboxDir()}-evil/x.txt`
    const climb = path.join(kidSandboxDir(), '..', 'claudeui-trial', 'src', 'x.ts')
    for (const target of [sibling, climb, path.join(os.homedir(), 'x.txt')]) {
      expect(kidProfileDenial('Write', { file_path: target })).not.toBeNull()
    }
    expect(kidProfileDenial('NotebookEdit', { notebook_path: '/etc/x.ipynb' })).not.toBeNull()
    expect(kidProfileDenial('Write', {})).not.toBeNull()
  })

  it("closes off the owner's connected tools but keeps diagrams and mockups", () => {
    expect(kidProfileDenial('mcp__claude_ai_Gmail__send_message', {})).not.toBeNull()
    expect(kidProfileDenial('mcp__claude-ui-sessions__session_list', {})).not.toBeNull()
    expect(kidProfileDenial('mcp__claude-ui__render_mermaid', {})).toBeNull()
    expect(kidProfileDenial('mcp__claude-ui-mockup__create_mockup', {})).toBeNull()
    expect(kidProfileDenial('Read', {})).toBeNull()
  })

  it('sorts sidebar paths by text without sibling-prefix mix-ups', () => {
    expect(isInsideOrEqual('/a/sandbox', '/a/sandbox/game')).toBe(true)
    expect(isInsideOrEqual('/a/sandbox', '/a/sandbox')).toBe(true)
    expect(isInsideOrEqual('/a/sandbox', '/a/sandbox-two')).toBe(false)
    expect(isInsideOrEqual('', '/a')).toBe(false)
  })
})
