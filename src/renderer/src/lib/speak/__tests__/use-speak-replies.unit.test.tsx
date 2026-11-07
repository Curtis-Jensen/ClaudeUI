import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../../../../shared/types'

const speaker = vi.hoisted(() => ({
  isSpeakingEnabled: vi.fn(() => true),
  getSpeakScope: vi.fn((): 'final' | 'all' => 'all'),
  enqueueSpeech: vi.fn((_text: string, _options?: { key?: string }) => Promise.resolve(true)),
  stopSpeaking: vi.fn()
}))
vi.mock('../kokoro-speaker', () => speaker)

import { useSpeakReplies } from '../use-speak-replies'

const reply = (id: string, text: string): ChatMessage =>
  ({ id, role: 'assistant', content: [{ type: 'text', text }] }) as unknown as ChatMessage
const toolOnly = (id: string): ChatMessage =>
  ({
    id,
    role: 'assistant',
    content: [{ type: 'tool_use', toolName: 'Bash', toolInput: {}, toolUseId: id }]
  }) as unknown as ChatMessage
const prompt = (id: string): ChatMessage =>
  ({ id, role: 'user', content: [{ type: 'text', text: 'do it' }] }) as unknown as ChatMessage

type Props = { sessionId: string | null; messages: ChatMessage[]; isRunning: boolean }

function mount(initial: Props) {
  return renderHook(
    (props: Props) => useSpeakReplies(props.sessionId, props.messages, props.isRunning),
    { initialProps: initial }
  )
}

const spoken = (): string[] => speaker.enqueueSpeech.mock.calls.map((call) => call[0])

describe('useSpeakReplies — every finished reply is read, in order', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speaker.isSpeakingEnabled.mockReturnValue(true)
    speaker.getSpeakScope.mockReturnValue('all')
  })

  it('reads the notes between tool calls and the closing summary, in order', () => {
    const history = [reply('old', 'An earlier answer.')]
    const view = mount({ sessionId: 's1', messages: history, isRunning: false })

    view.rerender({ sessionId: 's1', messages: [...history, prompt('u1')], isRunning: true })
    // The newest message is still being written, so it waits.
    const first = [...history, prompt('u1'), reply('a1', 'Let me look at the file.')]
    view.rerender({ sessionId: 's1', messages: first, isRunning: true })
    expect(spoken()).toEqual([])

    // A later message exists, so the first note is final and is read.
    const second = [...first, toolOnly('t1'), reply('a2', 'Found it, fixing now.')]
    view.rerender({ sessionId: 's1', messages: second, isRunning: true })
    expect(spoken()).toEqual(['Let me look at the file.'])

    // The turn ends: the last message is final too.
    view.rerender({ sessionId: 's1', messages: second, isRunning: false })
    expect(spoken()).toEqual(['Let me look at the file.', 'Found it, fixing now.'])
    expect(speaker.enqueueSpeech).toHaveBeenLastCalledWith('Found it, fixing now.', { key: 'a2' })
  })

  it('never reads the same reply twice', () => {
    const view = mount({ sessionId: 's1', messages: [], isRunning: false })
    view.rerender({ sessionId: 's1', messages: [prompt('u1')], isRunning: true })
    const done = [prompt('u1'), reply('a1', 'Hello there.')]
    view.rerender({ sessionId: 's1', messages: done, isRunning: false })
    view.rerender({ sessionId: 's1', messages: [...done], isRunning: false })

    expect(spoken()).toEqual(['Hello there.'])
  })

  it('reads nothing when a chat is merely opened or switched to', () => {
    const view = mount({ sessionId: 's1', messages: [reply('a', 'Old news.')], isRunning: false })
    view.rerender({ sessionId: 's2', messages: [reply('b', 'Other chat.')], isRunning: false })

    expect(spoken()).toEqual([])
  })

  it('stays quiet while reading is switched off, and does not replay it when switched on', () => {
    speaker.isSpeakingEnabled.mockReturnValue(false)
    const view = mount({ sessionId: 's1', messages: [], isRunning: false })
    view.rerender({ sessionId: 's1', messages: [prompt('u1')], isRunning: true })
    const done = [prompt('u1'), reply('a1', 'Hello.')]
    view.rerender({ sessionId: 's1', messages: done, isRunning: false })
    expect(spoken()).toEqual([])

    speaker.isSpeakingEnabled.mockReturnValue(true)
    view.rerender({ sessionId: 's1', messages: [...done], isRunning: false })
    expect(spoken()).toEqual([])
  })

  it('a new turn silences whatever is still being read', () => {
    const view = mount({ sessionId: 's1', messages: [reply('a', 'Hi.')], isRunning: false })
    speaker.stopSpeaking.mockClear()
    view.rerender({ sessionId: 's1', messages: [reply('a', 'Hi.'), prompt('u2')], isRunning: true })

    expect(speaker.stopSpeaking).toHaveBeenCalledTimes(1)
  })
})

