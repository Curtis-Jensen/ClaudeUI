import { describe, expect, it } from 'vitest'
import { editForkAnchor } from '../session-store'
import type { ChatMessage } from '../../../../shared/types'

function msg(id: string, role: ChatMessage['role'], content: ChatMessage['content'] = []) {
  return { id, role, content, timestamp: 0 } as unknown as ChatMessage
}

const text = (t: string) => ({ type: 'text' as const, text: t })

describe('editForkAnchor', () => {
  it('forks from the reply right before an answered user message', () => {
    const messages = [
      msg('u1', 'user', [text('hi')]),
      msg('a1', 'assistant'),
      msg('u2', 'user', [text('again')])
    ]
    expect(editForkAnchor(messages, 2)?.id).toBe('a1')
  })

  it('offers nothing for a first message, which has no reply before it', () => {
    const messages = [msg('u1', 'user', [text('hi')])]
    expect(editForkAnchor(messages, 0)).toBeNull()
  })

  it('offers nothing when the message before is another user message', () => {
    const messages = [msg('u1', 'user', [text('one')]), msg('u2', 'user', [text('two')])]
    expect(editForkAnchor(messages, 1)).toBeNull()
  })

  it('offers nothing for a message with attachments', () => {
    const messages = [
      msg('a1', 'assistant'),
      msg('u2', 'user', [
        { type: 'image', blobId: 'b', mediaType: 'image/png' } as never,
        text('look')
      ])
    ]
    expect(editForkAnchor(messages, 1)).toBeNull()
  })

  it('offers nothing for a message with no text', () => {
    const messages = [msg('a1', 'assistant'), msg('u2', 'user', [text('   ')])]
    expect(editForkAnchor(messages, 1)).toBeNull()
  })

  it('offers nothing for an index out of range', () => {
    expect(editForkAnchor([msg('a1', 'assistant')], 5)).toBeNull()
  })
})
