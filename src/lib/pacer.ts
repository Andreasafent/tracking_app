import type { PacerPlan } from './database.types'

// ─── Constants of the marathon pacer
export const MARATHON_KM = 42.195
/** 42 full kilometres plus the last 195 m. */
export const LAP_COUNT = 43
export const FINAL_KM = 0.195
export const SUB4_SEC = 4 * 3600
/** The scenario the lap check is measured against (the 3:52:30 one). */
export const MAIN = 1
/** "On pace" for a lap: ± seconds per km against the main scenario. */
export const LAP_TOL = 5
/** "On time" for the total: ± seconds against a scenario's cumulative time. */
export const TOTAL_TOL = 60
/** The correction for the next km is spread over this many km, and capped at ±this many s/km. */
export const CATCH_UP_KM = 3
export const MAX_ADJUST = 15

export type Scenario = { label: string; target_sec: number; laps: number[] }
export type Segment = { label: string; paces: number[] }
/** One recorded lap: `t` = seconds since the start. `est` = the lap was missed and interpolated. */
export type Lap = { km: number; t: number; est?: boolean }

export const scenariosOf = (p: PacerPlan) => p.scenarios as unknown as Scenario[]
export const segmentsOf = (p: PacerPlan) => p.segments as unknown as Segment[]
export const lapsOf = (laps: unknown) => laps as Lap[]

/** Length of lap number `km` (1-based): 1 km, except the last 195 m. */
export const lapDist = (km: number) => (km <= 42 ? 1 : FINAL_KM)
/** Distance covered after lap `km`. */
export const cumDist = (km: number) => (km <= 42 ? km : MARATHON_KM)

export function cumulative(laps: number[]): number[] {
  let t = 0
  return laps.map((s) => (t += s))
}

// ─── Formatting
const pad = (n: number) => String(n).padStart(2, '0')

/** h:mm:ss, or m:ss under an hour. */
export function fmtClock(sec: number): string {
  const s = Math.round(Math.abs(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}

/** Always h:mm:ss (the running clock). */
export function fmtFull(sec: number): string {
  const s = Math.floor(Math.max(0, sec))
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export const fmtPace = (secPerKm: number) => fmtClock(secPerKm)

/** "+0:12" / "−1:05"; zero shows as "0:00". */
export function fmtDelta(sec: number): string {
  const r = Math.round(sec)
  if (r === 0) return '0:00'
  return `${r > 0 ? '+' : '−'}${fmtClock(r)}`
}

// ─── The pacing maths

export type LapEval = {
  km: number
  lapSec: number
  /** Pace of this lap in s/km, and what the main scenario planned for it. */
  pace: number
  planned: number
  diff: number
  state: 'ok' | 'slow' | 'fast'
  /** Other scenarios whose pace for this km is within the tolerance (shown when off the main one). */
  alsoIn: string[]
  elapsed: number
  /** elapsed − each scenario's cumulative time at this km (positive = behind). */
  deltas: number[]
  totalState: 'ok' | 'behind' | 'ahead'
  /** Scenarios whose cumulative time is within the tolerance. */
  within: string[]
  avgPace: number
  sub4: {
    /** elapsed − the constant-pace sub-4 line (positive = behind). */
    delta: number
    onTrack: boolean
    /** Average pace needed over the rest to finish under 4:00:00. */
    requiredPace: number | null
    /** Finish time if the rest follows the main scenario. */
    projected: number
  }
  next: { km: number; planned: number; advised: number; lapTarget: number; verb: 'faster' | 'slower' | 'hold' } | null
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Evaluates the lap just recorded (the last of `laps`) against the plan. */
export function evaluateLap(laps: Lap[], scenarios: Scenario[]): LapEval | null {
  const last = laps.at(-1)
  if (!last || scenarios.length === 0) return null
  const main = scenarios[Math.min(MAIN, scenarios.length - 1)]
  const km = last.km
  const prevT = laps.at(-2)?.t ?? 0
  const lapSec = last.t - prevT
  const dist = lapDist(km)
  const pace = lapSec / dist
  const planned = main.laps[km - 1] / dist
  const diff = pace - planned
  const state = Math.abs(diff) <= LAP_TOL ? 'ok' : diff > 0 ? 'slow' : 'fast'
  const alsoIn = scenarios
    .filter((s) => s !== main && Math.abs(pace - s.laps[km - 1] / dist) <= LAP_TOL)
    .map((s) => s.label)

  const cums = scenarios.map((s) => cumulative(s.laps))
  const deltas = cums.map((c) => last.t - c[km - 1])
  const mainIdx = scenarios.indexOf(main)
  const dMain = deltas[mainIdx]
  const totalState = Math.abs(dMain) <= TOTAL_TOL ? 'ok' : dMain > 0 ? 'behind' : 'ahead'
  const within = scenarios.filter((_, i) => Math.abs(deltas[i]) <= TOTAL_TOL).map((s) => s.label)

  const covered = cumDist(km)
  const limit = (covered * SUB4_SEC) / MARATHON_KM
  const remaining = MARATHON_KM - covered
  const mainCum = cums[mainIdx]
  const sub4 = {
    delta: last.t - limit,
    onTrack: last.t <= limit,
    requiredPace: remaining > 0.001 ? (SUB4_SEC - last.t) / remaining : null,
    projected: last.t + (mainCum[mainCum.length - 1] - mainCum[km - 1]),
  }

  let next: LapEval['next'] = null
  if (km < LAP_COUNT) {
    const nd = lapDist(km + 1)
    const nPlanned = main.laps[km] / nd
    const advised = nPlanned - clamp(dMain / CATCH_UP_KM, -MAX_ADJUST, MAX_ADJUST)
    const gap = advised - nPlanned
    next = {
      km: km + 1,
      planned: nPlanned,
      advised,
      lapTarget: advised * nd,
      verb: gap < -2 ? 'faster' : gap > 2 ? 'slower' : 'hold',
    }
  }

  return { km, lapSec, pace, planned, diff, state, alsoIn, elapsed: last.t, deltas, totalState, within, avgPace: last.t / covered, sub4, next }
}

/** Adds a lap for `km` at time `t`; kilometres skipped before it are filled in evenly and flagged as estimates. */
export function addLap(laps: Lap[], km: number, t: number): Lap[] {
  const last = laps.at(-1) ?? { km: 0, t: 0 }
  if (km <= last.km || km > LAP_COUNT) return laps
  const out = [...laps]
  const span = km - last.km
  for (let k = last.km + 1; k < km; k++) out.push({ km: k, t: last.t + ((t - last.t) * (k - last.km)) / span, est: true })
  out.push({ km, t })
  return out
}

/** Removes the last real lap together with the estimated ones recorded just before it. */
export function undoLap(laps: Lap[]): Lap[] {
  const out = [...laps]
  out.pop()
  while (out.at(-1)?.est) out.pop()
  return out
}
