import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UsagePaceCardView, paceVerdict } from '../UsagePaceCard'
import type { UsagePaceRow } from '../../../../../../shared/types'

const row = (over: Partial<UsagePaceRow> = {}): UsagePaceRow => ({
  time: '2026-11-03T15:15:25Z',
  percentUsed: 10,
  elapsedPct: 16.2,
  projected: 61.6,
  ...over
})

describe('paceVerdict', () => {
  it('is good under pace, warns near it, flags over pace', () => {
    expect(paceVerdict(row()).tone).toBe('good')
    expect(paceVerdict(row({ projected: 95 })).tone).toBe('warn')
    expect(paceVerdict(row({ projected: 120, elapsedPct: 50 })).tone).toBe('over')
  })

  it('late in the week only flags a clear overrun', () => {
    expect(paceVerdict(row({ projected: 102, elapsedPct: 95 })).tone).toBe('warn')
    expect(paceVerdict(row({ projected: 110, elapsedPct: 95 })).tone).toBe('over')
  })
})

describe('UsagePaceCardView', () => {
  const base = { checking: false, error: null }

  it('shows stats, chart and verdict for the latest reading', () => {
    render(<UsagePaceCardView {...base} rows={[row({ percentUsed: 4, elapsedPct: 5 }), row()]} />)
    expect(screen.getByText('10%')).toBeTruthy()
    expect(screen.getByTestId('UsagePaceCard.chart')).toBeTruthy()
    expect(screen.getAllByTestId('UsagePaceCard.day')).toHaveLength(7)
    expect(screen.getByTestId('UsagePaceCard.verdict').textContent).toMatch(/Under pace/)
  })

  it('shows an empty state when there are no readings', () => {
    render(<UsagePaceCardView {...base} rows={[]} />)
    expect(screen.getByText(/No readings yet this week/)).toBeTruthy()
    expect(screen.queryByTestId('UsagePaceCard.chart')).toBeNull()
  })

  it('has no check button and shows a status while checking', () => {
    const { rerender } = render(<UsagePaceCardView {...base} rows={[]} />)
    expect(screen.queryByTestId('UsagePaceCard.check')).toBeNull()
    expect(screen.queryByTestId('UsagePaceCard.checking')).toBeNull()
    rerender(<UsagePaceCardView {...base} checking rows={[]} />)
    expect(screen.getByTestId('UsagePaceCard.checking')).toBeTruthy()
  })

  it('shows a failed check instead of hiding it', () => {
    render(<UsagePaceCardView {...base} rows={[row()]} error="No weekly usage window" />)
    expect(screen.getByTestId('UsagePaceCard.error').textContent).toBe('No weekly usage window')
  })
})
