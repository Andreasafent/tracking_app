import type { DailySummary } from './database.types'
import { addDays, type ISODate, type Range } from './dates'

export const KCAL_PER_KG = 7700

type NumKey = { [K in keyof DailySummary]: DailySummary[K] extends number | null ? K : never }[keyof DailySummary]
type BoolKey = { [K in keyof DailySummary]: DailySummary[K] extends boolean | null ? K : never }[keyof DailySummary]

export function inRange(rows: DailySummary[], r: Range): DailySummary[] {
  return rows.filter((d) => d.date != null && d.date >= r.from && d.date <= r.to)
}

const vals = (rows: DailySummary[], k: NumKey) =>
  rows.map((r) => r[k]).filter((v): v is number => v != null)

export function avg(rows: DailySummary[], k: NumKey): number | null {
  const v = vals(rows, k)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export function sum(rows: DailySummary[], k: NumKey): number {
  return vals(rows, k).reduce((a, b) => a + b, 0)
}

/** Days where the boolean was explicitly logged as `value`. */
export function countBool(rows: DailySummary[], k: BoolKey, value = true): number {
  return rows.filter((r) => r[k] === value).length
}

export const daysIn = (r: Range) =>
  Math.round((new Date(r.to).getTime() - new Date(r.from).getTime()) / 86_400_000) + 1

/** Average weight of the 7 days ending on `date` (the ΓΕΝΙΚΑ hero sub-value). */
export function weight7(rows: DailySummary[], date: ISODate): number | null {
  return avg(inRange(rows, { from: addDays(date, -6), to: date }), 'weight')
}

export interface BlockStats {
  range: Range
  days: number
  weight: number | null
  kcal: number | null
  burned: number | null
  deficit: number | null
  protein: number | null
  creatineDays: number
  waterTotal: number
  waterAvg: number | null
  proteinTargetDays: number
  noAlcoholDays: number
  noSugarDays: number
  sleepHours: number | null
  sleepQuality: number | null
  energy: number | null
  fatigue: number | null
  restingHr: number | null
  sleepHr: number | null
  hrv: number | null
  runKm: number
  runMin: number
  bikeKm: number
  bikeMin: number
  swimM: number
  swimMin: number
  steps: number | null
  weightsDays: number
  trainingMin: number
  mood: number | null
  anxiety: number | null
  motivation: number | null
  focus: number | null
  hunger: number | null
  sleepiness: number | null
}

export function blockStats(all: DailySummary[], range: Range): BlockStats {
  const rows = inRange(all, range)
  return {
    range,
    days: daysIn(range),
    weight: avg(rows, 'weight'),
    kcal: avg(rows, 'kcal'),
    burned: avg(rows, 'burned'),
    deficit: avg(rows, 'deficit'),
    protein: avg(rows, 'protein'),
    creatineDays: countBool(rows, 'creatine'),
    waterTotal: sum(rows, 'water'),
    waterAvg: avg(rows, 'water'),
    proteinTargetDays: rows.filter((r) => r.protein != null && r.protein >= (r.protein_target ?? 180)).length,
    noAlcoholDays: countBool(rows, 'alcohol', false),
    noSugarDays: countBool(rows, 'sugar', false),
    sleepHours: avg(rows, 'sleep_hours'),
    sleepQuality: avg(rows, 'sleep_quality'),
    energy: avg(rows, 'energy'),
    fatigue: avg(rows, 'fatigue'),
    restingHr: avg(rows, 'resting_hr'),
    sleepHr: avg(rows, 'sleep_hr'),
    hrv: avg(rows, 'hrv'),
    runKm: sum(rows, 'run_km'),
    runMin: sum(rows, 'run_min'),
    bikeKm: sum(rows, 'bike_km'),
    bikeMin: sum(rows, 'bike_min'),
    swimM: sum(rows, 'swim_m'),
    swimMin: sum(rows, 'swim_min'),
    steps: avg(rows, 'steps'),
    weightsDays: countBool(rows, 'did_weights'),
    trainingMin: sum(rows, 'training_min'),
    mood: avg(rows, 'mood'),
    anxiety: avg(rows, 'anxiety'),
    motivation: avg(rows, 'motivation'),
    focus: avg(rows, 'focus'),
    hunger: avg(rows, 'hunger'),
    sleepiness: avg(rows, 'sleepiness'),
  }
}

/** Kg of fat lost over a range: Σ(burned − eaten) / 7700 over days with calories logged. */
export function kgLost(rows: DailySummary[]): number {
  return rows.reduce((acc, r) => (r.kcal != null && r.burned != null ? acc + (r.burned - r.kcal) : acc), 0) / KCAL_PER_KG
}

/**
 * Adaptive burn estimate from your own data (MacroFactor-style):
 * average intake minus the energy stored/lost, from the weight trend.
 * Compares the mean weight of the first and last 7 days of a `windowDays` window.
 */
export function estimatedBurn(all: DailySummary[], endDate: ISODate, windowDays = 21): number | null {
  const from = addDays(endDate, -(windowDays - 1))
  const rows = inRange(all, { from, to: endDate })
  const intake = avg(rows, 'kcal')
  const first = avg(inRange(rows, { from, to: addDays(from, 6) }), 'weight')
  const last = avg(inRange(rows, { from: addDays(endDate, -6), to: endDate }), 'weight')
  const intakeDays = vals(rows, 'kcal').length
  if (intake == null || first == null || last == null || intakeDays < windowDays * 0.6) return null
  const span = windowDays - 7 // days between the centres of the two 7-day means
  return intake - ((last - first) * KCAL_PER_KG) / span
}
