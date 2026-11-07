import type { BranchPrState } from '../../../../shared/types'

const LABEL: Record<Exclude<BranchPrState, 'none'>, string> = {
  open: 'Pull request open',
  draft: 'Pull request draft',
  merged: 'Pull request merged',
  closed: 'Pull request closed'
}

const COLOR: Record<Exclude<BranchPrState, 'none'>, string> = {
  open: '#3fb950',
  draft: '#8b949e',
  merged: '#a371f7',
  closed: '#f85149'
}

/** A pull-request status mark for a session row: open, draft or merged. The row draws nothing for `none`. */
export function BranchPrIcon({
  state,
  url
}: {
  state: Exclude<BranchPrState, 'none'>
  url: string | null
}): React.JSX.Element {
  const Tag = url ? 'a' : 'span'
  return (
    <Tag
      data-testid="SessionItem.prState"
      data-state={state}
      title={url ? `${LABEL[state]} — click to open on GitHub` : LABEL[state]}
      className={`shrink-0 flex items-center ${url ? 'cursor-pointer hover:brightness-125' : ''}`}
      style={{ color: COLOR[state] }}
      {...(url ? { href: url, target: '_blank', rel: 'noreferrer' } : {})}
      // The row selects the session on a click and starts a drag on a press: neither is meant for the link.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      draggable={false}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={state === 'draft' ? '3 2.5' : undefined}
        role="img"
        aria-label={LABEL[state]}
      >
        {state === 'merged' ? (
          <>
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="12" r="3" />
            <path d="M6 9v6" />
            <path d="M9 6c5 0 6 3 6 6" />
          </>
        ) : state === 'closed' ? (
          <>
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M6 9v6" />
            <path d="M15 15l6 6" />
            <path d="M21 15l-6 6" />
          </>
        ) : (
          <>
            <circle cx="6" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="18" r="3" />
            <path d="M6 9v6" />
            <path d="M18 15V9a3 3 0 00-3-3h-3" />
          </>
        )}
      </svg>
    </Tag>
  )
}
