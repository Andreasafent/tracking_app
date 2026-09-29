import clsx from 'clsx'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Button, DateInput, ErrorNote, Field, Hero, NumberInput, QuickAction, QuickActions, Sheet, Stat, TextInput, Widget } from '../components/ui'
import { useDeleteRow, useSaveRow, useSummaries, useTrainingPlans } from '../lib/api'
import type { Json, TrainingPlan } from '../lib/database.types'
import { addDays, diffDays, eachDay, fmtDayDMY, fmtRangeDMY, today, type ISODate } from '../lib/dates'
import { num, signed } from '../lib/format'
import { daysOf, type TrainingDay } from '../lib/training'

type Day = TrainingDay

const MAX_DAYS = 62

const summary = (d: Day) => d.exercises.filter(Boolean).join(' + ')

/** Average of the days that have a calorie target. */
function avgKcal(days: Day[]): number | null {
  const v = days.map((d) => d.kcal).filter((k): k is number => k != null)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/** One entry per date in the range, keeping what was already filled in for those dates. */
function fitDays(from: ISODate, to: ISODate, prev: Day[]): Day[] {
  const byDate = new Map(prev.map((d) => [d.date, d]))
  return eachDay(from, to).map((date) => byDate.get(date) ?? { date, exercises: [], kcal: null })
}

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

  const newPlan = (copyFrom?: TrainingPlan) => {
    const start = latest && latest.end_date >= t ? addDays(latest.end_date, 1) : t
    const len = copyFrom ? diffDays(copyFrom.end_date, copyFrom.start_date) : 6
    const end = addDays(start, len)
    const src = copyFrom ? daysOf(copyFrom) : []
    setEditing({
      label: '',
      start_date: start,
      end_date: end,
      days: eachDay(start, end).map((date, i) => ({ date, exercises: [...(src[i]?.exercises ?? [])], kcal: src[i]?.kcal ?? null })),
    })
  }

  return (
    <div className="space-y-3">
      <Hero
        label={current ? `Μ.Ο. ΘΕΡΜΙΔΩΝ · ${current.label || fmtRangeDMY({ from: current.start_date, to: current.end_date })}` : 'ΚΑΝΕΝΑ ΕΝΕΡΓΟ ΠΛΑΝΟ'}
        value={current ? num(avgKcal(currentDays), 0) : '—'}
        unit={current ? 'kcal' : undefined}
        sub={
          todayPlan && (
            <>
              Σήμερα: {summary(todayPlan) || 'ξεκούραση'}
              {todayPlan.kcal != null && <> · {num(todayPlan.kcal, 0)} kcal</>}
            </>
          )
        }
      >
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Νέο πλάνο" onClick={() => newPlan()} />
          {latest && <QuickAction icon={<Copy size={20} />} label="Αντιγραφή" onClick={() => newPlan(latest)} />}
        </QuickActions>
      </Hero>

      <ErrorNote error={plans.error ?? summaries.error} />

      {!plans.isLoading && list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Φτιάξε το πρώτο σου εβδομαδιαίο πλάνο με το «Νέο πλάνο».</p>
      )}

      {shown.map((p) => {
        const days = daysOf(p)
        const status = p.end_date < t ? 'done' : p.start_date > t ? 'future' : 'current'
        const planned = avgKcal(days)
        const eaten = days
          .filter((d) => d.date <= t)
          .map((d) => kcalByDate.get(d.date))
          .filter((k): k is number => k != null && k > 0)
        const eatenAvg = eaten.length ? eaten.reduce((a, b) => a + b, 0) / eaten.length : null
        return (
          <Widget
            key={p.id}
            title={p.label || fmtRangeDMY({ from: p.start_date, to: p.end_date })}
            onClick={() => setEditing({ ...p, label: p.label ?? '', days })}
            className={clsx(status === 'current' && 'ring-2 ring-accent', status === 'done' && 'opacity-70')}
            action={
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  status === 'current' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                )}
              >
                {status === 'current' ? 'Τρέχον' : status === 'done' ? 'Ολοκληρώθηκε' : 'Μελλοντικό'}
              </span>
            }
          >
            {p.label && <div className="-mt-2 mb-3 text-xs text-muted">{fmtRangeDMY({ from: p.start_date, to: p.end_date })}</div>}
            <ul className="divide-y divide-line">
              {days.map((d) => (
                <li key={d.date} className={clsx('flex items-start gap-3 py-2 text-sm', d.date === t && 'font-semibold')}>
                  <span className={clsx('w-28 shrink-0 pt-0.5 text-xs', d.date === t ? 'text-accent' : 'text-muted')}>{fmtDayDMY(d.date)}</span>
                  {d.exercises.some(Boolean) ? (
                    <ul className="min-w-0 flex-1">
                      {d.exercises.filter(Boolean).map((e, j) => (
                        <li key={j} className="truncate">
                          {e}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="min-w-0 flex-1 text-muted">—</span>
                  )}
                  <span className="shrink-0 tabular-nums">{d.kcal == null ? '—' : num(d.kcal, 0)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
              <Stat label="Μ.Ο. στόχος" value={num(planned, 0)} unit="kcal" />
              <Stat
                label="Μ.Ο. φαγητό"
                value={num(eatenAvg, 0)}
                unit={eatenAvg == null ? undefined : 'kcal'}
                tone={eatenAvg == null || planned == null ? undefined : eatenAvg <= planned ? 'good' : 'bad'}
              />
              <Stat label="Διαφορά" value={eatenAvg == null || planned == null ? '—' : signed(eatenAvg - planned, 0)} />
            </div>
          </Widget>
        )
      })}

      {editing && <PlanSheet plan={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

type Draft = { id?: string; label: string; start_date: ISODate; end_date: ISODate; days: Day[] }

function PlanSheet(props: { plan: Draft; onClose: () => void }) {
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
            <b className="text-lg">{avg == null ? '—' : `${num(avg, 0)} kcal`}</b>
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
          <div key={d.date} className="rounded-2xl bg-surface-2/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex-1 text-xs font-semibold tracking-wide text-muted uppercase">{fmtDayDMY(d.date)}</span>
              <NumberInput value={d.kcal} integer step={50} onChange={(v) => setDay(i, { kcal: v == null ? null : Math.round(v) })} unit="kcal" />
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
                    className="h-10 min-w-0 flex-1 rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent"
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
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-accent transition hover:bg-accent-soft active:scale-95"
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
