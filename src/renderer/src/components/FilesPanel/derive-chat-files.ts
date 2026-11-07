import type { ChatMessage } from '../../../../shared/types'

export interface ChatFileRow {
  path: string
  kind: 'sent' | 'artifact' | 'written' | 'upload'
  url?: string
}

const OPENABLE =
  /\.(html?|pdf|png|jpe?g|gif|webp|svg|mp3|wav|mp4|md|csv|tsv|json|xlsx|docx|pptx|txt)$/i
const ATTACHED_LINE = /^- (\/[^\n]+)$/gm
const ARTIFACT_URL = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[A-Za-z0-9_-]+/

/** Every file the chat touched: sent, published as an artifact, written, or attached by the user. */
export function deriveChatFiles(messages: ChatMessage[]): ChatFileRow[] {
  const byPath = new Map<string, ChatFileRow>()
  const put = (row: ChatFileRow): void => {
    byPath.delete(row.path)
    byPath.set(row.path, row)
  }

  for (const msg of messages) {
    for (const block of msg.content) {
      if (msg.role === 'user' && block.type === 'text') {
        const section = block.text.split('Attached files')[1]
        if (!section) continue
        for (const m of section.matchAll(ATTACHED_LINE)) put({ path: m[1], kind: 'upload' })
        continue
      }
      if (block.type !== 'tool_use') continue
      const input = block.toolInput ?? {}
      const filePath = typeof input.file_path === 'string' ? input.file_path : undefined
      if (block.toolName === 'SendUserFile') {
        const raw = input.files
        for (const p of Array.isArray(raw) ? raw : [raw]) {
          if (typeof p === 'string' && p.trim()) put({ path: p, kind: 'sent' })
        }
      } else if (block.toolName === 'Artifact' && filePath && !input.action) {
        const result = msg.content.find(
          (b) => b.type === 'tool_result' && b.toolUseId === block.toolUseId
        )
        const url =
          result?.type === 'tool_result' ? result.toolResult.match(ARTIFACT_URL)?.[0] : undefined
        put({ path: filePath, kind: 'artifact', ...(url ? { url } : {}) })
      } else if (
        (block.toolName === 'Write' || block.toolName === 'Edit') &&
        filePath &&
        OPENABLE.test(filePath)
      ) {
        // An edit to a file already sent/published/attached keeps that kind
        // (and its artifact link); it only moves the row to the newest slot.
        const prev = byPath.get(filePath)
        put(prev ?? { path: filePath, kind: 'written' })
      }
    }
  }
  return Array.from(byPath.values()).reverse()
}
