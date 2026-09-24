import clsx from 'clsx'
import { Footprints, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { TrendChart } from '../components/Charts'
import { Bar, Button, ErrorNote, Field, Hero, NumberInput, QuickAction, QuickActions, Sheet, TextInput, Widget } from '../components/ui'
import { useDeleteRow, useRunPlan, useSaveRow, useSummaries } from '../lib/api'
import type { DailySummary, RunPlanWeek } from '../lib/database.types'
import { addDays, fmtRange, today } from '../lib/dates'
import { num } from '../lib/format'
import { countBool, inRange, sum } from '../lib/stats'

function actuals(rows: DailySummary[], w: RunPlanWeek) {
  const r = inRange(rows, { from: w.start_date, to: w.end_date })
  const longest = r.reduce((m, d) => Math.max(m, d.longest_run_km ?? 0), 0)
  return { km: sum(r, 'run_km'), longRun: longest, weights: countBool(r, 'did_weights') }
}

export function Running() {
  const plan = useRunPlan()
  const weeks = plan.data ?? []
  const t = today()
  const summaries = useSummaries(weeks[0]?.start_date ?? t, weeks[weeks.length - 1]?.end_date ?? t)
  const rows = summaries.data ?? []
  const [editing, setEditing] = useState<Partial<RunPlanWeek> | null>(null)

  const current = weeks.find((w) => w.start_date <= t && w.end_date >= t)
  const cur = current && actuals(rows, current)

  const chartData = weeks.map((w) => {
    const a = actuals(rows, w)
    return { label: `Ε${w.week_no}`, actual: w.start_date <= t ? a.km : null, target: w.target_km }
  })

  return (
    <div className="space-y-3">
      <Hero
        label={current ? `ΧΙΛΙΟΜΕΤΡΑ · ΕΒΔΟΜΑΔΑ ${current.week_no}` : 'ΧΙΛΙΟΜΕΤΡΑ ΕΒΔΟΜΑΔΑΣ'}
        value={cur ? num(cur.km, 1) : '—'}
        unit={current?.target_km != null ? `/ ${num(current.target_km, 1)} km` : 'km'}
        sub={
          current &&
          cur && (
            <>
              Long run <b className="text-text">{num(cur.longRun, 1)}</b> / {num(current.target_long_run, 1)} km · Βάρη{' '}
              <b className="text-text">{cur.weights}</b>/{current.target_weight_days ?? 0}
            </>
          )
        }
      >
        <QuickActions>
          <QuickAction
            icon={<Plus size={20} />}
            label="Εβδομάδα"
            onClick={() => {
              const last = weeks[weeks.length - 1]
              const start = last ? addDays(last.end_date, 1) : t
              setEditing({ week_no: (last?.week_no ?? 0) + 1, start_date: start, end_date: addDays(start, 6), target_weight_days: 3 })
            }}
          />
        </QuickActions>
      </Hero>

      <ErrorNote error={plan.error ?? summaries.error} />

      {weeks.length > 0 && (
        <Widget title="Χιλιόμετρα: πραγματικά vs πλάνο" icon={<Footprints size={16} />}>
          <TrendChart
            kind="bar"
            data={chartData}
            x="label"
            series={[
              { key: 'actual', label: 'Πραγματικά', color: 'var(--series-1)', digits: 1, unit: 'km' },
              { key: 'target', label: 'Πλάνο', color: 'var(--series-2)', digits: 1, unit: 'km' },
            ]}
          />
        </Widget>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {weeks.map((w) => {
          const a = actuals(rows, w)
          const started = w.start_date <= t
          return (
            <Widget
              key={w.id}
              title={`Εβδομάδα ${w.week_no} · ${fmtRange({ from: w.start_date, to: w.end_date })}`}
              onClick={() => setEditing(w)}
              className={clsx(w === current && 'ring-2 ring-accent', !started && 'opacity-70')}
            >
              <div className="space-y-3">
                <Progress label="Χιλιόμετρα" value={started ? a.km : null} target={w.target_km} unit="km" />
                <Progress label="Long run" value={started ? a.longRun : null} target={w.target_long_run} unit="km" />
                <Progress label="Βάρη" value={started ? a.weights : null} target={w.target_weight_days} unit="μέρες" digits={0} />
              </div>
              {w.notes && <p className="mt-3 text-xs text-muted">{w.notes}</p>}
            </Widget>
          )
        })}
      </div>

      <WeekSheet week={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function Progress(props: { label: string; value: number | null; target: number | null; unit: string; digits?: number }) {
  const done = props.value != null && props.target != null && props.value >= props.target
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-muted">{props.label}</span>
        <span className={clsx('font-semibold', done && 'text-good')}>
          {num(props.value, props.digits ?? 1)} / {num(props.target, props.digits ?? 1)} {props.unit}
        </span>
      </div>
      <Bar value={props.value} max={props.target} tone={done ? 'good' : 'accent'} />
    </div>
  )
}

function WeekSheet(props: { week: Partial<RunPlanWeek> | null; onClose: () => void }) {
  const save = useSaveRow('run_plan_weeks')
  const del = useDeleteRow('run_plan_weeks')
  const [w, setW] = useState<Partial<RunPlanWeek>>({})
  useEffect(() => {
    if (props.week) setW(props.week)
  }, [props.week])
  const set = <K extends keyof RunPlanWeek>(k: K, v: RunPlanWeek[K] | null) => setW((x) => ({ ...x, [k]: v }))
  const valid = w.week_no != null && !!w.start_date && !!w.end_date && w.end_date >= w.start_date

  return (
    <Sheet
      open={!!props.week}
      onClose={props.onClose}
      title={w.id ? `Εβδομάδα ${w.week_no}` : 'Νέα εβδομάδα'}
      footer={
        <div className="flex gap-2">
          {w.id && (
            <Button variant="danger" onClick={() => del.mutate(w.id!, { onSuccess: props.onClose })}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: w.id,
                  week_no: w.week_no!,
                  start_date: w.start_date!,
                  end_date: w.end_date!,
                  target_km: w.target_km ?? null,
                  target_long_run: w.target_long_run ?? null,
                  target_weight_days: w.target_weight_days ?? null,
                  notes: w.notes || null,
                },
                { onSuccess: props.onClose },
              )
            }
          >
            Αποθήκευση
          </Button>
        </div>
      }
    >
      <ErrorNote error={save.error ?? del.error} />
      <Field label="Εβδομάδα #">
        <NumberInput value={w.week_no} integer onChange={(v) => set('week_no', v == null ? null : Math.round(v))} />
      </Field>
      <Field label="Από">
        <input type="date" value={w.start_date ?? ''} onChange={(e) => set('start_date', e.target.value)} className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold" />
      </Field>
      <Field label="Έως">
        <input type="date" value={w.end_date ?? ''} onChange={(e) => set('end_date', e.target.value)} className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold" />
      </Field>
      <Field label="Στόχος km">
        <NumberInput value={w.target_km} onChange={(v) => set('target_km', v)} unit="km" />
      </Field>
      <Field label="Στόχος long run">
        <NumberInput value={w.target_long_run} onChange={(v) => set('target_long_run', v)} unit="km" />
      </Field>
      <Field label="Στόχος μέρες βάρη">
        <NumberInput value={w.target_weight_days} integer onChange={(v) => set('target_weight_days', v == null ? null : Math.round(v))} />
      </Field>
      <div className="pt-3">
        <TextInput value={w.notes ?? ''} onChange={(v) => set('notes', v)} placeholder="Σημειώσεις" />
      </div>
    </Sheet>
  )
}
