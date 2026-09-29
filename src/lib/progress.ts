import type { DistanceEffort, ExerciseLog, Json, PbDistance } from './database.types'
import { addDays, diffDays, type ISODate } from './dates'
import { num } from './format'

// ─── Strength

export const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Στήθος' },
  { value: 'back', label: 'Πλάτη' },
  { value: 'shoulders', label: 'Ώμοι' },
  { value: 'biceps', label: 'Δικέφαλα' },
  { value: 'triceps', label: 'Τρικέφαλα' },
  { value: 'legs', label: 'Πόδια' },
  { value: 'glutes', label: 'Γλουτοί' },
  { value: 'calves', label: 'Γάμπες' },
  { value: 'core', label: 'Κοιλιακοί' },
  { value: 'other', label: 'Άλλο' },
] as const

export const groupLabel = (g: string) => MUSCLE_GROUPS.find((m) => m.value === g)?.label ?? g

/** Estimated one-rep max (Epley). Null for bodyweight-only or missing reps. */
export function oneRM(l: Pick<ExerciseLog, 'weight' | 'reps'>): number | null {
  if (!l.weight || !l.reps) return null
  return l.reps === 1 ? l.weight : l.weight * (1 + l.reps / 30)
}

/** Bodyweight exercises (no weight ever logged) progress by reps instead of kg. */
export const isBodyweight = (logs: ExerciseLog[]) => logs.length > 0 && logs.every((l) => !l.weight)

/** The number that "goes up" for an exercise: weight, or reps for bodyweight work. */
export const score = (l: ExerciseLog, bodyweight: boolean) => (bodyweight ? l.reps : l.weight) ?? 0

/** Ids of logs that beat every earlier log of the same exercise (the first log is a baseline, not a PR). */
export function prIds(logs: ExerciseLog[]): Set<string> {
  const out = new Set<string>()
  const bw = isBodyweight(logs)
  let best: number | null = null
  for (const l of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    const v = score(l, bw)
    if (best != null && v > best) out.add(l.id)
    best = best == null ? v : Math.max(best, v)
  }
  return out
}

export function fmtSet(l: Pick<ExerciseLog, 'weight' | 'reps' | 'sets'>): string {
  const parts = [l.weight ? `${num(l.weight, 2)} kg` : 'BW']
  if (l.sets && l.reps) parts.push(`${l.sets}×${l.reps}`)
  else if (l.reps) parts.push(`${l.reps} επ.`)
  else if (l.sets) parts.push(`${l.sets} σετ`)
  return parts.join(' · ')
}

// ─── Distances & races

export const DEFAULT_DISTANCES = [
  { name: '1K', meters: 1000 },
  { name: '5K', meters: 5000 },
  { name: '10K', meters: 10000 },
  { name: 'Ημιμαραθώνιος', meters: 21097.5 },
  { name: 'Μαραθώνιος', meters: 42195 },
]

/** 1:23:45 / 23:45 / 58.3 */
export function fmtTime(sec: number | null | undefined): string {
  if (sec == null) return '—'
  const tenths = Math.round(sec * 10) / 10
  const h = Math.floor(tenths / 3600)
  const m = Math.floor((tenths % 3600) / 60)
  const s = tenths % 60
  const ss = Number.isInteger(s) ? String(s).padStart(2, '0') : s.toFixed(1).padStart(4, '0').replace('.', ',')
  if (h) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  if (m) return `${m}:${ss}`
  return ss.replace(/^0(?=\d)/, '')
}

/** Pace per km, e.g. "4:35 /km". */
export function fmtPace(sec: number | null | undefined, meters: number): string {
  if (sec == null || !meters) return '—'
  return `${fmtTime(Math.round(sec / (meters / 1000)))} /km`
}

export const fmtKm = (meters: number) => `${num(meters / 1000, 3)} km`

/** Signed time difference, e.g. "−0:42" (faster) or "+1:05". */
export function fmtTimeDelta(sec: number): string {
  return `${sec < 0 ? '−' : '+'}${fmtTime(Math.abs(sec))}`
}

const timed = (efforts: DistanceEffort[]) =>
  efforts.filter((e): e is DistanceEffort & { time_sec: number } => e.time_sec != null)

/** Fastest effort for a distance (races included). */
export function bestEffort(efforts: DistanceEffort[]) {
  return timed(efforts).reduce<(DistanceEffort & { time_sec: number }) | null>(
    (b, e) => (!b || e.time_sec < b.time_sec ? e : b),
    null,
  )
}

