import { Check, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import {
  Button,
  ErrorNote,
  Field,
  Hero,
  Loading,
  NumberInput,
  Segmented,
  Sheet,
  Stat,
  Stepper,
  TextInput,
  Widget,
} from '../components/ui'
import { useFoods, useMealEntry, useMeals, useSaveMeal } from '../lib/api'
import type { Food, Json, MealSlot } from '../lib/database.types'
import { addDays, relativeDayLabel, today } from '../lib/dates'
import { num } from '../lib/format'
import { calculatorEntryFor, itemsOf, SLOTS, slotLabel, type MealItem } from '../lib/meals'
import { useSwipe } from '../lib/useSwipe'

interface Row {
  foodId: string
  amount: number | null
  /** The logged line, kept when its food no longer exists so the meal still adds up. */
  saved?: MealItem
}
interface Draft {
  rows: Row[]
  servings: number
  name: string
}

const EMPTY: Draft = { rows: [], servings: 1, name: '' }

// The calculator keeps its contents per meal (like the sheet), so it also works as a viewer.
function loadDraft(slot: MealSlot): Draft {
  try {
    const raw = localStorage.getItem(`calc:${slot}`)
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY
  } catch {
    return EMPTY
  }
}
function storeDraft(slot: MealSlot, d: Draft) {
  try {
    localStorage.setItem(`calc:${slot}`, JSON.stringify(d))
  } catch {
    /* storage unavailable */
  }
}

type Nutrients = { kcal: number; protein: number; carbs: number; fat: number; iron: number; omega3: number }
const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, iron: 0, omega3: 0 }

function nutrientsOf(food: Food, amount: number): Nutrients {
  const f = amount / food.per_amount
  return {
    kcal: food.kcal * f,
    protein: food.protein * f,
    carbs: food.carbs * f,
    fat: food.fat * f,
    iron: (food.iron ?? 0) * f,
    omega3: (food.omega3 ?? 0) * f,
  }
}

function nutrientsOfSaved(item: MealItem, amount: number): Nutrients {
  const f = item.amount ? amount / item.amount : 0
  return { kcal: item.kcal * f, protein: item.protein * f, carbs: item.carbs * f, fat: item.fat * f, iron: 0, omega3: 0 }
}

const add = (a: Nutrients, b: Nutrients): Nutrients => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
  iron: a.iron + b.iron,
  omega3: a.omega3 + b.omega3,
})