describe('useSpeakReplies — summary only', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speaker.isSpeakingEnabled.mockReturnValue(true)
    speaker.getSpeakScope.mockReturnValue('final')
  })

  it('skips the check-ins while working and reads only the summary at the end', () => {
    const history = [reply('old', 'An earlier answer.')]
    const view = mount({ sessionId: 's1', messages: history, isRunning: false })

    view.rerender({ sessionId: 's1', messages: [...history, prompt('u1')], isRunning: true })
    const working = [
      ...history,
      prompt('u1'),
      reply('a1', 'Let me look at the file.'),
      toolOnly('t1'),
      reply('a2', 'Found it, fixing now.'),
      toolOnly('t2')
    ]
    view.rerender({ sessionId: 's1', messages: working, isRunning: true })
    expect(spoken()).toEqual([])

    const done = [...working, reply('a3', 'All done: the fix is in.')]
    view.rerender({ sessionId: 's1', messages: done, isRunning: true })
    expect(spoken()).toEqual([])

    view.rerender({ sessionId: 's1', messages: done, isRunning: false })
    expect(spoken()).toEqual(['All done: the fix is in.'])
    expect(speaker.enqueueSpeech).toHaveBeenCalledWith('All done: the fix is in.', { key: 'a3' })
  })

  it('reads a plain conversational reply, which is its own summary', () => {
    const view = mount({ sessionId: 's1', messages: [], isRunning: false })
    view.rerender({ sessionId: 's1', messages: [prompt('u1')], isRunning: true })
    view.rerender({
      sessionId: 's1',
      messages: [prompt('u1'), reply('a1', 'Hello there.')],
      isRunning: false
    })

    expect(spoken()).toEqual(['Hello there.'])
  })

  it('reads the last reply with words when the turn ends on a tool call', () => {
    const view = mount({ sessionId: 's1', messages: [], isRunning: false })
    view.rerender({ sessionId: 's1', messages: [prompt('u1')], isRunning: true })
    view.rerender({
      sessionId: 's1',
      messages: [prompt('u1'), reply('a1', 'Done.'), toolOnly('t1')],
      isRunning: false
    })

    expect(spoken()).toEqual(['Done.'])
  })

  it('reads nothing from a turn that produced no new words, and never twice', () => {
    const history = [reply('old', 'An earlier answer.')]
    const view = mount({ sessionId: 's1', messages: history, isRunning: false })
    view.rerender({ sessionId: 's1', messages: [...history, prompt('u1')], isRunning: true })
    const done = [...history, prompt('u1'), toolOnly('t1')]
    view.rerender({ sessionId: 's1', messages: done, isRunning: false })
    view.rerender({ sessionId: 's1', messages: [...done], isRunning: false })

    expect(spoken()).toEqual([])
  })

  it('stays quiet when reading is off, and does not replay it when switched back on', () => {
    speaker.isSpeakingEnabled.mockReturnValue(false)
    const view = mount({ sessionId: 's1', messages: [], isRunning: false })
    view.rerender({ sessionId: 's1', messages: [prompt('u1')], isRunning: true })
    const done = [prompt('u1'), reply('a1', 'Hello.')]
    view.rerender({ sessionId: 's1', messages: done, isRunning: false })

    speaker.isSpeakingEnabled.mockReturnValue(true)
    view.rerender({ sessionId: 's1', messages: [...done], isRunning: false })
    expect(spoken()).toEqual([])
  })
})

describe('useSpeakReplies — first turn of a brand-new chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    speaker.isSpeakingEnabled.mockReturnValue(true)
    speaker.getSpeakScope.mockReturnValue('final')
  })

  it('reads the summary even when the session id arrives after the turn started', () => {
    const view = mount({ sessionId: null, messages: [], isRunning: false })
    view.rerender({ sessionId: 's1', messages: [prompt('u1')], isRunning: true })
    view.rerender({
      sessionId: 's1',
      messages: [prompt('u1'), reply('a1', 'All done.')],
      isRunning: true
    })
    view.rerender({
      sessionId: 's1',
      messages: [prompt('u1'), reply('a1', 'All done.')],
      isRunning: false
    })
    expect(spoken()).toEqual(['All done.'])
  })
})
