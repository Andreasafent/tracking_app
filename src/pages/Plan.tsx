import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode, useEffect } from 'react'
import { ErrorNote, Sheet, Button, TextInput, Field, DateInput, NumberInput } from '../components/ui'
import { usePeriods, useSummaries, useSaveRow, useDeleteRow } from '../lib/api'
import type { Period } from '../lib/database.types'
import { addDays, diffDays, fmtRange, today } from '../lib/dates'
import { num, signed } from '../lib/format'
import { avg, estimatedBurn, inRange, kgLost } from '../lib/stats'
import '../styles/pages.css'

function Stat(props: { label: string; value: ReactNode; unit?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div>
      <div className={clsx('da-num da-stat', props.tone && `pa-${props.tone}`)}>
        {props.value}
        {props.unit && <small>{props.unit}</small>}
      </div>
      <div className="da-dim">{props.label}</div>
    </div>
  )
}

/** TARGETS: the calorie/macro periods and the burn estimated from the data. */
export function Plan() {
  const periods = usePeriods()
  const list = periods.data ?? []
  const t = today()
  const from = list[0]?.start_date ?? addDays(t, -30)
  const summaries = useSummaries(from < addDays(t, -30) ? from : addDays(t, -30), t)
  const rows = summaries.data ?? []
  const [editing, setEditing] = useState<Partial<Period> | null>(null)

  const current = list.find((p) => p.start_date <= t && p.end_date >= t)
  const est = estimatedBurn(rows, t)
  const curTotal = current ? diffDays(current.end_date, current.start_date) + 1 : 0
  const curElapsed = current ? Math.min(curTotal, diffDays(t, current.start_date) + 1) : 0

  const newPeriod = () => {
    const last = list[list.length - 1]
    const start = last ? addDays(last.end_date, 1) : t
    setEditing({ start_date: start, end_date: addDays(start, 27), protein_target: 180 })
  }

  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">Στόχοι</h2>
          <div className="da-date">{list.length ? `${list.length} ${list.length === 1 ? 'περίοδος' : 'περίοδοι'}` : 'καμία περίοδος ακόμα'}</div>
        </div>
        <div className="da-nav">
          <button type="button" className="da-pillbtn" onClick={newPeriod}>
            <Plus size={16} /> Περίοδος
          </button>
        </div>
      </header>

      <ErrorNote error={periods.error ?? summaries.error} />

      <div className="da-grid">
        <section className="da-card da-dark da-full">
          <div className="da-row">
            <span>{current ? `Στόχος θερμίδων · ${current.label ?? 'τρέχουσα περίοδος'}` : 'Καμία ενεργή περίοδος'}</span>
          </div>
          <div className="da-num da-hero">
            {current ? num(current.target_intake, 0) : '—'}
            {current && <small>kcal</small>}
          </div>
          {current && (
            <>
              <div className="da-bar" style={{ color: '#9AD8B8' }}>
                <i style={{ width: `${(curElapsed / curTotal) * 100}%` }} />
              </div>
              <div className="da-caption">
                burn {num(current.burn_estimate, 0)} · έλλειμμα στόχος {num(current.burn_estimate - current.target_intake, 0)} ·{' '}
                {diffDays(current.end_date, t)} μέρες ακόμα
              </div>
            </>
          )}
        </section>

        <section className="da-card da-full">
          <h3>Εκτίμηση πραγματικής καύσης (21 ημέρες)</h3>
          <div className="pa-stats">
            <Stat label="από τα δεδομένα σου" value={est == null ? '—' : num(est, 0)} />
            <Stat label="δηλωμένο burn" value={num(current?.burn_estimate, 0)} />
            {est != null && current ? (
              <Stat
                label="διαφορά"
                value={signed(est - current.burn_estimate, 0)}
                tone={Math.abs(est - current.burn_estimate) > 200 ? 'warn' : undefined}
              />
            ) : (
              <div />
            )}
          </div>
          <p className="da-dim pa-note">
            Μέσες θερμίδες − (αλλαγή βάρους × 7700 / ημέρες). Αν απέχει πολύ από το δηλωμένο burn, ίσως θες να το διορθώσεις.
          </p>
        </section>

        {list.map((p) => {
          const status = p.end_date < t ? 'done' : p.start_date > t ? 'future' : 'current'
          const pr = inRange(rows, { from: p.start_date, to: p.end_date < t ? p.end_date : t })
          const total = diffDays(p.end_date, p.start_date) + 1
          const elapsed = status === 'future' ? 0 : Math.min(total, diffDays(t, p.start_date) + 1)
          const eaten = avg(pr, 'kcal')
          const open = () => setEditing(p)
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
                  <h3>{p.label || fmtRange({ from: p.start_date, to: p.end_date })}</h3>
                  {p.label && <div className="da-dim">{fmtRange({ from: p.start_date, to: p.end_date })}</div>}
                </div>
                <span className={clsx('ta-status', status)}>
                  <i />
                  {status === 'current' ? 'Τρέχουσα' : status === 'done' ? 'Ολοκληρώθηκε' : 'Μελλοντική'}
                </span>
              </div>

              <div className="pa-stats">
                <Stat label="target" value={num(p.target_intake, 0)} />
                <Stat label="burn" value={num(p.burn_estimate, 0)} />
                <Stat label="έλλειμμα" value={num(p.burn_estimate - p.target_intake, 0)} />
                <Stat label="πρωτεΐνη" value={num(p.protein_target, 0)} unit="g" />
                <Stat label="υδατάνθρ." value={num(p.carbs_target, 0)} unit="g" />
                <Stat label="λιπαρά" value={num(p.fat_target, 0)} unit="g" />
              </div>

              {status !== 'future' && (
                <>
                  <div className="pa-stats pa-sep">
                    <Stat
                      label="μ.ο. φαγητό"
                      value={num(eaten, 0)}
                      tone={eaten == null ? undefined : eaten <= p.target_intake ? 'good' : 'bad'}
                    />
                    <Stat label="μ.ο. έλλειμμα" value={num(eaten == null ? null : -(avg(pr, 'deficit') ?? 0), 0)} />
                    <Stat label="λίπος χαμένο" value={num(kgLost(pr), 2)} unit="kg" />
                  </div>
                  <div className="da-bar da-bar-thin pa-progress" style={{ color: 'var(--green)' }}>
                    <i style={{ width: `${(elapsed / total) * 100}%` }} />
                  </div>
                  <div className="da-dim pa-days">
                    {elapsed}/{total} μέρες
                  </div>
                </>
              )}
            </section>
          )
        })}
      </div>

      <PeriodSheet period={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export function PeriodSheet(props: { period: Partial<Period> | null; onClose: () => void }) {
  const save = useSaveRow('periods')
  const del = useDeleteRow('periods')
  const [p, setP] = useState<Partial<Period>>({})
  useEffect(() => {
    if (props.period) setP(props.period)
  }, [props.period])
  const set = <K extends keyof Period>(k: K, v: Period[K] | null) => setP((x) => ({ ...x, [k]: v }))
  const valid =
    !!p.start_date && !!p.end_date && p.end_date >= p.start_date && p.target_intake != null && p.burn_estimate != null

  const err = save.error?.message.includes('periods_no_overlap')
    ? 'Η περίοδος επικαλύπτεται με άλλη. Άλλαξε τις ημερομηνίες.'
    : save.error ?? del.error

  return (
    <Sheet
      open={!!props.period}
      onClose={props.onClose}
      title={p.id ? 'Επεξεργασία περιόδου' : 'Νέα περίοδος'}
      footer={
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
                  label: p.label || null,
                  start_date: p.start_date!,
                  end_date: p.end_date!,
                  target_intake: p.target_intake!,
                  burn_estimate: p.burn_estimate!,
                  protein_target: p.protein_target ?? 180,
                  carbs_target: p.carbs_target ?? null,
                  fat_target: p.fat_target ?? null,
                  notes: p.notes || null,
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
      <ErrorNote error={err} />
      <TextInput value={p.label ?? ''} onChange={(v) => set('label', v)} placeholder="Όνομα (π.χ. Marathon build)" />
      <Field label="Από">
        <DateInput value={p.start_date} onChange={(v) => set('start_date', v)} />
      </Field>
      <Field label="Έως">
        <DateInput value={p.end_date} onChange={(v) => set('end_date', v)} />
      </Field>
      <Field label="Στόχος θερμίδων" hint="TARGET INTAKE">
        <NumberInput value={p.target_intake} integer onChange={(v) => set('target_intake', v == null ? null : Math.round(v))} unit="kcal" />
      </Field>
      <Field label="Καύση" hint="BURN ESTIMATE (μέσος όρος περιόδου)">
        <NumberInput value={p.burn_estimate} integer onChange={(v) => set('burn_estimate', v == null ? null : Math.round(v))} unit="kcal" />
      </Field>
      <Field label="Στόχος πρωτεΐνης">
        <NumberInput value={p.protein_target} integer onChange={(v) => set('protein_target', v == null ? null : Math.round(v))} unit="g" />
      </Field>
      <Field label="Στόχος υδατανθράκων" hint="Κενό = χωρίς στόχο">
        <NumberInput value={p.carbs_target} integer onChange={(v) => set('carbs_target', v == null ? null : Math.round(v))} unit="g" />
      </Field>
      <Field label="Στόχος λιπαρών" hint="Κενό = χωρίς στόχο">
        <NumberInput value={p.fat_target} integer onChange={(v) => set('fat_target', v == null ? null : Math.round(v))} unit="g" />
      </Field>
    </Sheet>
  )
}
