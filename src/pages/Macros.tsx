import { Calculator, Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Button,
  ErrorNote,
  Field,
  Hero,
  MacroRing,
  NumberInput,
  Segmented,
  Sheet,
  Stepper,
  TextInput,
  Widget,
} from '../components/ui'
import { useCopyMeals, useDeleteMeal, useMeals, usePeriods, useSaveMeal } from '../lib/api'
import type { MealEntry, MealSlot } from '../lib/database.types'
import { addDays, relativeDayLabel, type ISODate } from '../lib/dates'
import { num } from '../lib/format'
import { calculatorEntryFor, itemsOf, SLOTS, slotLabel } from '../lib/meals'
import { useDateParam } from '../lib/useDateParam'
import { useSwipe } from '../lib/useSwipe'

const total = (rows: MealEntry[], k: 'kcal' | 'protein' | 'carbs' | 'fat') =>
  rows.reduce((a, r) => a + (r[k] ?? 0), 0)

export function Macros() {
  const [date, setDate] = useDateParam()
  const meals = useMeals(date)
  const prevMeals = useMeals(addDays(date, -1)).data ?? []
  const copyMeals = useCopyMeals()
  const deleteMeal = useDeleteMeal()
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const openCalculator = (slot: MealSlot, entries: MealEntry[]) => {
    const target = calculatorEntryFor(entries, slot)
    navigate(target ? `/calculator?entry=${target.id}` : `/calculator?slot=${slot}&d=${date}`)
  }
  const period = usePeriods().data?.find((p) => p.start_date <= date && p.end_date >= date)
  const [editing, setEditing] = useState<{ slot: MealSlot; entry?: MealEntry } | null>(null)
  const navigate = useNavigate()
  // Same day-swipe behaviour as ΓΕΝΙΚΑ: the new day slides in from the side you swiped towards.
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const go = (days: number) => {
    setDir(days > 0 ? 'next' : 'prev')
    setDate(addDays(date, days))
  }
  const swipe = useSwipe(() => go(1), () => go(-1))
  const anim = dir === 'next' ? 'anim-from-right' : dir === 'prev' ? 'anim-from-left' : ''

  const rows = meals.data ?? []
  const kcal = total(rows, 'kcal')
  const target = period?.target_intake ?? null
  const remaining = target == null ? null : target - kcal

  return (
    <div className="min-h-[calc(100dvh-4rem)] space-y-3" {...swipe}>
      <Hero
        top={<Stepper label={relativeDayLabel(date)} onPrev={() => go(-1)} onNext={() => go(1)} />}
        label="ΘΕΡΜΙΔΕΣ"
        value={
          <span key={date} className={`inline-block ${anim}`}>
            {num(kcal, 0)}
          </span>
        }
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

      <ErrorNote error={meals.error ?? copyMeals.error ?? deleteMeal.error} />

      <div key={date} className={`space-y-3 ${anim}`}>
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
          <div className="mt-4 grid grid-cols-3 justify-items-center gap-1 border-t border-line pt-4">
            <MacroRing label="Πρωτεΐνη" value={total(rows, 'protein')} target={period?.protein_target} unit="g" over="good" size={88} />
            <MacroRing label="Υδατάνθρ." value={total(rows, 'carbs')} target={period?.carbs_target} unit="g" over="bad" size={88} />
            <MacroRing label="Λιπαρά" value={total(rows, 'fat')} target={period?.fat_target} unit="g" over="bad" size={88} />
          </div>
        </Widget>

        <div className="grid gap-3 lg:grid-cols-2">
          {SLOTS.map((s) => {
            const entries = rows.filter((r) => r.slot === s.value)
            // Breakfast/lunch/dinner can repeat yesterday's meal in one tap (snacks vary too much).
            const yesterday = s.value === 'snack' ? [] : prevMeals.filter((r) => r.slot === s.value)
            return (
              <Widget
                key={s.value}
                title={s.value === 'snack' && entries.length ? `${s.label} (${entries.length})` : s.label}
                icon={<span className="block size-2.5 rounded-full" style={{ background: s.color }} />}
                onClick={() => openCalculator(s.value, entries)}
                action={
                  <div className="flex gap-1">
                    {s.value !== 'snack' && (
                      <button
                        type="button"
                        aria-label="Ίδιο με χθες"
                        title={
                          yesterday.length
                            ? `Ίδιο με χθες (${num(total(yesterday, 'kcal'), 0)} kcal)`
                            : 'Χθες δεν υπάρχει καταχώρηση'
                        }
                        disabled={!yesterday.length || copyMeals.isPending}
                        className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted transition hover:bg-line hover:text-text active:scale-90 disabled:opacity-30 disabled:hover:bg-surface-2"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyMeals.mutate({ entries: yesterday, date })
                        }}
                      >
                        <Copy size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Προσθήκη"
                      className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted transition hover:bg-line hover:text-text active:scale-90"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditing({ slot: s.value })
                      }}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Calculator"
                      className="grid size-8 place-items-center rounded-full bg-accent text-white transition hover:brightness-110 active:scale-90"
                      onClick={(e) => {
                        e.stopPropagation()
                        openCalculator(s.value, entries)
                      }}
                    >
                      <Calculator size={15} />
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
                    {entries.map((e, i) => {
                      const items = itemsOf(e.items)
                      const armed = confirmDelete === e.id
                      return (
                        <li key={e.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              // Calculator meals reopen in the calculator with their ingredients; quick entries in the form.
                              if (items.length) navigate(`/calculator?entry=${e.id}`)
                              else setEditing({ slot: s.value, entry: e })
                            }}
                            className="-ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">
                                {e.name || (s.value === 'snack' ? `Snack ${i + 1}` : 'Καταχώρηση')}
                                {e.servings > 1 && <span className="text-muted"> · 1/{num(e.servings, 0)} μερίδα</span>}
                              </span>
                              {items.length > 0 && (
                                <span className="block truncate text-[11px] text-muted">
                                  {items.map((it) => `${it.food} ${num(it.amount, 0)}${it.unit === 'piece' ? 'τεμ' : 'g'}`).join(', ')}
                                </span>
                              )}
                            </span>
                            <span className="hidden text-xs text-muted sm:inline">
                              Π {num(e.protein, 1)} · Υ {num(e.carbs, 1)} · Λ {num(e.fat, 1)}
                            </span>
                            <span className="w-12 text-right text-sm font-semibold">{num(e.kcal, 0)}</span>
                            {items.length ? (
                              <Calculator size={13} className="shrink-0 text-muted" />
                            ) : (
                              <Pencil size={13} className="shrink-0 text-muted" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={armed ? 'Επιβεβαίωση διαγραφής' : 'Διαγραφή'}
                            disabled={deleteMeal.isPending}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              // Two taps: the first arms the button, the second deletes.
                              if (armed) deleteMeal.mutate(e.id, { onSettled: () => setConfirmDelete(null) })
                              else setConfirmDelete(e.id)
                            }}
                            className={
                              armed
                                ? 'anim-fade h-8 shrink-0 rounded-full bg-bad px-3 text-xs font-semibold text-white transition active:scale-95'
                                : 'grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-bad/15 hover:text-bad active:scale-90'
                            }
                          >
                            {armed ? 'Διαγραφή;' : <Trash2 size={14} />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Widget>
            )
          })}
        </div>
      </div>

      <MealSheet date={date} editing={editing} onClose={() => setEditing(null)} />
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
    </Sheet>
  )
}
