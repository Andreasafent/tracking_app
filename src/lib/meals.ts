import type { MealEntry, MealSlot } from './database.types'

export const SLOTS: { value: MealSlot; label: string; color: string }[] = [
  { value: 'breakfast', label: 'ΠΡΩΙ', color: 'var(--series-1)' },
  { value: 'lunch', label: 'ΜΕΣΗΜΕΡΙ', color: 'var(--series-2)' },
  { value: 'dinner', label: 'ΒΡΑΔΥ', color: 'var(--series-3)' },
  { value: 'snack', label: 'SNACKS', color: 'var(--series-4)' },
]

export const slotLabel = (s: MealSlot) => SLOTS.find((x) => x.value === s)!.label

/**
 * One ingredient of a meal logged from the calculator (stored in meal_entries.items).
 * Amounts and nutrients are for the whole recipe; the entry itself holds the per-serving
 * totals and `servings`. Older entries may lack foodId (matched by name when reopened).
 */
export interface MealItem {
  foodId?: string
  food: string
  amount: number
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export const itemsOf = (items: unknown): MealItem[] => (Array.isArray(items) ? (items as MealItem[]) : [])

/**
 * The meal the calculator should open for a slot: breakfast/lunch/dinner with exactly one
 * calculator-made entry reopen it; anything else (empty, quick entries, snacks) starts fresh.
 */
export function calculatorEntryFor(entries: MealEntry[], slot: MealSlot): MealEntry | null {
  if (slot === 'snack') return null
  const inSlot = entries.filter((e) => e.slot === slot)
  return inSlot.length === 1 && itemsOf(inSlot[0].items).length ? inSlot[0] : null
}
