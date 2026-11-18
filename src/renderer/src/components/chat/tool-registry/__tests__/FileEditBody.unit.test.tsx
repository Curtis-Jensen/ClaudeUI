/**
 * Unit tests for FileEditBody single-diff (ROADMAP #11c)
 *
 * Guards:
 *  - hasDiff success: exactly ONE DiffViewer (in Input) + TerminalView for result.
 *  - hasDiff + hideToolInput: exactly ONE DiffViewer (in Result).
 *  - hasDiff error: red-pre (ExpandableText) — no duplicate diff.
 *  - no diff (MultiEdit): generic JSON input + TerminalView result.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { FileEditBody } from '../kinds/FileEditBody'
import { patchToBeforeAfter } from '../kinds/ExplainEdit'
import type { KindBodyProps } from '../kinds/types'
import type { ContentBlock } from '../../../../../../shared/types'

type ToolUseBlock = Extract<ContentBlock, { type: 'tool_use' }>
type ToolResultBlock = Extract<ContentBlock, { type: 'tool_result' }>

// Mock DiffViewer and TerminalView so we can count instances cleanly.
// Paths are relative to THIS test file's location in tool-registry/__tests__/.
vi.mock('../../../../lib/diff', () => ({
  DiffViewer: (p: { oldStr?: string; newStr?: string; patch?: string; fileName?: string }) => (
    <div
      data-testid="DiffViewer"
      data-old={p.oldStr}
      data-new={p.newStr}
      data-patch={p.patch}
      data-filename={p.fileName}
    />
  )
}))
vi.mock('../../TerminalView', () => ({
  TerminalView: (p: { text: string }) => <div data-testid="TerminalView" data-text={p.text} />
}))

// The Explain box asks the host for a Haiku summary as soon as the diff mounts.
let explainEdit: ReturnType<typeof vi.fn>
beforeEach(() => {
  explainEdit = vi.fn(async () => ({
    text: 'Changed one value.',
    error: null,
    log: ['+0.1s message: assistant']
  }))
  ;(globalThis as any).window.api = { explainEdit }
})

function makeBlock(toolInput: Record<string, unknown>): ToolUseBlock {
  return { type: 'tool_use', toolUseId: 'tu-1', toolName: 'Edit', toolInput }
}
function makeResult(text: string, isError = false): ToolResultBlock {
  return { type: 'tool_result', toolUseId: 'tu-1', toolResult: text, isError }
}

const STATUS_ICON = <span data-testid="status-icon" />

function baseProps(over: Partial<KindBodyProps>): KindBodyProps {
  return {
    view: { kind: 'fileEdit', path: '/a.ts', before: 'old', after: 'new' },
    block: makeBlock({ file_path: '/a.ts', old_string: 'old', new_string: 'new' }),
    result: makeResult('File updated'),
    expanded: true,
    hideToolInput: false,
    theme: 'dark',
    isError: false,
    isBackgroundBash: false,
    isForegroundBashRunning: false,
    isPendingApproval: false,
    permissionMode: 'default',
    onApproval: vi.fn().mockResolvedValue(undefined),
    borderColor: 'border-success/30',
    statusIcon: STATUS_ICON,
    toolOutputMaxChars: 5000,
    ...over
  }
}

describe('FileEditBody — Explain summary', () => {
  it('asks for the summary as soon as it mounts and shows it', async () => {
    render(<FileEditBody {...baseProps({})} />)
    expect(await screen.findByText('Changed one value.')).toBeInTheDocument()
    expect(explainEdit).toHaveBeenCalledWith('/a.ts', 'old', 'new', 'Explain this edit.', [])
  })

  it('answers a follow-up question, sending the earlier turns as history', async () => {
    explainEdit.mockResolvedValueOnce({ text: 'Changed one value.', error: null, log: [] })
    explainEdit.mockResolvedValueOnce({ text: 'Because it never changes.', error: null, log: [] })
    render(<FileEditBody {...baseProps({})} />)
    await screen.findByText('Changed one value.')

    fireEvent.change(screen.getByTestId('FileEditBody.explain.input'), {
      target: { value: 'Why const?' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }))

    expect(await screen.findByText('Because it never changes.')).toBeInTheDocument()
    expect(explainEdit).toHaveBeenLastCalledWith('/a.ts', 'old', 'new', 'Why const?', [
      { question: 'Explain this edit.', answer: 'Changed one value.' }
    ])
    // The first answer and the question stay on screen above the new answer.
    expect(screen.getByText('Why const?')).toBeInTheDocument()
    expect(screen.getByText('Changed one value.')).toBeInTheDocument()
  })

  it('shows the host trace under Details when the summary arrives', async () => {
    render(<FileEditBody {...baseProps({})} />)
    await screen.findByText('Changed one value.')
    const log = screen.getByTestId('FileEditBody.explain.log')
    expect(log).toHaveTextContent('renderer: asked: Explain this edit.')
    expect(log).toHaveTextContent('+0.1s message: assistant')
    expect(log).toHaveTextContent('renderer: got the answer')
  })

  it('shows the error and the trace instead of crashing when the host has no explainEdit', async () => {
    ;(globalThis as any).window.api = {}
    render(<FileEditBody {...baseProps({})} />)
    expect(await screen.findByTestId('FileEditBody.explain.error')).toHaveTextContent(
      "Couldn't answer:"
    )
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    expect(screen.getByTestId('FileEditBody.explain.log')).toHaveTextContent('call failed')
  })

  it("shows the host's reason and its trace when the summary fails", async () => {
    explainEdit.mockResolvedValueOnce({
      text: null,
      error: 'Timed out after 45s',
      log: ['+0.0s starting Haiku query', '+45.0s no answer after 45s, aborting']
    })
    render(<FileEditBody {...baseProps({})} />)
    expect(await screen.findByTestId('FileEditBody.explain.error')).toHaveTextContent(
      'Timed out after 45s'
    )
    expect(screen.getByTestId('FileEditBody.explain.log')).toHaveTextContent(
      '+0.0s starting Haiku query'
    )
  })

  describe('while waiting', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      explainEdit.mockImplementation(() => new Promise(() => {}))
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('counts down to the timeout', () => {
      render(<FileEditBody {...baseProps({})} />)
      expect(screen.getByTestId('FileEditBody.explain.loading')).toHaveTextContent(
        '45s until timeout'
      )
      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByTestId('FileEditBody.explain.loading')).toHaveTextContent(
        '42s until timeout'
      )
    })

    it('gives up on its own if the app never answers', () => {
      render(<FileEditBody {...baseProps({})} />)
      act(() => {
        vi.advanceTimersByTime(50_000)
      })
      expect(screen.getByTestId('FileEditBody.explain.error')).toHaveTextContent(
        'No reply from the app after 50s'
      )
      expect(screen.getByTestId('FileEditBody.explain.log')).toHaveTextContent('gave up waiting')
    })
  })
})

describe('FileEditBody — single-diff (ROADMAP #11c)', () => {
  it('hasDiff success: ONE DiffViewer (Input) + TerminalView (Result)', () => {
    render(<FileEditBody {...baseProps({})} />)
    const diffs = screen.getAllByTestId('DiffViewer')
    expect(diffs).toHaveLength(1)
    expect(diffs[0]).toHaveAttribute('data-old', 'old')
    expect(diffs[0]).toHaveAttribute('data-new', 'new')
    expect(screen.getByTestId('TerminalView')).toHaveAttribute('data-text', 'File updated')
  })

  it('hasDiff + hideToolInput: ONE DiffViewer in Result (not Input)', () => {
    render(<FileEditBody {...baseProps({ hideToolInput: true })} />)
    const diffs = screen.getAllByTestId('DiffViewer')
    expect(diffs).toHaveLength(1)
    // TerminalView should NOT appear (diff is in Result, not result text)
    expect(screen.queryByTestId('TerminalView')).not.toBeInTheDocument()
  })

  it('hasDiff error: red-pre (ExpandableText) — no DiffViewer in Result', () => {
    render(
      <FileEditBody
        {...baseProps({
          result: makeResult('Cannot edit: permission denied', true),
          isError: true
        })}
      />
    )
    // Diff still in Input
    expect(screen.getAllByTestId('DiffViewer')).toHaveLength(1)
    // Result is the error text, not a second diff
    expect(screen.queryByTestId('TerminalView')).not.toBeInTheDocument()
    expect(screen.getByText('Cannot edit: permission denied')).toBeInTheDocument()
  })

  it('no diff (MultiEdit): generic JSON input + TerminalView result', () => {
    render(
      <FileEditBody
        {...baseProps({
          view: { kind: 'fileEdit', path: '/a.ts', before: '', after: '' },
          block: makeBlock({ file_path: '/a.ts', edits: [{ old_string: 'x', new_string: 'y' }] })
        })}
      />
    )
    expect(screen.queryByTestId('DiffViewer')).not.toBeInTheDocument()
    expect(screen.getByTestId('TerminalView')).toBeInTheDocument()
  })
})

describe('FileEditBody — multi-file diffs (opencode apply_patch view.files)', () => {
  const files = [
    {
      path: 'a.ts',
      patch: '@@ -1 +1 @@\n-old\n+new',
      additions: 1,
      deletions: 1,
      changeType: 'update' as const
    },
    {
      path: 'b.ts',
      patch: '@@ -0,0 +1 @@\n+new file',
      additions: 1,
      deletions: 0,
      changeType: 'add' as const
    }
  ]

  it('renders one FileEditBody.file row + one DiffViewer per file, keyed by path', () => {
    render(
      <FileEditBody
        {...baseProps({
          view: { kind: 'fileEdit', path: '', before: '', after: '', files },
          result: makeResult('Success. Updated the following files:\nM a.ts\nA b.ts')
        })}
      />
    )
    const rows = screen.getAllByTestId('FileEditBody.file')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveAttribute('data-path', 'a.ts')
    expect(rows[1]).toHaveAttribute('data-path', 'b.ts')

    const diffs = screen.getAllByTestId('DiffViewer')
    expect(diffs).toHaveLength(2)
    expect(diffs[0]).toHaveAttribute('data-patch', files[0].patch)
    expect(diffs[1]).toHaveAttribute('data-patch', files[1].patch)

    // Result section shows the tool's text output (diff already shown in Input).
    expect(screen.getByTestId('TerminalView')).toHaveAttribute(
      'data-text',
      'Success. Updated the following files:\nM a.ts\nA b.ts'
    )
  })

  it('several files: each waits for a click, so opening makes no model calls', async () => {
    render(
      <FileEditBody
        {...baseProps({
          view: { kind: 'fileEdit', path: '', before: '', after: '', files },
          result: makeResult('ok')
        })}
      />
    )
    const starts = screen.getAllByTestId('FileEditBody.explain.start')
    expect(starts).toHaveLength(2)
    expect(explainEdit).not.toHaveBeenCalled()

    // The patch's context and changed lines become the before and after text.
    fireEvent.click(starts[0])
    expect(await screen.findByText('Changed one value.')).toBeInTheDocument()
    expect(explainEdit).toHaveBeenCalledWith('a.ts', 'old', 'new', 'Explain this edit.', [])
  })

  it('one file: starts on open like a single edit', async () => {
    render(
      <FileEditBody
        {...baseProps({
          view: { kind: 'fileEdit', path: '', before: '', after: '', files: [files[0]] },
          result: makeResult('ok')
        })}
      />
    )
    expect(await screen.findByText('Changed one value.')).toBeInTheDocument()
    expect(screen.queryByTestId('FileEditBody.explain.start')).not.toBeInTheDocument()
    expect(explainEdit).toHaveBeenCalledTimes(1)
  })

  it('patchToBeforeAfter keeps context and drops the headers', () => {
    expect(
      patchToBeforeAfter(
        'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,3 +1,3 @@\n keep\n-old\n+new\n tail'
      )
    ).toEqual({ before: 'keep\nold\ntail', after: 'keep\nnew\ntail' })
  })

  it('hideToolInput: the per-file diffs move to Result, not Input', () => {
    render(
      <FileEditBody
        {...baseProps({
          view: { kind: 'fileEdit', path: '', before: '', after: '', files },
          hideToolInput: true,
          result: makeResult('Success. Updated the following files:\nM a.ts\nA b.ts')
        })}
      />
    )
    expect(screen.getAllByTestId('FileEditBody.file')).toHaveLength(2)
    expect(screen.getAllByTestId('DiffViewer')).toHaveLength(2)
    // No TerminalView — the diff occupies the Result slot instead of the text.
    expect(screen.queryByTestId('TerminalView')).not.toBeInTheDocument()
  })

  it('empty files array falls back to the single before/after path (no rows)', () => {
    render(
      <FileEditBody
        {...baseProps({
          view: { kind: 'fileEdit', path: '/a.ts', before: '', after: '', files: [] }
        })}
      />
    )
    expect(screen.queryByTestId('FileEditBody.file')).not.toBeInTheDocument()
    expect(screen.queryByTestId('DiffViewer')).not.toBeInTheDocument()
  })
})
