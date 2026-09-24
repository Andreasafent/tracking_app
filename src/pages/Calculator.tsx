import { Check, Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, ErrorNote, Field, Hero, NumberInput, Segmented, Sheet, Stat, TextInput, Widget } from '../components/ui'
import { useFoods, useSaveMeal } from '../lib/api'
import type { Food, Json, MealSlot } from '../lib/database.types'
import { fmtDay, today } from '../lib/dates'
import { num } from '../lib/format'
import { SLOTS, slotLabel, type MealItem } from '../lib/meals'

interface Row {
  foodId: string
  amount: number | null
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
  const foods = useFoods().data ?? []
  const save = useSaveMeal()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Draft>(() => loadDraft(slot))
  const [picker, setPicker] = useState(false)
  const [logged, setLogged] = useState(false)

  useEffect(() => setDraft(loadDraft(slot)), [slot])
  const update = (d: Draft) => {
    setDraft(d)
    storeDraft(slot, d)
    setLogged(false)
  }

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const lines = draft.rows.map((r) => {
    const food = foodById.get(r.foodId)
    return { ...r, food, n: food && r.amount ? nutrientsOf(food, r.amount) : ZERO }
  })
  const totals = lines.reduce((a, l) => add(a, l.n), ZERO)
  const servings = Math.max(1, draft.servings || 1)
  const per = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, v / servings])) as Nutrients

  function log() {
    const items: MealItem[] = lines
      .filter((l) => l.food && l.amount)
      .map((l) => ({
        food: l.food!.name,
        amount: round1(l.amount! / servings),
        unit: l.food!.unit,
        kcal: round1(l.n.kcal / servings),
        protein: round1(l.n.protein / servings),
        carbs: round1(l.n.carbs / servings),
        fat: round1(l.n.fat / servings),
      }))
    save.mutate(
      {
        date,
        slot,
        name: draft.name || null,
        kcal: Math.round(per.kcal),
        protein: round1(per.protein),
        carbs: round1(per.carbs),
        fat: round1(per.fat),
        items: items as unknown as Json,
      },
      { onSuccess: () => setLogged(true) },
    )
  }

  return (
    <div className="space-y-3">
      <Hero
        top={
          <Segmented
            value={slot}
            onChange={(v) => setParams((p) => (p.set('slot', v), p), { replace: true })}
            options={SLOTS.map((s) => ({ value: s.value, label: s.label }))}
          />
        }
        label={servings > 1 ? `ΘΕΡΜΙΔΕΣ / ΜΕΡΙΔΑ (÷${servings})` : 'ΘΕΡΜΙΔΕΣ'}
        value={num(per.kcal, 0)}
        unit="kcal"
        sub={servings > 1 ? `Σύνολο συνταγής ${num(totals.kcal, 0)} kcal` : `για ${fmtDay(date)}`}
      />

      <ErrorNote error={save.error} />

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
                  <div className="truncate text-sm font-semibold">{l.food?.name ?? '(διαγραμμένο)'}</div>
                  <div className="text-xs text-muted">
                    {num(l.n.kcal, 0)} kcal · Π {num(l.n.protein, 1)}
                  </div>
                </div>
                <NumberInput
                  value={l.amount}
                  unit={l.food?.unit === 'piece' ? 'τεμ' : 'g'}
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
            <NumberInput value={draft.servings} integer onChange={(v) => update({ ...draft, servings: v ?? 1 })} />
          </Field>
          <div className="pt-2">
            <TextInput value={draft.name} onChange={(v) => update({ ...draft, name: v })} placeholder="Όνομα γεύματος (προαιρετικό)" />
          </div>
        </div>
      </Widget>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => update(EMPTY)}>
          Καθαρισμός
        </Button>
        {logged ? (
          <Button className="flex-1" variant="ghost" onClick={() => navigate(`/macros?d=${date}`)}>
            <Check size={16} /> Καταχωρήθηκε — προβολή MACROS
          </Button>
        ) : (
          <Button className="flex-1" disabled={per.kcal <= 0 || save.isPending} onClick={log}>
            Log to {slotLabel(slot)}
          </Button>
        )}
      </div>

      <FoodPicker
        open={picker}
        foods={foods}
        onClose={() => setPicker(false)}
        onPick={(f) => {
          update({ ...draft, rows: [...draft.rows, { foodId: f.id, amount: f.unit === 'piece' ? 1 : 100 }] })
          setPicker(false)
        }}
      />
    </div>
  )
}

function FoodPicker(props: { open: boolean; foods: Food[]; onClose: () => void; onPick: (f: Food) => void }) {
  const [q, setQ] = useState('')
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const list = props.foods.filter((f) => norm(f.name).includes(norm(q)))
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Επιλογή τροφίμου">
      <div className="relative mb-3">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <ul className="divide-y divide-line">
        {list.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => props.onPick(f)} className="-mx-2 flex w-[calc(100%+1rem)] items-center rounded-xl px-2 py-3 text-left transition hover:bg-surface-2 justify-between">
              <span className="text-sm font-semibold">{f.name}</span>
              <span className="text-xs text-muted">
                {num(f.kcal, 0)} kcal / {f.unit === 'piece' ? `${num(f.per_amount)} τεμ` : `${num(f.per_amount)}g`}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-6 text-center text-sm text-muted">Δεν βρέθηκε — πρόσθεσέ το στα ΤΡΟΦΙΜΑ</li>}
      </ul>
    </Sheet>
  )
}
