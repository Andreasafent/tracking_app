import type { MealSlot } from './database.types'

export const SLOTS: { value: MealSlot; label: string; color: string }[] = [
  { value: 'breakfast', label: 'ΠΡΩΙ', color: 'var(--series-1)' },
  { value: 'lunch', label: 'ΜΕΣΗΜΕΡΙ', color: 'var(--series-2)' },
  { value: 'dinner', label: 'ΒΡΑΔΥ', color: 'var(--series-3)' },
  { value: 'snack', label: 'SNACKS', color: 'var(--series-4)' },
]

export const slotLabel = (s: MealSlot) => SLOTS.find((x) => x.value === s)!.label

/** A food line logged from the calculator (stored in meal_entries.items). */
export interface MealItem {
  food: string
  amount: number
  unit: string
  kcal: number
  protein: number
  carbs: number
  fat: number
}
