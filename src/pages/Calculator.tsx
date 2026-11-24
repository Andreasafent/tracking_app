import { BookmarkPlus, Check, ChevronLeft, ChevronRight, ListPlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { FoodPicker } from '../components/FoodPicker'
import { SavedMealPicker } from '../components/SavedMealPicker'
import { Button, ErrorNote, Field, Loading, NumberInput, Segmented, TextInput, Sheet } from '../components/ui'
import { useFoods, useMealEntry, useMeals, usePeriods, useSaveMeal, useTrainingPlans, useSavedMeals, useSaveRow } from '../lib/api'
import type { Json, MealSlot } from '../lib/database.types'
import { addDays, fmtDay, relativeDayLabel, today } from '../lib/dates'
import { num } from '../lib/format'
import { addNutrients, itemsOf, itemsOfLines, linesOf, round1, rowsOf, SLOTS, slotLabel, ZERO, type Nutrients, type Row, type MealItem } from '../lib/meals'
import { intakeTarget, macroTargets } from '../lib/training'
import { useSwipe } from '../lib/useSwipe'
import '../styles/pages.css'

/** Builds a meal from foods and logs it. The unfinished meal is kept per slot, so leaving the page loses nothing. */
export function Calculator() {
  const [params, setParams] = useSearchParams()
  const slot = (SLOTS.some((s) => s.value === params.get('slot')) ? params.get('slot') : 'breakfast') as MealSlot
  const date = params.get('d') ?? today()
  // ?entry=<id>: editing a meal logged earlier. Its draft lives in memory only, not in the per-slot draft.
  const entryId = params.get('entry')
  const editing = !!entryId
  const entry = useMealEntry(entryId)
  const foodsQ = useFoods()
  const foods = foodsQ.data ?? []
  const save = useSaveMeal()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(() => (editing ? EMPTY : loadDraft(slot)))
  const draftRef = useRef(draft)
  draftRef.current = draft
  const [picker, setPicker] = useState(false)
  const [savedPicker, setSavedPicker] = useState(false)
  const [saveAs, setSaveAs] = useState(false)
  const [logged, setLogged] = useState<{ kcal: number; slot: MealSlot } | null>(null)

  const setParam = (k: string, v: string | null) =>
    setParams(
      (p) => {
        if (v == null) p.delete(k)
        else p.set(k, v)
        return p
      },
      { replace: true },
    )

  // Changing day or slot picks where the next log goes (and leaves edit mode).
  const openSlot = (nextSlot: MealSlot, nextDate: string) => {
    setLogged(null)
    setParams(
      (p) => {
        p.set('slot', nextSlot)
        p.set('d', nextDate)
        p.delete('entry')
        return p
      },
      { replace: true },
    )
  }

  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const go = (days: number) => {
    setDir(days > 0 ? 'next' : 'prev')
    openSlot(slot, addDays(date, days))
  }
  const swipe = useSwipe(() => go(1), () => go(-1))
  const anim = dir === 'next' ? 'anim-from-right' : dir === 'prev' ? 'anim-from-left' : ''

  useEffect(() => {
    if (!editing) setDraft(loadDraft(slot))
  }, [slot, editing])

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])

  // Load the edited meal once: its ingredients, servings, name, and its own slot/date.
  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!entryId) loadedFor.current = null
  }, [entryId])
  useEffect(() => {
    const e = entry.data
    if (!e || !foodsQ.isSuccess || loadedFor.current === e.id) return
    loadedFor.current = e.id
    setDraft({ rows: rowsOf(itemsOf(e.items), foods), servings: e.servings ?? 1, name: e.name ?? '' })
    setParams(
      (p) => {
        p.set('slot', e.slot)
        p.set('d', e.date)
        return p
      },
      { replace: true },
    )
  }, [entry.data, foodsQ.isSuccess])

  const update = (d: Draft) => {
    draftRef.current = d
    setDraft(d)
    if (!editing) storeDraft(slot, d)
    setLogged(null)
  }

  // What is left of the day's calories, before and after this meal (an edited meal doesn't count twice).
  const dayMeals = useMeals(date).data ?? []
  const period = usePeriods().data?.find((p) => p.start_date <= date && p.end_date >= date)
  const plans = useTrainingPlans().data ?? []
  const target = intakeTarget(date, plans, period).kcal
  const macroGoal = macroTargets(date, plans, period)

  const lines = linesOf(draft.rows, foodById)
  const totals = lines.reduce((a, l) => addNutrients(a, l.n), ZERO)
  const servings = Math.max(1, draft.servings || 1)
  const per = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / servings])) as Nutrients

  function log() {
    // The whole recipe is stored; the entry's own numbers are per serving.
    const kcal = Math.round(per.kcal)
    save.mutate(
      {
        id: entryId ?? undefined,
        date,
        slot,
        name: draft.name || null,
        kcal,
        protein: round1(per.protein),
        carbs: round1(per.carbs),
        fat: round1(per.fat),
        items: itemsOfLines(lines) as unknown as Json,
        servings,
      },
      {
        onSuccess: () => {
          if (editing) return navigate(`/macros?d=${date}`, { replace: true })
          // Start empty for the next meal (e.g. a second lunch item).
          update(EMPTY)
          setLogged({ kcal, slot })
        },
      },
    )
  }

  if (editing && (entry.isLoading || (entry.data && loadedFor.current !== entry.data.id))) return <Loading />

  const loggedOthers = dayMeals.reduce((a, m) => a + (m.id === entryId ? 0 : m.kcal), 0)
  const dayLeft = target == null ? null : target - loggedOthers
  const dayLeftAfter = dayLeft == null ? null : dayLeft - per.kcal

  // Where the calories come from: protein and carbs 4 kcal/g, fat 9 kcal/g.
  const energy = [per.protein * 4, per.carbs * 4, per.fat * 9]
  const energySum = energy.reduce((a, b) => a + b, 0)
  // Grams of each macro left for the day, before and after this meal (an edited meal doesn't count twice).
  const eatenOthers = (k: 'protein' | 'carbs' | 'fat') => dayMeals.reduce((a, m) => a + (m.id === entryId ? 0 : (m[k] ?? 0)), 0)
  const left = (k: 'protein' | 'carbs' | 'fat') => {
    const goal = macroGoal[k]
    if (goal == null) return null
    const before = goal - eatenOthers(k)
    return { before, after: before - per[k] }
  }
  const shares = [
    { name: 'Πρωτεΐνη', g: per.protein, color: '#17503B', e: energy[0], left: left('protein') },
    { name: 'Υδατάνθρακες', g: per.carbs, color: '#5FAE88', e: energy[1], left: left('carbs') },
    { name: 'Λιπαρά', g: per.fat, color: '#131512', e: energy[2], left: left('fat') },
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
              openSlot(slot, today())
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

      <div className="ca-slot">
        <Segmented value={slot} onChange={(v) => openSlot(v, date)} options={SLOTS.map((s) => ({ value: s.value, label: s.label }))} />
      </div>

      <ErrorNote error={save.error ?? entry.error} />

      <div key={date} className={anim}>
        <div className="da-grid">
          <section className="da-card da-dark da-span2">
            <div className="da-row">
              <span>{servings > 1 ? `Θερμίδες ανά μερίδα (÷${servings})` : 'Θερμίδες'}</span>
              {editing && entry.data && (
                <span className="da-chip">
                  <Pencil size={12} /> Επεξεργασία
                  <button type="button" aria-label="Έξοδος από επεξεργασία" onClick={() => setParam('entry', null)}>
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
            <div className="da-num da-hero">
              {num(per.kcal, 0)}
              <small>kcal</small>
            </div>
            {servings > 1 && <div className="da-caption">σύνολο συνταγής {num(totals.kcal, 0)} kcal</div>}
            {dayLeft != null && (
              <div className="da-caption ca-dayleft">
                υπόλοιπο ημέρας <b>{num(dayLeft, 0)}</b>
                {per.kcal > 0 && (
                  <>
                    {' '}
                    → <b className={dayLeftAfter! < 0 ? 'over' : ''}>{num(dayLeftAfter, 0)}</b> μετά από αυτό
                  </>
                )}
              </div>
            )}
            {editing && !entry.isLoading && !entry.data && (
              <div className="da-notice">Το γεύμα δεν βρέθηκε (ίσως διαγράφηκε).</div>
            )}
          </section>

          <section className="da-card da-span2">
            <h3>Ανά μερίδα</h3>
            <div className="ma-stack">
              {energySum > 0 && shares.map((s) => <i key={s.name} style={{ width: `${(s.e / energySum) * 100}%`, background: s.color }} />)}
            </div>
            <dl className="da-rows">
              {shares.map((s) => (
                <div key={s.name}>
                  <dt>
                    <span className="ma-dot" style={{ background: s.color }} />
                    {s.name}
                  </dt>
                  <dd>
                    {num(s.g, 1)} g{energySum > 0 ? <span className="da-dim"> · {Math.round((s.e / energySum) * 100)}%</span> : null}
                    {s.left && (
                      <span className={'ca-rem' + (s.left.after < 0 ? ' over' : '')}>
                        {s.left.after < 0
                          ? `+${num(-s.left.after, 0)} g πάνω από τον στόχο`
                          : `μένουν ${num(s.left.before, 0)} → ${num(s.left.after, 0)} g`}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Σίδηρος</dt>
                <dd>{num(per.iron, 1)} mg</dd>
              </div>
              <div>
                <dt>Ω3</dt>
                <dd>{num(per.omega3, 2)} g</dd>
              </div>
            </dl>
          </section>

          <section className="da-card da-full">
            <div className="ma-head">
              <h3>Υλικά{lines.length ? ` (${lines.length})` : ''}</h3>
              <div className="ma-actions">
                <button type="button" className="ma-btn" aria-label="Από αποθηκευμένα γεύματα" title="Από αποθηκευμένα γεύματα" onClick={() => setSavedPicker(true)}>
                  <ListPlus size={16} />
                </button>
                <button type="button" className="ma-btn ma-btn-ink" aria-label="Προσθήκη τροφίμου" onClick={() => setPicker(true)}>
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {lines.length === 0 ? (
              <p className="da-empty ca-empty">Πρόσθεσε τρόφιμα με το +</p>
            ) : (
              <ul className="ca-lines">
                {lines.map((l, i) => (
                  <li key={i} className="ca-line">
                    <span className="ca-line-text">
                      <span className="ca-line-name">{l.name}</span>
                      <span className="ca-line-sub">
                        {num(l.n.kcal, 0)} kcal · Π {num(l.n.protein, 1)} · Υ {num(l.n.carbs, 1)} · Λ {num(l.n.fat, 1)}
                      </span>
                    </span>
                    <span className="ca-line-amt">
                      <NumberInput
                        value={l.amount}
                        step={l.unit === 'piece' ? 1 : 10}
                        unit={l.unit === 'piece' ? 'τεμ' : 'g'}
                        onChange={(v) => update({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, amount: v } : r)) })}
                      />
                    </span>
                    <button
                      type="button"
                      aria-label="Αφαίρεση"
                      className="ma-del"
                      onClick={() => update({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="ca-fields">
              <Field label="Μερίδες" hint="Π.χ. meal prep για 3 μέρες">
                <NumberInput value={draft.servings} integer step={1} min={1} onChange={(v) => update({ ...draft, servings: v ?? 1 })} />
              </Field>
              <TextInput value={draft.name} onChange={(v) => update({ ...draft, name: v })} placeholder="Όνομα γεύματος (προαιρετικό)" />
            </div>
          </section>
        </div>
      </div>

      {logged && (
        <button type="button" onClick={() => navigate(`/macros?d=${date}`)} className="anim-fade ca-done">
          <Check size={16} />
          <span>
            Καταχωρήθηκαν {num(logged.kcal, 0)} kcal στο {slotLabel(logged.slot)}
          </span>
          <b>MACROS →</b>
        </button>
      )}

      <div className="ca-actions">
        {editing ? (
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Ακύρωση
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => update(EMPTY)}>
            Καθαρισμός
          </Button>
        )}
        <Button variant="ghost" disabled={!lines.length} onClick={() => setSaveAs(true)}>
          <BookmarkPlus size={16} />
          <span className="sr-only">Αποθήκευση ως γεύμα</span>
        </Button>
        <Button className="flex-1" disabled={per.kcal <= 0 || save.isPending} onClick={log}>
          {editing ? 'Αποθήκευση αλλαγών' : `Log to ${slotLabel(slot)}`}
        </Button>
      </div>

      <SavedMealPicker
        open={savedPicker}
        title="Φόρτωση αποθηκευμένου γεύματος"
        onClose={() => setSavedPicker(false)}
        onPick={(m) => {
          update({ rows: rowsOf(itemsOf(m.items), foods), servings: m.servings, name: m.name })
          setSavedPicker(false)
        }}
      />

      <SaveAsSheet open={saveAs} onClose={() => setSaveAs(false)} initialName={draft.name} items={itemsOfLines(lines)} servings={servings} />

      <FoodPicker
        open={picker}
        foods={foods}
        onClose={() => setPicker(false)}
        onPick={(f) =>
          update({
            ...draftRef.current,
            rows: [...draftRef.current.rows, { foodId: f.id, amount: f.unit === 'piece' ? 1 : 100 }],
          })
        }
        onNewFood={(name) => navigate(`/foods?new=${encodeURIComponent(name)}&back=1`)}
      />
    </div>
  )
}

export interface Draft {
  rows: Row[]
  servings: number
  name: string
}

export const EMPTY: Draft = { rows: [], servings: 1, name: '' }

// An unfinished meal is kept per slot until it's logged or cleared, so leaving the page loses nothing.
// Logged meals are never loaded back here on their own: each log is a new entry. Editing one is
// explicit (tapping it in MACROS opens ?entry=<id>).
export function loadDraft(slot: MealSlot): Draft {
  try {
    const raw = localStorage.getItem(`calc:${slot}`)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}
export function storeDraft(slot: MealSlot, d: Draft) {
  try {
    localStorage.setItem(`calc:${slot}`, JSON.stringify(d))
  } catch {
    /* storage unavailable */
  }
}

/** Saves the calculator's ingredients as a meal in ΓΕΥΜΑΤΑ (same name → that meal is updated). */
export function SaveAsSheet(props: { open: boolean; onClose: () => void; initialName: string; items: MealItem[]; servings: number }) {
  const saved = useSavedMeals().data ?? []
  const save = useSaveRow('saved_meals')
  const [name, setName] = useState('')
  useEffect(() => {
    if (props.open) {
      setName(props.initialName)
      save.reset()
    }
  }, [props.open])
  const existing = saved.find((m) => m.name.trim().toLowerCase() === name.trim().toLowerCase())

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="Αποθήκευση ως γεύμα"
      footer={
        <Button
          className="w-full"
          disabled={!name.trim() || save.isPending}
          onClick={() =>
            save.mutate(
              { id: existing?.id, name: existing?.name ?? name.trim(), items: props.items as unknown as Json, servings: props.servings },
              { onSuccess: props.onClose },
            )
          }
        >
          {existing ? `Ενημέρωση «${existing.name}»` : 'Αποθήκευση'}
        </Button>
      }
    >
      <ErrorNote error={save.error} />
      <TextInput value={name} onChange={setName} placeholder="Όνομα (π.χ. Κοτόπουλο με ρύζι)" />
      <p className="mt-3 text-xs text-muted">
        {props.items.length} υλικά · {num(props.servings, 0)} {props.servings === 1 ? 'μερίδα' : 'μερίδες'}. Θα εμφανίζεται στα
        ΓΕΥΜΑΤΑ και στο MACROS για γρήγορη προσθήκη.
      </p>
    </Sheet>
  )
}
