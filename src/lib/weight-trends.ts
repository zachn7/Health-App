import type { WeightLog } from '@/types'

export type WeightDirection = 'up' | 'down' | 'stable'

export interface WeightTrendPoint {
  date: string
  scaleWeightKg: number
  trendWeightKg: number
}

export interface WeightTrendSummary {
  currentScaleWeightKg: number | null
  currentTrendWeightKg: number | null
  previousTrendWeightKg: number | null
  trend: WeightDirection | null
  trendAmountKg: number
  averageScaleWeightKg: number
  points: WeightTrendPoint[]
}

const DEFAULT_ALPHA = 0.35
const STABLE_THRESHOLD_KG = 0.1

export function buildWeightTrendPoints(logs: WeightLog[], alpha = DEFAULT_ALPHA): WeightTrendPoint[] {
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date))

  let previousTrendWeightKg: number | null = null

  return sortedLogs.map((log) => {
    const trendWeightKg = previousTrendWeightKg === null
      ? log.weightKg
      : (alpha * log.weightKg) + ((1 - alpha) * previousTrendWeightKg)

    previousTrendWeightKg = trendWeightKg

    return {
      date: log.date,
      scaleWeightKg: log.weightKg,
      trendWeightKg,
    }
  })
}

export function summarizeWeightTrend(logs: WeightLog[], comparisonWindow = 7): WeightTrendSummary {
  if (logs.length === 0) {
    return {
      currentScaleWeightKg: null,
      currentTrendWeightKg: null,
      previousTrendWeightKg: null,
      trend: null,
      trendAmountKg: 0,
      averageScaleWeightKg: 0,
      points: [],
    }
  }

  const points = buildWeightTrendPoints(logs)
  const currentPoint = points[points.length - 1]
  const previousPoint = points[Math.max(0, points.length - comparisonWindow)]
  const trendAmountKg = currentPoint.trendWeightKg - previousPoint.trendWeightKg
  const trend = Math.abs(trendAmountKg) < STABLE_THRESHOLD_KG
    ? 'stable'
    : trendAmountKg > 0
      ? 'up'
      : 'down'

  const averageScaleWeightKg = points.reduce((sum, point) => sum + point.scaleWeightKg, 0) / points.length

  return {
    currentScaleWeightKg: currentPoint.scaleWeightKg,
    currentTrendWeightKg: currentPoint.trendWeightKg,
    previousTrendWeightKg: previousPoint.trendWeightKg,
    trend,
    trendAmountKg,
    averageScaleWeightKg,
    points,
  }
}
