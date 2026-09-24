import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, Button, ErrorNote, Field, Hero, NumberInput, QuickAction, QuickActions, Sheet, Stat, TextInput, Widget } from '../components/ui'
import { useDeleteRow, usePeriods, useSaveRow, useSummaries } from '../lib/api'
import type { Period } from '../lib/database.types'
import { addDays, diffDays, fmtRange, today } from '../lib/dates'
import { num, signed } from '../lib/format'
import { avg, estimatedBurn, inRange, kgLost } from '../lib/stats'

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

  return (
    <div className="space-y-3">
      <Hero
        label={current ? `ΣΤΟΧΟΣ ΘΕΡΜΙΔΩΝ · ${current.label ?? 'τρέχουσα περίοδος'}` : 'ΚΑΜΙΑ ΕΝΕΡΓΗ ΠΕΡΙΟΔΟΣ'}
        value={current ? num(current.target_intake, 0) : '—'}
        unit={current ? 'kcal' : undefined}
        sub={
          current && (
            <>
              burn {num(current.burn_estimate, 0)} · έλλειμμα στόχος {num(current.burn_estimate - current.target_intake, 0)} ·{' '}
              {diffDays(current.end_date, t)} μέρες ακόμα
            </>
          )
        }
      >
        <QuickActions>
          <QuickAction
            icon={<Plus size={20} />}
            label="Περίοδος"
            onClick={() => {
              const last = list[list.length - 1]
              const start = last ? addDays(last.end_date, 1) : t
              setEditing({ start_date: start, end_date: addDays(start, 27), protein_target: 180 })
            }}
          />
        </QuickActions>
      </Hero>

      <ErrorNote error={periods.error ?? summaries.error} />

      <Widget title="Εκτίμηση πραγματικής καύσης (21 ημέρες)">
        <div className="flex items-end gap-6">
          <Stat label="Από τα δεδομένα σου" value={est == null ? '—' : num(est, 0)} unit="kcal" />
          <Stat label="Δηλωμένο burn" value={num(current?.burn_estimate, 0)} unit="kcal" />
          {est != null && current && (
            <Stat
              label="Διαφορά"
              value={signed(est - current.burn_estimate, 0)}
              tone={Math.abs(est - current.burn_estimate) > 200 ? 'warn' : undefined}
            />
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Μέσες θερμίδες − (αλλαγή βάρους × 7700 / ημέρες). Αν απέχει πολύ από το δηλωμένο burn, ίσως θες να το διορθώσεις.
        </p>
      </Widget>

      <div className="space-y-3">
        {list.map((p) => {
          const status = p.end_date < t ? 'done' : p.start_date > t ? 'future' : 'current'
          const pr = inRange(rows, { from: p.start_date, to: p.end_date < t ? p.end_date : t })
          const total = diffDays(p.end_date, p.start_date) + 1
          const elapsed = status === 'future' ? 0 : Math.min(total, diffDays(t, p.start_date) + 1)
          const eaten = avg(pr, 'kcal')
          return (
            <Widget
              key={p.id}
              title={p.label || fmtRange({ from: p.start_date, to: p.end_date })}
              onClick={() => setEditing(p)}
              className={clsx(status === 'current' && 'ring-2 ring-accent', status === 'done' && 'opacity-70')}
              action={
                <span
                  className={clsx(
                    'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                    status === 'current' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                  )}
                >
                  {status === 'current' ? 'Τρέχουσα' : status === 'done' ? 'Ολοκληρώθηκε' : 'Μελλοντική'}
                </span>
              }
            >
              {p.label && <div className="-mt-2 mb-3 text-xs text-muted">{fmtRange({ from: p.start_date, to: p.end_date })}</div>}
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Target" value={num(p.target_intake, 0)} />
                <Stat label="Burn" value={num(p.burn_estimate, 0)} />
                <Stat label="Έλλειμμα" value={num(p.burn_estimate - p.target_intake, 0)} />
                <Stat label="Πρωτ." value={num(p.protein_target, 0)} unit="g" />
              </div>
              {status !== 'future' && (
                <>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                    <Stat
                      label="Μ.Ο. φαγητό"
                      value={num(eaten, 0)}
                      tone={eaten == null ? undefined : eaten <= p.target_intake ? 'good' : 'bad'}
                    />
                    <Stat label="Μ.Ο. έλλειμμα" value={num(eaten == null ? null : -(avg(pr, 'deficit') ?? 0), 0)} />
                    <Stat label="Λίπος χαμένο" value={num(kgLost(pr), 2)} unit="kg" />
                  </div>
                  <div className="mt-3">
                    <Bar value={elapsed} max={total} />
                    <div className="mt-1 text-right text-[11px] text-muted">
                      {elapsed}/{total} μέρες
                    </div>
                  </div>
                </>
              )}
            </Widget>
          )
        })}
      </div>

      <PeriodSheet period={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function PeriodSheet(props: { period: Partial<Period> | null; onClose: () => void }) {
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
        <input
          type="date"
          value={p.start_date ?? ''}
          onChange={(e) => set('start_date', e.target.value)}
          className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold"
        />
      </Field>
      <Field label="Έως">
        <input
          type="date"
          value={p.end_date ?? ''}
          onChange={(e) => set('end_date', e.target.value)}
          className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold"
        />
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
    </Sheet>
  )
}
