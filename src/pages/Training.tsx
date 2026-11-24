import clsx from 'clsx'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { ErrorNote, Sheet, Button, TextInput, Field, DateInput, NumberInput } from '../components/ui'
import { useSummaries, useTrainingPlans, useSaveRow, useDeleteRow } from '../lib/api'
import type { TrainingPlan, Json } from '../lib/database.types'
import { addDays, diffDays, eachDay, fmtDayDM, fmtRangeDMY, today, type ISODate, fmtDayDMY } from '../lib/dates'
import { num, signed } from '../lib/format'
import { daysOf, type TrainingDay } from '../lib/training'
import '../styles/pages.css'

/** TRAINING PLAN: the weekly plans (exercises and a calorie target per day) against what was eaten. */
export function Training() {
  const plans = useTrainingPlans()
  const list = plans.data ?? [] // oldest first
  const t = today()
  const latest = list[list.length - 1]
  // Current and upcoming plans first (soonest on top), then past ones (most recent first).
  const shown = [...list.filter((p) => p.end_date >= t), ...list.filter((p) => p.end_date < t).reverse()]
  const [editing, setEditing] = useState<Draft | null>(null)

  const current = list.find((p) => p.start_date <= t && p.end_date >= t)
  const currentDays = current ? daysOf(current) : []
  const todayPlan = currentDays.find((d) => d.date === t)

  // Actual intake for the plans shown, to compare against the planned average.
  const oldest = list[0]?.start_date ?? t
  const summaries = useSummaries(oldest, t)
  const kcalByDate = new Map((summaries.data ?? []).map((r) => [r.date!, r.kcal]))

  /** Average of what was actually logged on the plan's days up to today (days with no meals don't count). */
  const eatenAvgOf = (days: { date: string }[]) => {
    const eaten = days
      .filter((d) => d.date <= t)
      .map((d) => kcalByDate.get(d.date))
      .filter((k): k is number => k != null && k > 0)
    return eaten.length ? eaten.reduce((a, b) => a + b, 0) / eaten.length : null
  }
  const currentPlanned = avgKcal(currentDays)
  const currentEaten = eatenAvgOf(currentDays)

  const newPlan = (copyFrom?: TrainingPlan) => {
    const start = latest && latest.end_date >= t ? addDays(latest.end_date, 1) : t
    const len = copyFrom ? diffDays(copyFrom.end_date, copyFrom.start_date) : 6
    const end = addDays(start, len)
    const src = copyFrom ? daysOf(copyFrom) : []
    setEditing({
      label: '',
      start_date: start,
      end_date: end,
      days: eachDay(start, end).map((date, i) => ({
        date,
        exercises: [...(src[i]?.exercises ?? [])],
        kcal: src[i]?.kcal ?? null,
        protein: src[i]?.protein ?? null,
        carbs: src[i]?.carbs ?? null,
        fat: src[i]?.fat ?? null,
      })),
    })
  }

  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">Προπόνηση</h2>
          <div className="da-date">{list.length ? `${list.length} ${list.length === 1 ? 'πλάνο' : 'πλάνα'}` : 'κανένα πλάνο ακόμα'}</div>
        </div>
        <div className="da-nav">
          {latest && (
            <button type="button" aria-label="Αντιγραφή τελευταίου πλάνου" title="Αντιγραφή τελευταίου πλάνου" onClick={() => newPlan(latest)}>
              <Copy size={17} />
            </button>
          )}
          <button type="button" className="da-pillbtn" aria-label="Νέο πλάνο" title="Νέο πλάνο" onClick={() => newPlan()}>
            <Plus size={16} /> Νέο
          </button>
        </div>
      </header>

      <ErrorNote error={plans.error ?? summaries.error} />

      <div className="da-grid">
        <section className="da-card da-dark da-full">
          <div className="da-row">
            <span>{current ? `Μ.Ο. θερμίδων · ${current.label || fmtRangeDMY({ from: current.start_date, to: current.end_date })}` : 'Κανένα ενεργό πλάνο'}</span>
          </div>
          <div className="da-num da-hero">
            {current ? num(avgKcal(currentDays), 0) : '—'}
            {current && <small>kcal</small>}
          </div>
          {current && (
            <div className="ta-herostats">
              <div>
                <div className="da-num ta-hs">
                  {num(currentEaten, 0)}
                  {currentEaten != null && <small>kcal</small>}
                </div>
                <div className="da-caption">μ.ο. φαγητό</div>
              </div>
              <div>
                <div className={clsx('da-num ta-hs', currentEaten != null && currentPlanned != null && currentEaten > currentPlanned && 'over')}>
                  {currentEaten == null || currentPlanned == null ? '—' : signed(currentEaten - currentPlanned, 0)}
                </div>
                <div className="da-caption">διαφορά από τον στόχο</div>
              </div>
            </div>
          )}
          {todayPlan && (
            <div className="da-caption ta-todayline">
              Σήμερα · {summary(todayPlan) || 'ξεκούραση'}
              {todayPlan.kcal != null && <> · {num(todayPlan.kcal, 0)} kcal</>}
            </div>
          )}
        </section>

        {!plans.isLoading && list.length === 0 && (
          <p className="da-empty da-full">Φτιάξε το πρώτο σου εβδομαδιαίο πλάνο με το «Νέο πλάνο».</p>
        )}

        {shown.map((p) => {
          const days = daysOf(p)
          const status = p.end_date < t ? 'done' : p.start_date > t ? 'future' : 'current'
          const planned = avgKcal(days)
          const eatenAvg = eatenAvgOf(days)
          const open = () => setEditing({ ...p, label: p.label ?? '', days })
          return (
            <section
              key={p.id}
              className={clsx('da-card da-full da-click', status === 'done' && 'ta-done')}
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  open()
                }
              }}
            >
              <div className="ta-head">
                <div>
                  <h3>{p.label || fmtRangeDMY({ from: p.start_date, to: p.end_date })}</h3>
                  {p.label && <div className="da-dim">{fmtRangeDMY({ from: p.start_date, to: p.end_date })}</div>}
                </div>
                <span className={clsx('ta-status', status)}>
                  <i />
                  {status === 'current' ? 'Τρέχον' : status === 'done' ? 'Ολοκληρώθηκε' : 'Μελλοντικό'}
                </span>
              </div>

              <ul className="ta-days">
                {days.map((d) => {
                  const [wd, dm] = fmtDayDM(d.date)
                  return (
                    <li key={d.date} className={clsx('ta-day', d.date === t && 'today')}>
                      <span className="ta-date">
                        {wd}
                        <br />
                        {dm}
                      </span>
                      <div className="ta-mid">
                        {d.exercises.some(Boolean) ? (
                          <ul className="ta-ex">
                            {d.exercises.filter(Boolean).map((e, j) => (
                              <li key={j}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="ta-rest">ξεκούραση</span>
                        )}
                        {(d.protein != null || d.carbs != null || d.fat != null) && (
                          <span className="ta-macros">
                            Π {d.protein == null ? '—' : num(d.protein, 0)} · Υ {d.carbs == null ? '—' : num(d.carbs, 0)} · Λ{' '}
                            {d.fat == null ? '—' : num(d.fat, 0)}
                          </span>
                        )}
                      </div>
                      <span className="ta-kcal">{d.kcal == null ? '—' : num(d.kcal, 0)}</span>
                    </li>
                  )
                })}
              </ul>

              <div className="ta-stats">
                <div>
                  <div className="da-num da-stat">{num(planned, 0)}</div>
                  <div className="da-dim">μ.ο. στόχος</div>
                </div>
                <div>
                  <div
                    className={clsx('da-num da-stat', eatenAvg != null && planned != null && (eatenAvg <= planned ? 'ta-good' : 'ta-bad'))}
                  >
                    {num(eatenAvg, 0)}
                  </div>
                  <div className="da-dim">μ.ο. φαγητό</div>
                </div>
                <div>
                  <div className="da-num da-stat">{eatenAvg == null || planned == null ? '—' : signed(eatenAvg - planned, 0)}</div>
                  <div className="da-dim">διαφορά</div>
                </div>
              </div>
            </section>
          )
        })}
      </div>

      {editing && <PlanSheet plan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

type Day = TrainingDay

const MAX_DAYS = 62

export const summary = (d: Day) => d.exercises.filter(Boolean).join(' + ')

/** Average of the days that have a calorie target. */
export function avgKcal(days: Day[]): number | null {
  const v = days.map((d) => d.kcal).filter((k): k is number => k != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** One entry per date in the range, keeping what was already filled in for those dates. */
function fitDays(from: ISODate, to: ISODate, prev: Day[]): Day[] {
  const byDate = new Map(prev.map((d) => [d.date, d]))
  return eachDay(from, to).map((date) => byDate.get(date) ?? { date, exercises: [], kcal: null, protein: null, carbs: null, fat: null })
}

export type Draft = { id?: string; label: string; start_date: ISODate; end_date: ISODate; days: Day[] }

export function PlanSheet(props: { plan: Draft; onClose: () => void }) {
  const save = useSaveRow('training_plans')
  const del = useDeleteRow('training_plans')
  const [p, setP] = useState<Draft>(props.plan)

  const setRange = (start_date: ISODate, end_date: ISODate) =>
    setP({
      ...p,
      start_date,
      end_date,
      days: start_date && end_date && end_date >= start_date && diffDays(end_date, start_date) < MAX_DAYS
        ? fitDays(start_date, end_date, p.days)
        : p.days,
    })
  const setDay = (i: number, v: Partial<Day>) => setP({ ...p, days: p.days.map((d, j) => (j === i ? { ...d, ...v } : d)) })
  const setExercise = (i: number, k: number, v: string) =>
    setDay(i, { exercises: p.days[i].exercises.map((e, j) => (j === k ? v : e)) })

  const rangeOk = !!p.start_date && !!p.end_date && p.end_date >= p.start_date && diffDays(p.end_date, p.start_date) < MAX_DAYS
  const valid = rangeOk && p.days.length > 0 && p.days[0].date === p.start_date
  const avg = avgKcal(p.days)

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={p.id ? 'Επεξεργασία πλάνου' : 'Νέο πλάνο'}
      footer={
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Μ.Ο. θερμίδων</span>
            <b className="ui-avg text-lg">{avg == null ? '—' : `${num(avg, 0)} kcal`}</b>
          </div>
          <div className="flex gap-2">
            {p.id && (
              <Button variant="danger" onClick={() => del.mutate(p.id!, { onSuccess: props.onClose })}>
                <Trash2 size={16} />
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={!valid || save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    id: p.id,
                    label: p.label.trim() || null,
                    start_date: p.start_date,
                    end_date: p.end_date,
                    days: p.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => e.trim()).filter(Boolean) })) as unknown as Json,
                  },
                  { onSuccess: props.onClose },
                )
              }
            >
              Αποθήκευση
            </Button>
          </div>
        </div>
      }
    >
      <ErrorNote error={save.error ?? del.error} />
      {!rangeOk && p.start_date && p.end_date && (
        <ErrorNote error={`Η περίοδος πρέπει να είναι 1–${MAX_DAYS} μέρες.`} />
      )}
      <TextInput value={p.label} onChange={(v) => setP({ ...p, label: v })} placeholder="Όνομα (π.χ. Εβδομάδα 3)" />
      <Field label="Από">
        <DateInput value={p.start_date} onChange={(v) => setRange(v, p.end_date)} />
      </Field>
      <Field label="Έως">
        <DateInput value={p.end_date} onChange={(v) => setRange(p.start_date, v)} />
      </Field>

      <div className="mt-4 space-y-3">
        {p.days.map((d, i) => (
          <div key={d.date} className="ui-tile rounded-2xl bg-surface-2/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex-1 text-xs font-semibold tracking-wide text-muted uppercase">{fmtDayDMY(d.date)}</span>
              <NumberInput value={d.kcal} integer step={50} onChange={(v) => setDay(i, { kcal: v == null ? null : Math.round(v) })} unit="kcal" />
            </div>
            {/* Targets for this day; empty = the TARGETS period's value */}
            <div className="ui-macros mb-3 grid grid-cols-3 gap-2">
              {(
                [
                  ['protein', 'Πρωτεΐνη'],
                  ['carbs', 'Υδατάνθρ.'],
                  ['fat', 'Λιπαρά'],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="ui-macro">
                  <span className="ui-macro-label">{label}</span>
                  <NumberInput value={d[k]} integer onChange={(v) => setDay(i, { [k]: v == null ? null : Math.round(v) })} unit="g" />
                </label>
              ))}
            </div>
            <div className="space-y-2">
              {d.exercises.map((ex, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    value={ex}
                    autoFocus={ex === '' && k === d.exercises.length - 1 && k > 0}
                    placeholder="Άσκηση (π.χ. 10km easy)"
                    onChange={(e) => setExercise(i, k, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        setDay(i, { exercises: [...d.exercises, ''] })
                      }
                    }}
                    className="ui-ex h-10 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent"
                  />
                  <button
                    type="button"
                    aria-label="Αφαίρεση άσκησης"
                    onClick={() => setDay(i, { exercises: d.exercises.filter((_, j) => j !== k) })}
                    className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-bad active:scale-90"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setDay(i, { exercises: [...d.exercises, ''] })}
                className="ui-add flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent transition hover:bg-accent-soft active:scale-95"
              >
                <Plus size={16} />
                Άσκηση
              </button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
