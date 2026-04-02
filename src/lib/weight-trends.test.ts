import { describe, expect, it } from 'vitest'
import type { WeightLog } from '@/types'
import { buildWeightTrendPoints, summarizeWeightTrend } from './weight-trends'

function makeLog(date: string, weightKg: number): WeightLog {
  return {
    id: date,
    date,
    weightKg,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
  }
}

describe('weight-trends', () => {
  it('builds smoothed trend points from scale logs', () => {
    const logs = [
      makeLog('2026-03-01', 80),
      makeLog('2026-03-02', 81),
      makeLog('2026-03-03', 79),
    ]

    const points = buildWeightTrendPoints(logs)

    expect(points).toHaveLength(3)
    expect(points[0].trendWeightKg).toBeCloseTo(80, 4)
    expect(points[1].trendWeightKg).toBeCloseTo(80.35, 2)
    expect(points[2].trendWeightKg).toBeCloseTo(79.88, 2)
  })

  it('summarizes current trend weight separately from noisy scale weight', () => {
    const logs = [
      makeLog('2026-03-01', 80.0),
      makeLog('2026-03-02', 80.8),
      makeLog('2026-03-03', 79.9),
      makeLog('2026-03-04', 80.7),
      makeLog('2026-03-05', 79.7),
      makeLog('2026-03-06', 80.6),
      makeLog('2026-03-07', 79.6),
    ]

    const summary = summarizeWeightTrend(logs, 3)

    expect(summary.currentScaleWeightKg).toBeCloseTo(79.6, 4)
    expect(summary.currentTrendWeightKg).not.toBe(summary.currentScaleWeightKg)
    expect(summary.averageScaleWeightKg).toBeCloseTo(80.19, 2)
    expect(summary.previousTrendWeightKg).not.toBeNull()
    expect(summary.trendAmountKg).toBeLessThan(0)
    expect(['down', 'stable']).toContain(summary.trend)
  })

  it('returns a stable trend when movement is tiny', () => {
    const logs = [
      makeLog('2026-03-01', 80.0),
      makeLog('2026-03-02', 80.1),
      makeLog('2026-03-03', 80.0),
      makeLog('2026-03-04', 80.1),
    ]

    const summary = summarizeWeightTrend(logs, 2)

    expect(summary.trend).toBe('stable')
    expect(Math.abs(summary.trendAmountKg)).toBeLessThan(0.1)
  })
})