const round1 = (v: number) => Math.round(v * 10) / 10

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
  const [logged, setLogged] = useState(false)

  const setParam = (k: string, v: string | null) =>
    setParams(
      (p) => {
        if (v == null) p.delete(k)
        else p.set(k, v)
        return p
      },
      { replace: true },
    )

  // Changing day or slot shows that day/slot's meal (like tapping it in MACROS), never carries
  // the current ingredients over. `pick` marks the switch until that day's meals have loaded.
  const pick = params.get('pick') === '1'
  const dayMeals = useMeals(date)
  const openSlot = (nextSlot: MealSlot, nextDate: string) =>
    setParams(
      (p) => {
        p.set('slot', nextSlot)
        p.set('d', nextDate)
        p.delete('entry')
        p.set('pick', '1')
        return p
      },
      { replace: true },
    )
  useEffect(() => {
    if (!pick || !dayMeals.isSuccess) return
    const target = calculatorEntryFor(dayMeals.data ?? [], slot)
    setParams(
      (p) => {
        p.delete('pick')
        if (target) p.set('entry', target.id)
        return p
      },
      { replace: true },
    )
  }, [pick, dayMeals.isSuccess, dayMeals.data, slot])

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
    const rows = itemsOf(e.items).map((it): Row => {
      const food = (it.foodId && foodById.get(it.foodId)) || foods.find((f) => f.name === it.food)
      return food ? { foodId: food.id, amount: it.amount } : { foodId: '', amount: it.amount, saved: it }
    })
    setDraft({ rows, servings: e.servings ?? 1, name: e.name ?? '' })
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
    setLogged(false)
  }

  const lines = draft.rows.map((r) => {
    const food = foodById.get(r.foodId)
    const n = !r.amount ? ZERO : food ? nutrientsOf(food, r.amount) : r.saved ? nutrientsOfSaved(r.saved, r.amount) : ZERO
    return { ...r, food, n, name: food?.name ?? r.saved?.food ?? '(διαγραμμένο)', unit: food?.unit ?? r.saved?.unit ?? 'g' }
  })
  const totals = lines.reduce((a, l) => add(a, l.n), ZERO)
  const servings = Math.max(1, draft.servings || 1)
  const per = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / servings])) as Nutrients

  function log() {
    // The whole recipe is stored; the entry's own numbers are per serving.
    const items: MealItem[] = lines
      .filter((l) => l.amount && (l.food || l.saved))
      .map((l) => ({
        foodId: l.food?.id,
        food: l.name,
        amount: l.amount!,
        unit: l.unit,
        kcal: round1(l.n.kcal),
        protein: round1(l.n.protein),
        carbs: round1(l.n.carbs),
        fat: round1(l.n.fat),
      }))
    save.mutate(
      {
        id: entryId ?? undefined,
        date,
        slot,
        name: draft.name || null,
        kcal: Math.round(per.kcal),
        protein: round1(per.protein),
        carbs: round1(per.carbs),
        fat: round1(per.fat),
        items: items as unknown as Json,
        servings,
      },
      { onSuccess: () => (editing ? navigate(`/macros?d=${date}`, { replace: true }) : setLogged(true)) },
    )
  }

  if (pick || (editing && (entry.isLoading || (entry.data && loadedFor.current !== entry.data.id)))) return <Loading />

  return (
    <div className="min-h-[calc(100dvh-4rem)] space-y-3" {...swipe}>
      <Hero
        top={
          <div className="space-y-3">
            <Stepper label={relativeDayLabel(date)} onPrev={() => go(-1)} onNext={() => go(1)} />
            <Segmented
              value={slot}
              onChange={(v) => openSlot(v, date)}
              options={SLOTS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
        }
        label={servings > 1 ? `ΘΕΡΜΙΔΕΣ / ΜΕΡΙΔΑ (÷${servings})` : 'ΘΕΡΜΙΔΕΣ'}
        value={
          <span key={date} className={`inline-block ${anim}`}>
            {num(per.kcal, 0)}
          </span>
        }
        unit="kcal"
        sub={
          <>
            {servings > 1 && <div>Σύνολο συνταγής {num(totals.kcal, 0)} kcal</div>}
            {editing && entry.data && (
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-xs font-semibold text-accent">
                <Pencil size={12} /> Επεξεργασία γεύματος
                <button
                  type="button"
                  aria-label="Έξοδος από επεξεργασία"
                  onClick={() => setParam('entry', null)}
                  className="grid size-5 place-items-center rounded-full transition hover:bg-accent hover:text-white"
                >
                  <X size={12} />
                </button>
              </span>
            )}
            {editing && !entry.isLoading && !entry.data && (
              <div className="mt-2 text-xs text-bad">Το γεύμα δεν βρέθηκε (ίσως διαγράφηκε).</div>
            )}
          </>
        }
      />

      <ErrorNote error={save.error ?? entry.error} />

      <Widget title="Ανά μερίδα">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          <Stat label="Πρωτεΐνη" value={num(per.protein, 1)} unit="g" />
          <Stat label="Υδατάνθρ." value={num(per.carbs, 1)} unit="g" />
          <Stat label="Λιπαρά" value={num(per.fat, 1)} unit="g" />
          <Stat label="Σίδηρος" value={num(per.iron, 1)} unit="mg" />
          <Stat label="Ω3" value={num(per.omega3, 2)} unit="g" />
        </div>
      </Widget>

      <Widget
        title="Υλικά"
        action={
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full bg-accent text-white transition hover:brightness-110 active:scale-90"
            aria-label="Προσθήκη τροφίμου"
            onClick={() => setPicker(true)}
          >
            <Plus size={16} />
          </button>
        }
      >
        {lines.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted">Πρόσθεσε τρόφιμα με το +</div>
        ) : (
          <ul className="divide-y divide-line">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{l.name}</div>
                  <div className="text-xs text-muted">
                    {num(l.n.kcal, 0)} kcal · Π {num(l.n.protein, 1)} · Υ {num(l.n.carbs, 1)} · Λ {num(l.n.fat, 1)}
                  </div>
                </div>
                <NumberInput
                  value={l.amount}
                  step={l.unit === 'piece' ? 1 : 10}
                  unit={l.unit === 'piece' ? 'τεμ' : 'g'}
                  onChange={(v) => update({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, amount: v } : r)) })}
                />
                <button
                  type="button"
                  aria-label="Αφαίρεση"
                  className="text-muted transition hover:text-bad active:scale-90"
                  onClick={() => update({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 border-t border-line pt-1">
          <Field label="Μερίδες" hint="Π.χ. meal prep για 3 μέρες">
            <NumberInput value={draft.servings} integer step={1} min={1} onChange={(v) => update({ ...draft, servings: v ?? 1 })} />
          </Field>
          <div className="pt-2">
            <TextInput value={draft.name} onChange={(v) => update({ ...draft, name: v })} placeholder="Όνομα γεύματος (προαιρετικό)" />
          </div>
        </div>
      </Widget>

      <div className="flex gap-2">
        {editing ? (
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Ακύρωση
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => update(EMPTY)}>
            Καθαρισμός
          </Button>
        )}
        {logged ? (
          <Button className="flex-1" variant="ghost" onClick={() => navigate(`/macros?d=${date}`)}>
            <Check size={16} /> Καταχωρήθηκε — προβολή MACROS
          </Button>
        ) : (
          <Button className="flex-1" disabled={per.kcal <= 0 || save.isPending} onClick={log}>
            {editing ? 'Αποθήκευση αλλαγών' : `Log to ${slotLabel(slot)}`}
          </Button>
        )}
      </div>

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

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
// Phones: don't pop the keyboard when the picker opens. Mouse/trackpad: focus search right away.
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

/** Stays open so several ingredients can be added in a row; ↑/↓ + Enter pick without the mouse. */
function FoodPicker(props: {
  open: boolean
  foods: Food[]
  onClose: () => void
  onPick: (f: Food) => void
  onNewFood: (name: string) => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  const list = props.foods.filter((f) => norm(f.name).includes(norm(q)))

  useEffect(() => {
    if (props.open) {
      setQ('')
      setAdded(null)
    }
  }, [props.open])
  useEffect(() => setActive(0), [q])

  function pick(f: Food) {
    props.onPick(f)
    setQ('')
    setAdded(f.name)
  }

  // Arrow keys work whether or not the search field has focus.
  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => {
          const n = list.length
          if (!n) return 0
          return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n
        })
      } else if (e.key === 'Enter' && list[active]) {
        e.preventDefault()
        pick(list[active])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    document.getElementById(`food-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="Επιλογή τροφίμου"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => props.onNewFood(q)}>
            <Plus size={16} /> Νέο τρόφιμο
          </Button>
          <Button className="flex-1" onClick={props.onClose}>
            Τέλος
          </Button>
        </div>
      }
    >
      <div className="relative mb-2">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          autoFocus={finePointer()}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {added && (
        <div className="anim-fade mb-2 flex items-center gap-1.5 text-xs font-semibold text-good">
          <Check size={14} /> Προστέθηκε: {added}
        </div>
      )}
      <ul role="listbox" className="divide-y divide-line">
        {list.map((f, i) => (
          <li key={f.id} id={`food-opt-${i}`} role="option" aria-selected={i === active}>
            <button
              type="button"
              onClick={() => pick(f)}
              onMouseEnter={() => setActive(i)}
              className={`-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-xl px-2 py-3 text-left transition ${
                i === active ? 'bg-surface-2' : ''
              }`}
            >
              <span className="text-sm font-semibold">{f.name}</span>
              <span className="text-xs text-muted">
                {num(f.kcal, 0)} kcal / {f.unit === 'piece' ? `${num(f.per_amount)} τεμ` : `${num(f.per_amount)}g`}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            Δεν βρέθηκε.{' '}
            <button type="button" className="font-semibold text-accent hover:underline" onClick={() => props.onNewFood(q)}>
              Πρόσθεσε «{q}»
            </button>
          </li>
        )}
      </ul>
    </Sheet>
  )
}
