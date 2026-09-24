import { Calculator, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Bar,
  Button,
  ErrorNote,
  Field,
  Hero,
  NumberInput,
  Segmented,
  Sheet,
  Stepper,
  TextInput,
  Widget,
} from '../components/ui'
import { useDeleteMeal, useMeals, usePeriods, useSaveMeal } from '../lib/api'
import type { MealEntry, MealSlot } from '../lib/database.types'
import { addDays, relativeDayLabel, type ISODate } from '../lib/dates'
import { num } from '../lib/format'
import { SLOTS, slotLabel, type MealItem } from '../lib/meals'
import { useDateParam } from '../lib/useDateParam'

const total = (rows: MealEntry[], k: 'kcal' | 'protein' | 'carbs' | 'fat') =>
  rows.reduce((a, r) => a + (r[k] ?? 0), 0)

export function Macros() {
  const [date, setDate] = useDateParam()
  const meals = useMeals(date)
  const period = usePeriods().data?.find((p) => p.start_date <= date && p.end_date >= date)
  const [editing, setEditing] = useState<{ slot: MealSlot; entry?: MealEntry } | null>(null)
  const navigate = useNavigate()

  const rows = meals.data ?? []
  const kcal = total(rows, 'kcal')
  const target = period?.target_intake ?? null
  const remaining = target == null ? null : target - kcal

  return (
    <div className="space-y-3">
      <Hero
        top={
          <Stepper
            label={relativeDayLabel(date)}
            onPrev={() => setDate(addDays(date, -1))}
            onNext={() => setDate(addDays(date, 1))}
          />
        }
        label="ΘΕΡΜΙΔΕΣ"
        value={num(kcal, 0)}
        unit="kcal"
        sub={
          target == null ? (
            'Δεν υπάρχει περίοδος για αυτή τη μέρα'
          ) : (
            <>
              στόχος {num(target, 0)} ·{' '}
              <b className={remaining! < 0 ? 'text-bad' : 'text-good'}>
                {remaining! < 0 ? `+${num(-remaining!, 0)} πάνω` : `${num(remaining, 0)} απομένουν`}
              </b>
            </>
          )
        }
      />

      <ErrorNote error={meals.error} />

      {/* Day breakdown */}
      <Widget title="Κατανομή ημέρας">
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2">
          {SLOTS.map((s) => {
            const k = total(rows.filter((r) => r.slot === s.value), 'kcal')
            return kcal > 0 && k > 0 ? (
              <div key={s.value} style={{ width: `${(k / kcal) * 100}%`, background: s.color }} />
            ) : null
          })}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {SLOTS.map((s) => {
            const k = total(rows.filter((r) => r.slot === s.value), 'kcal')
            return (
              <div key={s.value}>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </div>
                <div className="text-sm font-semibold">{num(k, 0)}</div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 space-y-3">
          <MacroBar label="Πρωτεΐνη" value={total(rows, 'protein')} target={period?.protein_target ?? 180} />
          <MacroBar label="Υδατάνθρακες" value={total(rows, 'carbs')} target={period?.carbs_target ?? undefined} />
          <MacroBar label="Λιπαρά" value={total(rows, 'fat')} target={period?.fat_target ?? undefined} />
        </div>
      </Widget>

      <div className="grid gap-3 lg:grid-cols-2">
        {SLOTS.map((s) => {
          const entries = rows.filter((r) => r.slot === s.value)
          return (
            <Widget
              key={s.value}
              title={s.value === 'snack' && entries.length ? `${s.label} (${entries.length})` : s.label}
              icon={<span className="block size-2.5 rounded-full" style={{ background: s.color }} />}
              action={
                <div className="flex gap-1">
                  <button
                    type="button"
                    aria-label="Calculator"
                    className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted transition hover:bg-line hover:text-text active:scale-90"
                    onClick={() => navigate(`/calculator?slot=${s.value}&d=${date}`)}
                  >
                    <Calculator size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="Προσθήκη"
                    className="grid size-8 place-items-center rounded-full bg-accent text-white transition hover:brightness-110 active:scale-90"
                    onClick={() => setEditing({ slot: s.value })}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              }
            >
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold">{num(total(entries, 'kcal'), 0)}</span>
                <span className="text-xs text-muted">kcal</span>
                <span className="ml-auto text-xs text-muted">
                  Π {num(total(entries, 'protein'), 1)} · Υ {num(total(entries, 'carbs'), 1)} · Λ{' '}
                  {num(total(entries, 'fat'), 1)}
                </span>
              </div>
              {entries.length > 0 && (
                <ul className="mt-3 divide-y divide-line">
                  {entries.map((e, i) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ slot: s.value, entry: e })}
                        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2"
                      >
                        <span className="flex-1 truncate text-sm">
                          {e.name || (s.value === 'snack' ? `Snack ${i + 1}` : 'Καταχώρηση')}
                        </span>
                        <span className="text-xs text-muted">
                          Π {num(e.protein, 1)} · Υ {num(e.carbs, 1)} · Λ {num(e.fat, 1)}
                        </span>
                        <span className="w-14 text-right text-sm font-semibold">{num(e.kcal, 0)}</span>
                        <Pencil size={13} className="text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Widget>
          )
        })}
      </div>

      <MealSheet date={date} editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function MacroBar(props: { label: string; value: number; target?: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-muted">{props.label}</span>
        <span className="font-semibold">
          {num(props.value, 1)} g{props.target != null && <span className="text-muted"> / {props.target}</span>}
        </span>
      </div>
      <Bar value={props.value} max={props.target ?? Math.max(props.value, 1)} tone={props.target && props.value >= props.target ? 'good' : 'accent'} />
    </div>
  )
}

function MealSheet(props: { date: ISODate; editing: { slot: MealSlot; entry?: MealEntry } | null; onClose: () => void }) {
  const save = useSaveMeal()
  const del = useDeleteMeal()
  const [slot, setSlot] = useState<MealSlot>('breakfast')
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState<number | null>(null)
  const [protein, setProtein] = useState<number | null>(null)
  const [carbs, setCarbs] = useState<number | null>(null)
  const [fat, setFat] = useState<number | null>(null)

  const e = props.editing?.entry
  useEffect(() => {
    if (!props.editing) return
    setSlot(props.editing.slot)
    setName(e?.name ?? '')
    setKcal(e?.kcal ?? null)
    setProtein(e?.protein ?? null)
    setCarbs(e?.carbs ?? null)
    setFat(e?.fat ?? null)
  }, [props.editing, e])

  const items = (e?.items as MealItem[] | null) ?? null

  return (
    <Sheet
      open={!!props.editing}
      onClose={props.onClose}
      title={e ? `Επεξεργασία · ${slotLabel(slot)}` : `Νέο · ${slotLabel(slot)}`}
      footer={
        <div className="flex gap-2">
          {e && (
            <Button variant="danger" onClick={() => del.mutate(e.id, { onSuccess: props.onClose })}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={kcal == null || save.isPending}
            onClick={() =>
              save.mutate(
                { id: e?.id, date: props.date, slot, name: name || null, kcal: kcal ?? 0, protein, carbs, fat },
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
      <Segmented value={slot} onChange={setSlot} options={SLOTS.map((s) => ({ value: s.value, label: s.label }))} />
      <div className="mt-3">
        <TextInput value={name} onChange={setName} placeholder="Όνομα (προαιρετικό)" />
      </div>
      <Field label="Θερμίδες">
        <NumberInput value={kcal} onChange={setKcal} unit="kcal" />
      </Field>
      <Field label="Πρωτεΐνη">
        <NumberInput value={protein} onChange={setProtein} unit="g" />
      </Field>
      <Field label="Υδατάνθρακες">
        <NumberInput value={carbs} onChange={setCarbs} unit="g" />
      </Field>
      <Field label="Λιπαρά">
        <NumberInput value={fat} onChange={setFat} unit="g" />
      </Field>
      {items && items.length > 0 && (
        <div className="mt-3 rounded-2xl bg-surface-2 p-3">
          <div className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Από το calculator</div>
          <ul className="space-y-1 text-sm">
            {items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">
                  {it.food} <span className="text-muted">· {num(it.amount, 1)} {it.unit === 'piece' ? 'τεμ' : 'g'}</span>
                </span>
                <span className="font-semibold">{num(it.kcal, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
