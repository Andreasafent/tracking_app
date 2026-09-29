import type { Period, TrainingPlan } from './database.types'
import type { ISODate } from './dates'

export type TrainingDay = { date: ISODate; exercises: string[]; kcal: number | null }

/** Reads a plan's stored days; older plans kept a single `training` string per day. */
export function daysOf(p: Pick<TrainingPlan, 'days'>): TrainingDay[] {
  if (!Array.isArray(p.days)) return []
  return (p.days as unknown as (TrainingDay & { training?: string })[]).map((d) => ({
    date: d.date,
    exercises: d.exercises ?? (d.training ? [d.training] : []),
    kcal: d.kcal ?? null,
  }))
}

export type IntakeTarget = { kcal: number | null; source: 'training' | 'period' | null }

/**
 * The day's calorie target: the training plan's target for that day if set,
 * otherwise the MARATHON BLOCK period covering it, otherwise none.
 */
export function intakeTarget(date: ISODate, plans: TrainingPlan[], period: Period | undefined): IntakeTarget {
  for (const p of plans) {
    if (p.start_date > date || p.end_date < date) continue
    const kcal = daysOf(p).find((d) => d.date === date)?.kcal
    if (kcal != null) return { kcal, source: 'training' }
  }
  if (period) return { kcal: period.target_intake, source: 'period' }
  return { kcal: null, source: null }
}
