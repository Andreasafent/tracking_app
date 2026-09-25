import { Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { FoodPicker } from '../components/FoodPicker'
import { Ingredients } from '../components/Ingredients'
import { Button, ErrorNote, Field, Hero, Loading, NumberInput, QuickAction, QuickActions, Stat, TextInput, Widget } from '../components/ui'
import { useDeleteRow, useFoods, useSavedMeals, useSaveRow } from '../lib/api'
import type { Json, SavedMeal } from '../lib/database.types'
import { num } from '../lib/format'
import { addNutrients, entryFromRecipe, itemsOf, itemsOfLines, linesOf, rowsOf, ZERO, type Row } from '../lib/meals'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Saved meals (recipes) to insert from MACROS. ?edit=<id|new> shows the editor. */
export function Meals() {
  const [params, setParams] = useSearchParams()
  const edit = params.get('edit')
  const meals = useSavedMeals()
  const foods = useFoods().data ?? []
  const [q, setQ] = useState('')
  const open = (id: string) => setParams({ edit: id })

  if (edit) {
    if (meals.isLoading) return <Loading />
    const meal = edit === 'new' ? null : (meals.data?.find((m) => m.id === edit) ?? null)
    return <MealEditor key={edit} meal={meal} />
  }

  const list = (meals.data ?? []).filter((m) => norm(m.name).includes(norm(q)))
  return (
    <div className="space-y-3">
      <Hero label="ΓΕΥΜΑΤΑ" value={num(meals.data?.length ?? 0, 0)} sub="αποθηκευμένα για γρήγορη προσθήκη στο MACROS">
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Νέο" onClick={() => open('new')} />
        </QuickActions>
      </Hero>
      <ErrorNote error={meals.error} />

      <div className="relative">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-2xl bg-surface pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <Widget title={`${list.length} γεύματα`}>
        {meals.isSuccess && list.length === 0 && (
          <div className="py-4 text-center text-sm text-muted">
            {meals.data?.length ? 'Δεν βρέθηκε.' : 'Φτιάξε ένα με το «Νέο» ή από το Calculator (αποθήκευση ως γεύμα).'}
          </div>
        )}
        <ul className="divide-y divide-line">
          {list.map((m) => {
            const items = itemsOf(m.items)
            const e = entryFromRecipe(items, m.servings, foods)
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => open(m.id)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">
                      {m.name}
                      {m.servings > 1 && <span className="font-normal text-muted"> · {num(m.servings, 0)} μερίδες</span>}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {items.map((it) => `${it.food} ${num(it.amount, 0)}${it.unit === 'piece' ? 'τεμ' : 'g'}`).join(', ')}
                    </div>
                  </div>
                  <div className="text-right text-sm font-bold">
                    {num(e.kcal, 0)} <span className="text-xs font-medium text-muted">kcal</span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </Widget>
    </div>
  )
}

type EditorDraft = { name: string; servings: number; rows: Row[] }
function readDraft(key: string): EditorDraft | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as EditorDraft) : null
  } catch {
    return null
  }
}
function writeDraft(key: string, d: EditorDraft | null) {
  try {
    if (d) sessionStorage.setItem(key, JSON.stringify(d))
    else sessionStorage.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}

function MealEditor(props: { meal: SavedMeal | null }) {
  const navigate = useNavigate()
  const foodsQ = useFoods()
  const foods = foodsQ.data ?? []
  const save = useSaveRow('saved_meals')
  const del = useDeleteRow('saved_meals')
  const draftKey = `meal-draft:${props.meal?.id ?? 'new'}`
  const [draft] = useState(() => readDraft(draftKey))
  const [name, setName] = useState(draft?.name ?? props.meal?.name ?? '')
  const [servings, setServings] = useState<number>(draft?.servings ?? props.meal?.servings ?? 1)
  const [rows, setRows] = useState<Row[]>(draft?.rows ?? [])
  const others = useSavedMeals().data?.filter((m) => m.id !== props.meal?.id) ?? []
  const taken = others.some((m) => norm(m.name.trim()) === norm(name.trim()))
  const [picker, setPicker] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Ingredients need the foods list to match up; load them once it's there.
  const [loaded, setLoaded] = useState(!!draft)
  useEffect(() => {
    if (loaded || !foodsQ.isSuccess) return
    setRows(rowsOf(itemsOf(props.meal?.items), foods))
    setLoaded(true)
  }, [foodsQ.isSuccess])
  // Kept for this tab only, so adding a new food in ΤΡΟΦΙΜΑ and coming back loses nothing.
  useEffect(() => {
    if (loaded) writeDraft(draftKey, { name, servings, rows })
  }, [loaded, name, servings, rows])

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods])
  const lines = linesOf(rows, foodById)
  const totals = lines.reduce((a, l) => addNutrients(a, l.n), ZERO)
  const n = Math.max(1, servings || 1)
  const back = () => {
    writeDraft(draftKey, null)
    navigate('/meals', { replace: true })
  }

  if (!loaded) return <Loading />

  return (
    <div className="space-y-3">
      <Hero
        label={n > 1 ? `ΘΕΡΜΙΔΕΣ / ΜΕΡΙΔΑ (÷${n})` : 'ΘΕΡΜΙΔΕΣ'}
        value={num(totals.kcal / n, 0)}
        unit="kcal"
        sub={props.meal ? 'Επεξεργασία γεύματος' : 'Νέο γεύμα'}
      />
      <ErrorNote error={save.error ?? del.error} />

      <Widget title="Ανά μερίδα">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Πρωτεΐνη" value={num(totals.protein / n, 1)} unit="g" />
          <Stat label="Υδατάνθρ." value={num(totals.carbs / n, 1)} unit="g" />
          <Stat label="Λιπαρά" value={num(totals.fat / n, 1)} unit="g" />
        </div>
      </Widget>

      <Widget title="Γεύμα">
        <TextInput value={name} onChange={setName} placeholder="Όνομα (π.χ. Κοτόπουλο με ρύζι)" />
        {taken && <div className="mt-1 text-xs text-bad">Υπάρχει ήδη γεύμα με αυτό το όνομα.</div>}
        <Field label="Μερίδες" hint="Στο MACROS καταχωρείται 1 μερίδα">
          <NumberInput value={servings} integer step={1} min={1} onChange={(v) => setServings(v ?? 1)} />
        </Field>
      </Widget>

      <Ingredients
        lines={lines}
        onAdd={() => setPicker(true)}
        onAmount={(i, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, amount: v } : r)))}
        onRemove={(i) => setRows((rs) => rs.filter((_, j) => j !== i))}
      />

      <div className="flex gap-2">
        {props.meal ? (
          <Button
            variant="danger"
            disabled={del.isPending}
            onClick={() => (confirmDelete ? del.mutate(props.meal!.id, { onSuccess: back }) : setConfirmDelete(true))}
          >
            {confirmDelete ? 'Διαγραφή;' : <Trash2 size={16} />}
          </Button>
        ) : (
          <Button variant="ghost" onClick={back}>
            Ακύρωση
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!name.trim() || taken || !lines.length || save.isPending}
          onClick={() =>
            save.mutate(
              { id: props.meal?.id, name: name.trim(), servings: n, items: itemsOfLines(lines) as unknown as Json },
              { onSuccess: back },
            )
          }
        >
          Αποθήκευση
        </Button>
      </div>

      <FoodPicker
        open={picker}
        foods={foods}
        onClose={() => setPicker(false)}
        onPick={(f) => setRows((rs) => [...rs, { foodId: f.id, amount: f.unit === 'piece' ? 1 : 100 }])}
        onNewFood={(q) => navigate(`/foods?new=${encodeURIComponent(q)}&back=1`)}
      />
    </div>
  )
}
