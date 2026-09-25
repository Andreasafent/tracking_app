import { BookmarkPlus, Check, ListPlus, Pencil, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { FoodPicker } from '../components/FoodPicker'
import { Ingredients } from '../components/Ingredients'
import { SavedMealPicker } from '../components/SavedMealPicker'
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
import { useFoods, useMealEntry, useSavedMeals, useSaveMeal, useSaveRow } from '../lib/api'
import type { Json, MealSlot } from '../lib/database.types'
import { addDays, relativeDayLabel, today } from '../lib/dates'
import { num } from '../lib/format'
import {
  addNutrients,
  itemsOf,
  itemsOfLines,
  linesOf,
  round1,
  rowsOf,
  SLOTS,
  slotLabel,
  ZERO,
  type Nutrients,
  type MealItem,
  type Row,
} from '../lib/meals'
import { useSwipe } from '../lib/useSwipe'

interface Draft {
  rows: Row[]
  servings: number
  name: string
}

const EMPTY: Draft = { rows: [], servings: 1, name: '' }

// An unfinished meal is kept per slot until it's logged or cleared, so leaving the page loses nothing.
// Logged meals are never loaded back here on their own: each log is a new entry. Editing one is
// explicit (tapping it in MACROS opens ?entry=<id>).
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

      <Ingredients
        lines={lines}
        onAdd={() => setPicker(true)}
        onAmount={(i, v) => update({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, amount: v } : r)) })}
        onRemove={(i) => update({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}
        actions={
          <button
            type="button"
            aria-label="Από αποθηκευμένα γεύματα"
            title="Από αποθηκευμένα γεύματα"
            className="grid size-8 place-items-center rounded-full bg-surface-2 text-muted transition hover:bg-line hover:text-text active:scale-90"
            onClick={() => setSavedPicker(true)}
          >
            <ListPlus size={16} />
          </button>
        }
      >
        <div className="mt-2 border-t border-line pt-1">
          <Field label="Μερίδες" hint="Π.χ. meal prep για 3 μέρες">
            <NumberInput value={draft.servings} integer step={1} min={1} onChange={(v) => update({ ...draft, servings: v ?? 1 })} />
          </Field>
          <div className="pt-2">
            <TextInput value={draft.name} onChange={(v) => update({ ...draft, name: v })} placeholder="Όνομα γεύματος (προαιρετικό)" />
          </div>
        </div>
      </Ingredients>

      {logged && (
        <button
          type="button"
          onClick={() => navigate(`/macros?d=${date}`)}
          className="anim-fade flex w-full items-center gap-2 rounded-2xl bg-good/15 px-4 py-3 text-left text-sm font-semibold text-good transition hover:bg-good/25"
        >
          <Check size={16} />
          <span className="flex-1">
            Καταχωρήθηκαν {num(logged.kcal, 0)} kcal στο {slotLabel(logged.slot)}
          </span>
          <span className="text-xs">προβολή MACROS →</span>
        </button>
      )}

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

      <SaveAsSheet
        open={saveAs}
        onClose={() => setSaveAs(false)}
        initialName={draft.name}
        items={itemsOfLines(lines)}
        servings={servings}
      />

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

/** Saves the calculator's ingredients as a meal in ΓΕΥΜΑΤΑ (same name → that meal is updated). */
function SaveAsSheet(props: { open: boolean; onClose: () => void; initialName: string; items: MealItem[]; servings: number }) {
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
