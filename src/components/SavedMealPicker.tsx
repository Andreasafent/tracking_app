import { Search } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useFoods, useSavedMeals } from '../lib/api'
import type { SavedMeal } from '../lib/database.types'
import { num } from '../lib/format'
import { entryFromRecipe, itemsOf } from '../lib/meals'
import { ErrorNote, Sheet } from './ui'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Pick one of the saved meals (ΓΕΥΜΑΤΑ). Shows per-serving kcal with today's food values. */
export function SavedMealPicker(props: {
  open: boolean
  title: string
  onClose: () => void
  onPick: (m: SavedMeal) => void
  busy?: boolean
  error?: unknown
  footer?: ReactNode
}) {
  const meals = useSavedMeals()
  const foods = useFoods().data ?? []
  const [q, setQ] = useState('')
  useEffect(() => {
    if (props.open) setQ('')
  }, [props.open])
  const list = (meals.data ?? []).filter((m) => norm(m.name).includes(norm(q)))

  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.title} footer={props.footer}>
      <ErrorNote error={meals.error ?? props.error} />
      <div className="relative mb-2">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <ul className="divide-y divide-line">
        {list.map((m) => {
          const e = entryFromRecipe(itemsOf(m.items), m.servings, foods)
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={props.busy}
                onClick={() => props.onPick(m)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2 disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {m.name}
                    {m.servings > 1 && <span className="font-normal text-muted"> · 1/{num(m.servings, 0)} μερίδα</span>}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    Π {num(e.protein, 1)} · Υ {num(e.carbs, 1)} · Λ {num(e.fat, 1)}
                  </span>
                </span>
                <span className="text-sm font-bold">
                  {num(e.kcal, 0)} <span className="text-xs font-medium text-muted">kcal</span>
                </span>
              </button>
            </li>
          )
        })}
        {meals.isSuccess && list.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            {meals.data?.length ? 'Δεν βρέθηκε.' : 'Δεν υπάρχουν αποθηκευμένα γεύματα ακόμα.'}
          </li>
        )}
      </ul>
    </Sheet>
  )
}
