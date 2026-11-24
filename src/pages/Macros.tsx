import { useNavigate } from 'react-router'
import clsx from 'clsx'
import { Calculator, ChevronLeft, ChevronRight, Copy, ListPlus, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { SavedMealPicker } from '../components/SavedMealPicker'
import { Button, ErrorNote, Sheet, Segmented, TextInput, Field, NumberInput } from '../components/ui'
import { useCopyMeals, useDeleteMeal, useFoods, useMeals, usePeriods, useSaveMeal, useTrainingPlans } from '../lib/api'
import type { Json, MealEntry, MealSlot } from '../lib/database.types'
import { addDays, fmtDay, relativeDayLabel, today, type ISODate } from '../lib/dates'
import { num } from '../lib/format'
import { entryFromRecipe, itemsOf, SLOTS, slotLabel } from '../lib/meals'
import { intakeTarget, macroTargets } from '../lib/training'
import { useDateParam } from '../lib/useDateParam'
import { useSwipe } from '../lib/useSwipe'
import { NutRings } from '../components/ChartParts'
import '../styles/pages.css'

const total = (rows: MealEntry[], k: 'kcal' | 'protein' | 'carbs' | 'fat') => rows.reduce((a, r) => a + (r[k] ?? 0), 0)

/** The day's meals by slot, with calories and macros against the targets. */
export function Macros() {
  const [date, setDate] = useDateParam()
  const navigate = useNavigate()
  const meals = useMeals(date)
  const prevMeals = useMeals(addDays(date, -1)).data ?? []
  const copyMeals = useCopyMeals()
  const deleteMeal = useDeleteMeal()
  const foods = useFoods().data ?? []
  const insertMeal = useSaveMeal()
  const period = usePeriods().data?.find((p) => p.start_date <= date && p.end_date >= date)
  const plans = useTrainingPlans().data ?? []
  const intake = intakeTarget(date, plans, period)
  const targets = macroTargets(date, plans, period)
  const [inserting, setInserting] = useState<MealSlot | null>(null)
  const [editing, setEditing] = useState<{ slot: MealSlot; entry?: MealEntry } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  // The new day slides in from the side you swiped towards.
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const go = (days: number) => {
    setDir(days > 0 ? 'next' : 'prev')
    setDate(addDays(date, days))
  }
  const swipe = useSwipe(() => go(1), () => go(-1))
  const anim = dir === 'next' ? 'anim-from-right' : dir === 'prev' ? 'anim-from-left' : ''

  const rows = meals.data ?? []
  const kcal = total(rows, 'kcal')
  const target = intake.kcal
  const remaining = target == null ? null : target - kcal
  const eaten = target ? Math.min(1, kcal / target) : 0
  const openCalculator = (slot: MealSlot) => navigate(`/calculator?slot=${slot}&d=${date}`)
  const macros = [
    { key: 'protein', name: 'Πρωτεΐνη', value: total(rows, 'protein'), target: targets.protein },
    { key: 'carbs', name: 'Υδατάνθρακες', value: total(rows, 'carbs'), target: targets.carbs },
    { key: 'fat', name: 'Λιπαρά', value: total(rows, 'fat'), target: targets.fat },
  ]

  return (
    <div className="da da-flat" {...swipe}>
      <header className="da-top">
        <div>
          <h2 className="da-title">{relativeDayLabel(date)}</h2>
          <div className="da-date">{fmtDay(date)}</div>
        </div>
        <div className="da-nav">
          <button
            type="button"
            className="da-today"
            disabled={date === today()}
            onClick={() => {
              setDir(date < today() ? 'next' : 'prev')
              setDate(today())
            }}
          >
            Σήμερα
          </button>
          <button type="button" aria-label="Προηγούμενη μέρα" onClick={() => go(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Επόμενη μέρα" onClick={() => go(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <ErrorNote error={meals.error ?? copyMeals.error ?? deleteMeal.error} />

      <div key={date} className={anim}>
        <div className="da-grid">
          <section className="da-card da-dark da-span2">
            <div className="da-row">
              <span>Θερμίδες</span>
              <button type="button" className="da-arrow" aria-label="Calculator" onClick={() => navigate(`/calculator?d=${date}`)}>
                <Calculator size={18} />
              </button>
            </div>
            <div className="da-num da-hero">
              {num(kcal, 0)}
              <small>kcal</small>
            </div>
            <div className="da-bar" style={{ color: '#9AD8B8' }}>
              <i style={{ width: `${eaten * 100}%` }} />
            </div>
            <div className="da-caption">
              {target == null ? (
                'χωρίς στόχο'
              ) : (
                <>
                  στόχος {num(target, 0)}
                  {intake.source === 'training' && ' (training plan)'} ·{' '}
                  <b>{remaining! < 0 ? `+${num(-remaining!, 0)} πάνω` : `${num(remaining, 0)} απομένουν`}</b>
                </>
              )}
            </div>
            {target == null && (
              <button type="button" className="da-notice" onClick={() => navigate('/training')}>
                <TriangleAlert size={14} /> Δεν υπάρχει στόχος θερμίδων για αυτή τη μέρα
              </button>
            )}
          </section>

          <section className="da-card da-span2">
            <h3>Θρεπτικά</h3>
            <div className="da-nut">
              <NutRings macros={macros} colors={['#17503B', '#5FAE88', '#131512']} track="#e3e4dd" className="da-rings" />
              <dl className="da-ledger">
                {macros.map((m) => (
                  <div key={m.key}>
                    <dt>{m.name}</dt>
                    <dd>
                      {num(m.value, 0)}
                      <span>{m.target ? ` / ${num(m.target, 0)}` : ''} g</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="da-card da-full">
            <h3>Κατανομή ημέρας</h3>
            <div className="ma-stack">
              {SLOTS.map((s) => {
                const k = total(rows.filter((r) => r.slot === s.value), 'kcal')
                return kcal > 0 && k > 0 ? <i key={s.value} style={{ width: `${(k / kcal) * 100}%`, background: s.color }} /> : null
              })}
            </div>
            <div className="ma-legend">
              {SLOTS.map((s) => (
                <div key={s.value}>
                  <span className="ma-dot" style={{ background: s.color }} />
                  <span className="da-dim">{s.label}</span>
                  <b>{num(total(rows.filter((r) => r.slot === s.value), 'kcal'), 0)}</b>
                </div>
              ))}
            </div>
          </section>

          {SLOTS.map((s) => {
            const entries = rows.filter((r) => r.slot === s.value)
            // Breakfast/lunch/dinner can repeat yesterday's meal in one tap (snacks vary too much).
            const yesterday = s.value === 'snack' ? [] : prevMeals.filter((r) => r.slot === s.value)
            const act = (fn: () => void) => (e: React.MouseEvent) => {
              e.stopPropagation()
              fn()
            }
            return (
              <section
                key={s.value}
                className="da-card da-span2 da-click"
                role="button"
                tabIndex={0}
                onClick={() => openCalculator(s.value)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    openCalculator(s.value)
                  }
                }}
              >
                <div className="ma-head">
                  <h3>
                    <span className="ma-dot" style={{ background: s.color }} />
                    {s.value === 'snack' && entries.length ? `${s.label} (${entries.length})` : s.label}
                  </h3>
                  <div className="ma-actions">
                    {s.value !== 'snack' && (
                      <button
                        type="button"
                        className="ma-btn"
                        aria-label="Ίδιο με χθες"
                        title={yesterday.length ? `Ίδιο με χθες (${num(total(yesterday, 'kcal'), 0)} kcal)` : 'Χθες δεν υπάρχει καταχώρηση'}
                        disabled={!yesterday.length || copyMeals.isPending}
                        onClick={act(() => copyMeals.mutate({ entries: yesterday, date }))}
                      >
                        <Copy size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="ma-btn"
                      aria-label="Από αποθηκευμένα γεύματα"
                      title="Από αποθηκευμένα γεύματα"
                      onClick={act(() => {
                        insertMeal.reset()
                        setInserting(s.value)
                      })}
                    >
                      <ListPlus size={16} />
                    </button>
                    <button type="button" className="ma-btn" aria-label="Προσθήκη" onClick={act(() => setEditing({ slot: s.value }))}>
                      <Plus size={16} />
                    </button>
                    <button type="button" className="ma-btn ma-btn-ink" aria-label="Calculator" onClick={act(() => openCalculator(s.value))}>
                      <Calculator size={15} />
                    </button>
                  </div>
                </div>

                <div className="ma-sum">
                  <span className="da-num ma-kcal">{num(total(entries, 'kcal'), 0)}</span>
                  <span className="da-dim">kcal</span>
                  <span className="da-dim ma-pul">
                    Π {num(total(entries, 'protein'), 1)} · Υ {num(total(entries, 'carbs'), 1)} · Λ {num(total(entries, 'fat'), 1)}
                  </span>
                </div>

                {entries.length > 0 && (
                  <ul className="ma-entries">
                    {entries.map((e, i) => {
                      const items = itemsOf(e.items)
                      const armed = confirmDelete === e.id
                      return (
                        <li key={e.id} className="ma-entry">
                          <button
                            type="button"
                            className="ma-entry-main"
                            onClick={act(() => {
                              // Calculator meals reopen in the calculator with their ingredients; quick entries in the form.
                              if (items.length) navigate(`/calculator?entry=${e.id}`)
                              else setEditing({ slot: s.value, entry: e })
                            })}
                          >
                            <span className="ma-entry-text">
                              <span className="ma-entry-name">
                                {e.name || (s.value === 'snack' ? `Snack ${i + 1}` : 'Καταχώρηση')}
                                {e.servings > 1 && <span className="da-dim"> · 1/{num(e.servings, 0)} μερίδα</span>}
                              </span>
                              {items.length > 0 && (
                                <span className="ma-entry-sub">
                                  {items.map((it) => `${it.food} ${num(it.amount, 0)}${it.unit === 'piece' ? 'τεμ' : 'g'}`).join(', ')}
                                </span>
                              )}
                            </span>
                            <span className="ma-entry-kcal">{num(e.kcal, 0)}</span>
                            {items.length ? <Calculator size={13} className="ma-ico" /> : <Pencil size={13} className="ma-ico" />}
                          </button>
                          <button
                            type="button"
                            aria-label={armed ? 'Επιβεβαίωση διαγραφής' : 'Διαγραφή'}
                            disabled={deleteMeal.isPending}
                            className={clsx('ma-del', armed && 'armed')}
                            onClick={act(() => {
                              // Two taps: the first arms the button, the second deletes.
                              if (armed) deleteMeal.mutate(e.id, { onSettled: () => setConfirmDelete(null) })
                              else setConfirmDelete(e.id)
                            })}
                          >
                            {armed ? 'Διαγραφή;' : <Trash2 size={14} />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <SavedMealPicker
        open={!!inserting}
        title={inserting ? `Αποθηκευμένο γεύμα → ${slotLabel(inserting)}` : ''}
        busy={insertMeal.isPending}
        error={insertMeal.error}
        onClose={() => setInserting(null)}
        onPick={(m) => {
          // Inserting a saved meal logs one serving of it, priced with today's food values.
          const e = entryFromRecipe(itemsOf(m.items), m.servings, foods)
          insertMeal.mutate(
            { ...e, date, slot: inserting!, name: m.name, items: e.items as unknown as Json, servings: m.servings },
            { onSuccess: () => setInserting(null) },
          )
        }}
        footer={
          <Button variant="ghost" className="w-full" onClick={() => navigate('/meals')}>
            Διαχείριση γευμάτων
          </Button>
        }
      />

      <MealSheet date={date} editing={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

export function MealSheet(props: { date: ISODate; editing: { slot: MealSlot; entry?: MealEntry } | null; onClose: () => void }) {
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
