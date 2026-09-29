import clsx from 'clsx'
import { Check, ChevronRight, Dumbbell, Plus, Trash2, Trophy, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useCreateExercise, useDeleteRow, useExerciseLogs, useExercises, useSaveExerciseLog, useSaveRow } from '../../lib/api'
import type { Exercise, ExerciseLog } from '../../lib/database.types'
import { addDays, diffDays, fmtDMY, fmtShort, today, type ISODate } from '../../lib/dates'
import { num, signed } from '../../lib/format'
import { fmtSet, isBodyweight, MUSCLE_GROUPS, oneRM, prIds, score } from '../../lib/progress'
import { TrendChart } from '../Charts'
import { Button, DateInput, ErrorNote, Field, Hero, NumberInput, QuickAction, QuickActions, Select, Sheet, Stat, TextInput, Widget } from '../ui'

type Group = (typeof MUSCLE_GROUPS)[number]['value']

function ago(date: ISODate, t: ISODate): string {
  const d = diffDays(t, date)
  return d === 0 ? 'σήμερα' : d === 1 ? 'χθες' : `πριν ${d} μέρες`
}

export function StrengthTab(props: { tabs: ReactNode }) {
  const exercises = useExercises()
  const logsQ = useExerciseLogs()
  const list = exercises.data ?? []
  const logs = logsQ.data ?? []
  const t = today()
  const [filter, setFilter] = useState<Group | 'all'>('all')
  const [open, setOpen] = useState<{ exercise?: Exercise; group?: Group } | null>(null)

  const logsOf = (id: string) => logs.filter((l) => l.exercise_id === id)
  const groupOf = new Map(list.map((e) => [e.id, e.muscle_group]))

  const prs30 = list.reduce((n, e) => {
    const ids = prIds(logsOf(e.id))
    return n + logsOf(e.id).filter((l) => ids.has(l.id) && l.date > addDays(t, -30)).length
  }, 0)
  const week = logs.filter((l) => l.date > addDays(t, -7))
  const setsByGroup = new Map<string, number>()
  for (const l of week) {
    const g = groupOf.get(l.exercise_id)
    if (g) setsByGroup.set(g, (setsByGroup.get(g) ?? 0) + (l.sets ?? 1))
  }

  const groups = MUSCLE_GROUPS.filter((g) => list.some((e) => e.muscle_group === g.value))
  const shown = groups.filter((g) => filter === 'all' || g.value === filter)

  return (
    <div className="space-y-3">
      <Hero
        top={props.tabs}
        label="PRs · ΤΕΛΕΥΤΑΙΕΣ 30 ΜΕΡΕΣ"
        value={prs30}
        sub={
          <>
            {list.length} ασκήσεις · {week.length} καταγραφές τις τελευταίες 7 μέρες
          </>
        }
      >
        <QuickActions>
          <QuickAction
            icon={<Plus size={20} />}
            label="Άσκηση"
            onClick={() => setOpen({ group: filter === 'all' ? undefined : filter })}
          />
        </QuickActions>
      </Hero>

      <ErrorNote error={exercises.error ?? logsQ.error} />

      {groups.length > 1 && (
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {[{ value: 'all' as const, label: 'Όλα' }, ...groups].map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setFilter(g.value)}
              className={clsx(
                'h-9 shrink-0 rounded-full px-4 text-sm font-semibold transition active:scale-95',
                filter === g.value ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-text',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {week.length > 0 && filter === 'all' && (
        <Widget title="Σετ ανά μυϊκή ομάδα · 7 μέρες" icon={<Dumbbell size={16} />}>
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.filter((g) => setsByGroup.has(g.value)).map((g) => (
              <span key={g.value} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold">
                {g.label} <span className="text-accent">{setsByGroup.get(g.value)}</span>
              </span>
            ))}
          </div>
        </Widget>
      )}

      {!exercises.isLoading && list.length === 0 && (
        <p className="py-8 text-center text-sm text-muted">Πρόσθεσε την πρώτη σου άσκηση με το «Άσκηση».</p>
      )}

      {shown.map((g) => {
        const items = list.filter((e) => e.muscle_group === g.value)
        const last = logs.filter((l) => groupOf.get(l.exercise_id) === g.value).at(-1)
        return (
          <Widget key={g.value} title={g.label} action={last && <span className="text-xs text-muted">{ago(last.date, t)}</span>}>
            <ul className="-mx-2">
              {items.map((e) => (
                <ExerciseRow key={e.id} exercise={e} logs={logsOf(e.id)} onClick={() => setOpen({ exercise: e })} />
              ))}
            </ul>
          </Widget>
        )
      })}

      {open && (
        <ExerciseSheet exercise={open.exercise} group={open.group} allLogs={logs} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function ExerciseRow(props: { exercise: Exercise; logs: ExerciseLog[]; onClick: () => void }) {
  const { logs } = props
  const bw = isBodyweight(logs)
  const last = logs.at(-1)
  const prev = logs.at(-2)
  const best = logs.reduce<ExerciseLog | null>((b, l) => (!b || score(l, bw) > score(b, bw) ? l : b), null)
  const delta = last && prev ? score(last, bw) - score(prev, bw) : null
  return (
    <li>
      <button
        type="button"
        onClick={props.onClick}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2 active:scale-[0.99]"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{props.exercise.name}</div>
          <div className="truncate text-xs text-muted">
            {best ? `PR ${bw ? `${best.reps} επ.` : `${num(best.weight, 2)} kg`} · ${fmtDMY(best.date)}` : 'Χωρίς καταγραφές'}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold">{last ? fmtSet(last) : '—'}</div>
          {delta != null && (
            <div className={clsx('text-xs font-semibold', delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-muted')}>
              {delta === 0 ? '=' : `${signed(delta, 2)} ${bw ? 'επ.' : 'kg'}`}
            </div>
          )}
        </div>
        <ChevronRight size={16} className="shrink-0 text-muted" />
      </button>
    </li>
  )
}

type Form = { date: ISODate; weight: number | null; reps: number | null; sets: number | null; notes: string }

function ExerciseSheet(props: { exercise?: Exercise; group?: Group; allLogs: ExerciseLog[]; onClose: () => void }) {
  const create = useCreateExercise()
  const saveLog = useSaveExerciseLog()
  const delLog = useDeleteRow('exercise_logs')
  const saveEx = useSaveRow('exercises')
  const delEx = useDeleteRow('exercises')

  const [ex, setEx] = useState(props.exercise)
  const [name, setName] = useState(props.exercise?.name ?? '')
  const [group, setGroup] = useState<Group>((props.exercise?.muscle_group as Group) ?? props.group ?? 'chest')
  const logs = ex ? props.allLogs.filter((l) => l.exercise_id === ex.id) : []
  const last = logs.at(-1)
  const [form, setForm] = useState<Form>({
    date: today(),
    weight: last?.weight ?? null,
    reps: last?.reps ?? null,
    sets: last?.sets ?? null,
    notes: '',
  })
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (v: Partial<Form>) => {
    setForm((f) => ({ ...f, ...v }))
    setSaved(false)
  }

  const bw = isBodyweight(logs)
  const prs = prIds(logs)
  const best = logs.reduce<ExerciseLog | null>((b, l) => (!b || score(l, bw) > score(b, bw) ? l : b), null)
  const rms = logs.map(oneRM).filter((v): v is number => v != null)
  const bestRM = rms.length ? Math.max(...rms) : null
  const first = logs[0]
  const existing = logs.find((l) => l.date === form.date)
  const hasValues = form.weight != null || form.reps != null
  const busy = create.isPending || saveLog.isPending

  const nameTaken = (e: unknown) =>
    e instanceof Error && e.message.includes('exercises_user_id_name_key') ? 'Υπάρχει ήδη άσκηση με αυτό το όνομα.' : e
  const error = nameTaken(create.error ?? saveEx.error) || saveLog.error || delLog.error || delEx.error

  const submit = async () => {
    let target = ex
    if (!target) {
      const created = await create.mutateAsync({ name: name.trim(), muscle_group: group })
      if (!created) return
      target = created
      setEx(created)
    }
    if (hasValues) {
      await saveLog.mutateAsync({
        exercise_id: target.id,
        date: form.date,
        weight: form.weight,
        reps: form.reps == null ? null : Math.round(form.reps),
        sets: form.sets == null ? null : Math.round(form.sets),
        notes: form.notes.trim() || null,
      })
    }
    setSaved(true)
  }

  const chartData = logs.map((l) => ({
    label: fmtShort(l.date),
    weight: l.weight || null,
    orm: oneRM(l) == null ? null : +oneRM(l)!.toFixed(1),
    reps: l.reps,
  }))

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={ex ? ex.name : 'Νέα άσκηση'}
      footer={
        <Button
          className="w-full"
          disabled={busy || (!ex && !name.trim()) || (!!ex && !hasValues) || !form.date}
          onClick={() => submit().catch(() => {})}
        >
          {saved ? (
            <>
              <Check size={16} /> Αποθηκεύτηκε
            </>
          ) : !ex ? (
            hasValues ? 'Δημιουργία & καταγραφή' : 'Δημιουργία'
          ) : existing ? (
            `Ενημέρωση ${fmtDMY(form.date)}`
          ) : (
            `Καταγραφή ${fmtDMY(form.date)}`
          )}
        </Button>
      }
    >
      <ErrorNote error={error} />

      {!ex && (
        <div className="mb-2 space-y-2">
          <TextInput value={name} onChange={setName} placeholder="Όνομα (π.χ. Bench press)" />
          <Field label="Μυϊκή ομάδα">
            <Select value={group} onChange={setGroup} options={[...MUSCLE_GROUPS]} />
          </Field>
        </div>
      )}

      <div className="rounded-2xl bg-surface-2/60 px-3">
        <Field label="Ημερομηνία" hint={existing ? 'Υπάρχει ήδη καταγραφή — θα ενημερωθεί' : undefined}>
          <DateInput value={form.date} onChange={(date) => set({ date })} />
        </Field>
        <Field label="Βάρος" hint="Κενό = σωματικό βάρος">
          <NumberInput value={form.weight} step={2.5} onChange={(weight) => set({ weight })} unit="kg" />
        </Field>
        <Field label="Επαναλήψεις">
          <NumberInput value={form.reps} integer step={1} min={1} onChange={(reps) => set({ reps })} />
        </Field>
        <Field label="Σετ">
          <NumberInput value={form.sets} integer step={1} min={1} onChange={(sets) => set({ sets })} />
        </Field>
        <div className="py-3">
          <TextInput value={form.notes} onChange={(notes) => set({ notes })} placeholder="Σημείωση (προαιρετικό)" />
        </div>
      </div>

      {logs.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="PR" value={best ? (bw ? `${best.reps}` : num(best.weight, 2)) : '—'} unit={bw ? 'επ.' : 'kg'} />
            {!bw && <Stat label="Εκτ. 1RM" value={num(bestRM, 1)} unit="kg" />}
            {first && logs.length > 1 && (
              <Stat
                label={`Από ${fmtShort(first.date)}`}
                value={signed(score(last!, bw) - score(first, bw), 2)}
                unit={bw ? 'επ.' : 'kg'}
                tone={score(last!, bw) > score(first, bw) ? 'good' : undefined}
              />
            )}
          </div>

          {logs.length > 1 && (
            <div className="mt-4">
              <TrendChart
                data={chartData}
                x="label"
                height={170}
                series={
                  bw
                    ? [{ key: 'reps', label: 'Επαναλήψεις', color: 'var(--series-1)' }]
                    : [
                        { key: 'weight', label: 'Βάρος', color: 'var(--series-1)', digits: 2, unit: 'kg' },
                        { key: 'orm', label: 'Εκτ. 1RM', color: 'var(--series-2)', digits: 1, unit: 'kg' },
                      ]
                }
              />
            </div>
          )}

          <h4 className="mt-5 mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Ιστορικό</h4>
          <ul className="divide-y divide-line">
            {[...logs].reverse().map((l) => (
              <li key={l.id} className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() =>
                    set({ date: l.date, weight: l.weight, reps: l.reps, sets: l.sets, notes: l.notes ?? '' })
                  }
                  className={clsx(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-surface-2',
                    l.date === form.date && 'bg-accent-soft',
                  )}
                >
                  <span className="w-20 shrink-0 text-xs text-muted">{fmtDMY(l.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{fmtSet(l)}</span>
                    {l.notes && <span className="block truncate text-xs text-muted">{l.notes}</span>}
                  </span>
                  {prs.has(l.id) && <Trophy size={14} className="shrink-0 text-warn" aria-label="PR" />}
                  {oneRM(l) != null && <span className="shrink-0 text-xs text-muted">1RM {num(oneRM(l), 0)}</span>}
                </button>
                <button
                  type="button"
                  aria-label="Διαγραφή καταγραφής"
                  onClick={() => delLog.mutate(l.id)}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-bad active:scale-90"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {ex && (
        <details className="mt-5 rounded-2xl bg-surface-2/60 px-3 py-2">
          <summary className="py-1 text-sm font-semibold text-muted">Ρυθμίσεις άσκησης</summary>
          <div className="space-y-2 py-2">
            <TextInput value={name} onChange={setName} placeholder="Όνομα" />
            <Field label="Μυϊκή ομάδα">
              <Select value={group} onChange={setGroup} options={[...MUSCLE_GROUPS]} />
            </Field>
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => (confirmDelete ? delEx.mutate(ex.id, { onSuccess: props.onClose }) : setConfirmDelete(true))}
              >
                <Trash2 size={16} />
                {confirmDelete && `Διαγραφή μαζί με ${logs.length} καταγραφές;`}
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                disabled={!name.trim() || saveEx.isPending || (name.trim() === ex.name && group === ex.muscle_group)}
                onClick={() =>
                  saveEx.mutate(
                    { id: ex.id, name: name.trim(), muscle_group: group },
                    { onSuccess: () => setEx({ ...ex, name: name.trim(), muscle_group: group }) },
                  )
                }
              >
                Αποθήκευση
              </Button>
            </div>
          </div>
        </details>
      )}
    </Sheet>
  )
}
