import type { Period, TrainingPlan } from './database.types'
import type { ISODate } from './dates'

/** One day of a plan: what to train and, optionally, the targets for that day. */
export type TrainingDay = {
  date: ISODate
  exercises: string[]
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

/** Reads a plan's stored days; older plans kept a single `training` string per day. */
export function daysOf(p: Pick<TrainingPlan, 'days'>): TrainingDay[] {
  if (!Array.isArray(p.days)) return []
  return (p.days as unknown as (TrainingDay & { training?: string })[]).map((d) => ({
    date: d.date,
    exercises: d.exercises ?? (d.training ? [d.training] : []),
    kcal: d.kcal ?? null,
    protein: d.protein ?? null,
    carbs: d.carbs ?? null,
    fat: d.fat ?? null,
  }))
}

export type MacroTargets = { protein: number | null; carbs: number | null; fat: number | null }

/**
 * The day's protein / carbs / fat targets, each on its own: the training plan's value for that day if set,
 * otherwise the TARGETS period covering it, otherwise none.
 */
export function macroTargets(date: ISODate, plans: TrainingPlan[], period: Period | undefined): MacroTargets {
  const fromPlan = (k: 'protein' | 'carbs' | 'fat') => {
    for (const p of plans) {
      if (p.start_date > date || p.end_date < date) continue
      const v = daysOf(p).find((d) => d.date === date)?.[k]
      if (v != null) return v
    }
    return null
  }
  return {
    protein: fromPlan('protein') ?? period?.protein_target ?? null,
    carbs: fromPlan('carbs') ?? period?.carbs_target ?? null,
    fat: fromPlan('fat') ?? period?.fat_target ?? null,
  }
}

export type IntakeTarget = { kcal: number | null; source: 'training' | 'period' | null }

/**
 * The day's calorie target: the training plan's target for that day if set,
 * otherwise the TARGETS period covering it, otherwise none.
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
