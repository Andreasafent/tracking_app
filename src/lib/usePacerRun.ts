import { useCallback, useEffect, useState } from 'react'
import { addLap, LAP_COUNT, undoLap, type Lap } from './pacer'

export type PacerState = {
  planId: string | null
  /** Epoch ms of the start press. The clock is always `now − startedAt`, so a locked phone loses nothing. */
  startedAt: number | null
  laps: Lap[]
  /** Seconds at the finish press (set with lap 43). */
  finished: number | null
  /** The finished run is stored in the database. */
  saved: boolean
}

const KEY = 'pacer-run'
const MIN_LAP_SEC = 20
const EMPTY: PacerState = { planId: null, startedAt: null, laps: [], finished: null, saved: false }

function load(): PacerState {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}

/** The race in progress, kept in localStorage so a reload or an evicted tab picks up where it was. */
export function usePacerRun() {
  const [state, setState] = useState<PacerState>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      // Private mode etc.: the race still runs, it just can't survive a reload.
    }
  }, [state])

  const start = useCallback((planId: string) => setState({ planId, startedAt: Date.now(), laps: [], finished: null, saved: false }), [])
  const lap = useCallback((km: number) => {
    setState((s) => {
      if (s.startedAt == null || s.finished != null) return s
      const t = (Date.now() - s.startedAt) / 1000
      // A double tap must not record two laps.
      const prev = s.laps.at(-1)
      if (prev && t - prev.t < MIN_LAP_SEC) return s
      const laps = addLap(s.laps, km, t)
      return laps === s.laps ? s : { ...s, laps, finished: km === LAP_COUNT ? t : null }
    })
  }, [])
  const undo = useCallback(() => setState((s) => ({ ...s, laps: undoLap(s.laps), finished: null })), [])
  const markSaved = useCallback(() => setState((s) => ({ ...s, saved: true })), [])
  const reset = useCallback(() => setState(EMPTY), [])
  return { state, start, lap, undo, reset, markSaved }
}

/** Seconds since `startedAt`, refreshed 4×/s and as soon as the page becomes visible again. */
export function useElapsed(startedAt: number | null, running: boolean) {
  const calc = () => (startedAt == null ? 0 : Math.max(0, (Date.now() - startedAt) / 1000))
  const [, tick] = useState(0)
  useEffect(() => {
    if (!running) return
    const refresh = () => tick((n) => n + 1)
    const id = setInterval(refresh, 250)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [running])
  return calc()
}

/** Keeps the screen on while `active` (and again after the page comes back to the foreground). Returns whether it holds. */
export function useWakeLock(active: boolean) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) return void lock.release()
        setHeld(true)
        lock.addEventListener('release', () => setHeld(false))
      } catch {
        setHeld(false)
      }
    }
    const onVisible = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
      setHeld(false)
    }
  }, [active])
  return held
}
