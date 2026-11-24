import { inRange, sum, countBool } from '../lib/stats'
import clsx from 'clsx'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { TrendChart } from '../components/Charts'
import { ErrorNote, Sheet, Button, Field, NumberInput, DateInput, TextInput } from '../components/ui'
import { useRunPlan, useSummaries, useSaveRow, useDeleteRow } from '../lib/api'
import type { RunPlanWeek, DailySummary } from '../lib/database.types'
import { addDays, fmtRange, today } from '../lib/dates'
import { num } from '../lib/format'
import '../styles/pages.css'

/** One target with its progress: value / target on the right, a hatched bar under it. */
function Progress(props: { label: string; value: number | null; target: number | null; unit: string; digits?: number }) {
  const done = props.value != null && props.target != null && props.value >= props.target
  const pct = props.value == null || !props.target ? 0 : Math.min(1, props.value / props.target)
  return (
    <div className="ra-prog">
      <div className="da-row">
        <span>{props.label}</span>
        <span className={clsx('ra-val', done && 'done')}>
          {done && <Check size={14} strokeWidth={3} />}
          {num(props.value, props.digits ?? 1)} <span className="da-dim">/ {num(props.target, props.digits ?? 1)} {props.unit}</span>
        </span>
      </div>
      <div className="da-bar da-bar-thin" style={{ color: done ? '#5FAE88' : 'var(--green)' }}>
        <i style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  )
}

/** MARATHON BLOCK: weekly running targets against what was done. */
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

  const newWeek = () => {
    const last = weeks[weeks.length - 1]
    const start = last ? addDays(last.end_date, 1) : t
    setEditing({ week_no: (last?.week_no ?? 0) + 1, start_date: start, end_date: addDays(start, 6), target_weight_days: 3 })
  }
  const heroPct = cur && current?.target_km ? Math.min(1, cur.km / current.target_km) : 0

  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">Marathon</h2>
          <div className="da-date">
            {weeks.length ? `${weeks.length} εβδομάδες` : 'καμία εβδομάδα ακόμα'}
            {current && ` · τώρα Ε${current.week_no}`}
          </div>
        </div>
        <div className="da-nav">
          <button type="button" className="da-pillbtn" onClick={newWeek}>
            <Plus size={16} /> Εβδομάδα
          </button>
        </div>
      </header>

      <ErrorNote error={plan.error ?? summaries.error} />

      <div className="da-grid">
        <section className="da-card da-dark da-full">
          <div className="da-row">
            <span>{current ? `Χιλιόμετρα · Εβδομάδα ${current.week_no}` : 'Χιλιόμετρα εβδομάδας'}</span>
          </div>
          <div className="da-num da-hero">
            {cur ? num(cur.km, 1) : '—'}
            <small>{current?.target_km != null ? `/ ${num(current.target_km, 1)} km` : 'km'}</small>
          </div>
          {current && cur && (
            <>
              <div className="da-bar" style={{ color: '#9AD8B8' }}>
                <i style={{ width: `${heroPct * 100}%` }} />
              </div>
              <div className="da-caption">
                Long run <b>{num(cur.longRun, 1)}</b> / {num(current.target_long_run, 1)} km · Βάρη <b>{cur.weights}</b>/
                {current.target_weight_days ?? 0}
              </div>
            </>
          )}
        </section>

        {weeks.length > 0 && (
          <section className="da-card da-full">
            <h3>Χιλιόμετρα: πραγματικά vs πλάνο</h3>
            <div className="ra-chart">
              <TrendChart
                kind="bar"
                data={chartData}
                x="label"
                series={[
                  { key: 'actual', label: 'Πραγματικά', color: 'var(--series-1)', digits: 1, unit: 'km' },
                  { key: 'target', label: 'Πλάνο', color: 'var(--series-2)', digits: 1, unit: 'km' },
                ]}
              />
            </div>
          </section>
        )}

        {weeks.map((w) => {
          const a = actuals(rows, w)
          const started = w.start_date <= t
          const open = () => setEditing(w)
          return (
            <section
              key={w.id}
              className={clsx('da-card da-span2 da-click', w === current && 'ra-current', !started && 'ta-done')}
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
                  <h3>Εβδομάδα {w.week_no}</h3>
                  <div className="da-dim">{fmtRange({ from: w.start_date, to: w.end_date })}</div>
                </div>
                {w === current && (
                  <span className="ta-status current">
                    <i />
                    Τρέχουσα
                  </span>
                )}
              </div>
              <div className="ra-progs">
                <Progress label="Χιλιόμετρα" value={started ? a.km : null} target={w.target_km} unit="km" />
                <Progress label="Long run" value={started ? a.longRun : null} target={w.target_long_run} unit="km" />
                <Progress label="Βάρη" value={started ? a.weights : null} target={w.target_weight_days} unit="μέρες" digits={0} />
              </div>
              {w.notes && <p className="da-dim ra-notes">{w.notes}</p>}
            </section>
          )
        })}
      </div>

      <WeekSheet week={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export function actuals(rows: DailySummary[], w: RunPlanWeek) {
  const r = inRange(rows, { from: w.start_date, to: w.end_date })
  const longest = r.reduce((m, d) => Math.max(m, d.longest_run_km ?? 0), 0)
  return { km: sum(r, 'run_km'), longRun: longest, weights: countBool(r, 'did_weights') }
}

export function WeekSheet(props: { week: Partial<RunPlanWeek> | null; onClose: () => void }) {
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
        <DateInput value={w.start_date} onChange={(v) => set('start_date', v)} />
      </Field>
      <Field label="Έως">
        <DateInput value={w.end_date} onChange={(v) => set('end_date', v)} />
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