/** Ids of efforts that were faster than every earlier effort on the same distance (first one is a baseline). */
export function pbIds(efforts: DistanceEffort[]): Set<string> {
  const out = new Set<string>()
  let best: number | null = null
  for (const e of timed(efforts).sort((a, b) => a.date.localeCompare(b.date))) {
    if (best != null && e.time_sec < best) out.add(e.id)
    best = best == null ? e.time_sec : Math.min(best, e.time_sec)
  }
  return out
}

/**
 * Riegel prediction for `target` from the best recent (last year) efforts on the other distances;
 * returns the fastest prediction. Sources under 1500 m are skipped (they overpredict long races).
 */
export function predict(
  target: PbDistance,
  distances: PbDistance[],
  efforts: DistanceEffort[],
  asOf: ISODate,
): { sec: number; from: PbDistance } | null {
  const since = addDays(asOf, -365)
  let out: { sec: number; from: PbDistance } | null = null
  if (target.sport !== 'run') return null
  for (const d of distances) {
    if (d.id === target.id || d.sport !== 'run' || d.meters < 1500) continue
    const b = bestEffort(efforts.filter((e) => e.distance_id === d.id && e.date >= since && e.date <= asOf))
    if (!b) continue
    const sec = b.time_sec * Math.pow(target.meters / d.meters, 1.06)
    if (!out || sec < out.sec) out = { sec, from: d }
  }
  return out
}

export const isUpcoming = (e: DistanceEffort, t: ISODate) => e.is_race && (e.time_sec == null || e.date > t)

export function countdown(date: ISODate, t: ISODate): string {
  const d = diffDays(date, t)
  if (d === 0) return 'Σήμερα'
  if (d === 1) return 'Αύριο'
  if (d < 0) return `πριν ${-d} μέρες`
  return `σε ${d} μέρες`
}

// ─── Triathlon

export type Legs = { swim: number; bike: number; run: number }
export const SPLITS = [
  { key: 'swim', label: 'Κολύμβηση' },
  { key: 't1', label: 'T1' },
  { key: 'bike', label: 'Ποδήλατο' },
  { key: 't2', label: 'T2' },
  { key: 'run', label: 'Τρέξιμο' },
] as const
export type SplitKey = (typeof SPLITS)[number]['key']
export type Splits = Partial<Record<SplitKey, number | null>>

export const TRI_FORMATS: { name: string; legs: Legs }[] = [
  { name: 'Sprint', legs: { swim: 750, bike: 20000, run: 5000 } },
  { name: 'Olympic', legs: { swim: 1500, bike: 40000, run: 10000 } },
  { name: '70.3', legs: { swim: 1900, bike: 90000, run: 21097.5 } },
  { name: 'Ironman', legs: { swim: 3800, bike: 180000, run: 42195 } },
]

export const legsOf = (d: Pick<PbDistance, 'legs'>): Legs | null => (d.legs as Legs | null) ?? null
export const splitsOf = (e: Pick<DistanceEffort, 'splits'>): Splits => (e.splits as Splits | null) ?? {}
export const toJson = (v: Legs | Splits) => v as unknown as Json
export const sameLegs = (a: Legs, b: Legs) =>
  Math.abs(a.swim - b.swim) < 1 && Math.abs(a.bike - b.bike) < 1 && Math.abs(a.run - b.run) < 1

/** Total of the entered splits, or null if none are entered. */
export function splitsTotal(s: Splits): number | null {
  const v = SPLITS.map((x) => s[x.key]).filter((n): n is number => n != null)
  return v.length ? +v.reduce((a, b) => a + b, 0).toFixed(1) : null
}

/** "750 m · 20 km · 5 km" */
export function fmtLegs(l: Legs): string {
  const m = (v: number) => (v < 5000 ? `${num(v, 0)} m` : `${num(v / 1000, 1)} km`)
  return `${m(l.swim)} · ${m(l.bike)} · ${m(l.run)}`
}

/** Pace/speed per leg the way each sport quotes it: swim /100m, bike km/h, run /km. */
export function fmtLegPace(key: SplitKey, sec: number | null | undefined, legs: Legs | null): string | null {
  if (sec == null || !legs) return null
  if (key === 'swim') return `${fmtTime(Math.round(sec / (legs.swim / 100)))} /100m`
  if (key === 'bike') return `${num(legs.bike / 1000 / (sec / 3600), 1)} km/h`
  if (key === 'run') return fmtPace(sec, legs.run)
  return null
}
