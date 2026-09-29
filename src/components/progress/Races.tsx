import clsx from 'clsx'
import { CalendarClock, Medal, Plus, Trophy, Waves } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useDistanceEfforts, usePbDistances } from '../../lib/api'
import type { DistanceEffort, PbDistance } from '../../lib/database.types'
import { diffDays, fmtDMY, today } from '../../lib/dates'
import {
  bestEffort,
  countdown,
  fmtLegs,
  fmtPace,
  fmtTime,
  fmtTimeDelta,
  isUpcoming,
  legsOf,
  pbIds,
  predict,
  SPLITS,
  splitsOf,
} from '../../lib/progress'
import { ErrorNote, Hero, QuickAction, QuickActions, Stat, Widget } from '../ui'
import { DefaultDistances } from './Distances'
import { RaceSheet, SplitsLine } from './RaceSheet'

export function RacesTab(props: { tabs: ReactNode }) {
  const distancesQ = usePbDistances()
  const effortsQ = useDistanceEfforts()
  const distances = distancesQ.data ?? []
  const efforts = effortsQ.data ?? []
  const t = today()
  const [open, setOpen] = useState<{ race?: DistanceEffort } | null>(null)

  const dist = new Map(distances.map((d) => [d.id, d]))
  const races = efforts.filter((e) => e.is_race)
  const upcoming = races.filter((e) => isUpcoming(e, t))
  const done = races.filter((e) => !isUpcoming(e, t)).reverse()
  const next = upcoming.find((e) => e.date >= t)
  const nextDist = next && dist.get(next.distance_id)
  const pbSet = new Set(distances.flatMap((d) => [...pbIds(efforts.filter((e) => e.distance_id === d.id))]))
  const triFormats = distances.filter((d) => d.sport === 'triathlon')
  const distLabel = (d: PbDistance) => (d.sport === 'triathlon' ? `Τρίαθλο ${d.name}` : d.name)

  return (
    <div className="space-y-3">
      <Hero
        top={props.tabs}
        label={next ? `ΕΠΟΜΕΝΟΣ ΑΓΩΝΑΣ · ${next.race_name || nextDist?.name}` : 'ΑΓΩΝΕΣ'}
        value={next ? (next.date === t ? 'Σήμερα' : diffDays(next.date, t)) : done.length}
        unit={next ? (next.date === t ? undefined : 'μέρες') : 'ολοκληρωμένοι'}
        sub={
          next &&
          nextDist && (
            <>
              {fmtDMY(next.date)} · {distLabel(nextDist)}
              {next.goal_sec != null && (
                <>
                  {' '}
                  · στόχος <b className="text-text">{fmtTime(next.goal_sec)}</b>
                  {nextDist.sport === 'run' && <> ({fmtPace(next.goal_sec, nextDist.meters)})</>}
                </>
              )}
            </>
          )
        }
      >
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Αγώνας" onClick={() => setOpen({})} />
        </QuickActions>
      </Hero>

      <ErrorNote error={distancesQ.error ?? effortsQ.error} />
      {!distancesQ.isLoading && distances.length === 0 && <DefaultDistances />}

      {upcoming.length > 0 && (
        <Widget title="Επερχόμενοι" icon={<CalendarClock size={16} />}>
          <ul className="-mx-2 space-y-1">
            {upcoming.map((r) => {
              const d = dist.get(r.distance_id)
              if (!d) return null
              const onDist = efforts.filter((e) => e.distance_id === d.id && e.date <= t)
              const pb = bestEffort(onDist)
              const pred = predict(d, distances, efforts, t)
              const needsTime = r.date < t
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpen({ race: r })}
                    className="w-full rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2 active:scale-[0.99]"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.race_name || d.name}</span>
                      <span className={clsx('shrink-0 text-xs font-semibold', needsTime ? 'text-warn' : 'text-accent')}>
                        {needsTime ? 'Πρόσθεσε χρόνο' : countdown(r.date, t)}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {fmtDMY(r.date)} · {distLabel(d)}
                      {legsOf(d) && <> · {fmtLegs(legsOf(d)!)}</>}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Stat
                        label="Στόχος"
                        value={
                          <span className="tabular-nums">
                            {fmtTime(r.goal_sec)}
                            {/* Average pace needed to hit the goal (running only; a triathlon goal is a total). */}
                            {r.goal_sec != null && d.sport === 'run' && (
                              <span className="block text-xs font-semibold text-accent">{fmtPace(r.goal_sec, d.meters)}</span>
                            )}
                          </span>
                        }
                      />
                      <Stat label="PB" value={<span className="tabular-nums">{fmtTime(pb?.time_sec)}</span>} />
                      {d.sport === 'run' && (
                        <Stat
                          label="Πρόβλεψη"
                          value={<span className="tabular-nums">{fmtTime(pred?.sec)}</span>}
                          tone={pred && r.goal_sec ? (pred.sec <= r.goal_sec ? 'good' : 'warn') : undefined}
                        />
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Widget>
      )}

      {done.length > 0 && (
        <Widget title="Ολοκληρωμένοι" icon={<Medal size={16} />}>
          <ul className="-mx-2 divide-y divide-line">
            {done.map((r) => {
              const d = dist.get(r.distance_id)
              if (!d) return null
              const vsGoal = r.goal_sec != null && r.time_sec != null ? r.time_sec - r.goal_sec : null
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setOpen({ race: r })}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2 active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <span className="truncate">{r.race_name || d.name}</span>
                        {pbSet.has(r.id) && <Trophy size={14} className="shrink-0 text-warn" aria-label="PB" />}
                      </div>
                      <div className="text-xs text-muted">
                        {fmtDMY(r.date)} · {distLabel(d)}
                      </div>
                      {d.sport === 'triathlon' && <SplitsLine splits={splitsOf(r)} />}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold tabular-nums">{fmtTime(r.time_sec)}</div>
                      <div className="text-xs text-muted">
                        {d.sport === 'run' && fmtPace(r.time_sec, d.meters)}
                        {vsGoal != null && (
                          <span className={clsx('ml-1.5 font-semibold', vsGoal <= 0 ? 'text-good' : 'text-bad')}>
                            {fmtTimeDelta(vsGoal)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Widget>
      )}

      {triFormats.some((d) => bestEffort(efforts.filter((e) => e.distance_id === d.id))) && (
        <Widget title="Τρίαθλο · PBs" icon={<Waves size={16} />}>
          <ul className="divide-y divide-line">
            {triFormats.map((d) => {
              const list = efforts.filter((e) => e.distance_id === d.id)
              const best = bestEffort(list)
              if (!best) return null
              // Fastest of each split across all races on this format.
              const bestSplit = (k: (typeof SPLITS)[number]['key']) => {
                const v = list.map((e) => splitsOf(e)[k]).filter((x): x is number => x != null)
                return v.length ? Math.min(...v) : null
              }
              return (
                <li key={d.id} className="py-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 text-sm font-semibold">{d.name}</span>
                    <span className="text-lg font-bold tabular-nums">{fmtTime(best.time_sec)}</span>
                  </div>
                  <div className="text-xs text-muted">
                    {legsOf(d) && fmtLegs(legsOf(d)!)} · {fmtDMY(best.date)}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {SPLITS.map((x) => (
                      <span key={x.key} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold">
                        <span className="text-muted">{x.label}</span>{' '}
                        <span className="tabular-nums">{fmtTime(bestSplit(x.key))}</span>
                      </span>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-muted">Τα split είναι τα καλύτερα σου σε κάθε σκέλος, από οποιονδήποτε αγώνα του format.</p>
        </Widget>
      )}

      {!effortsQ.isLoading && races.length === 0 && distances.length > 0 && (
        <p className="py-8 text-center text-sm text-muted">Πρόσθεσε τον επόμενο (ή έναν παλιό) αγώνα σου με το «Αγώνας».</p>
      )}

      {open && (
        <RaceSheet race={open.race} distances={distances} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}
