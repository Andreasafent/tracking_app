import type { Food, MealSlot } from './database.types'

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

export type Nutrients = { kcal: number; protein: number; carbs: number; fat: number; iron: number; omega3: number }
export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, iron: 0, omega3: 0 }

export function nutrientsOf(food: Food, amount: number): Nutrients {
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

/** Scales a stored line (used when its food no longer exists). */
export function nutrientsOfSaved(item: MealItem, amount: number): Nutrients {
  const f = item.amount ? amount / item.amount : 0
  return { kcal: item.kcal * f, protein: item.protein * f, carbs: item.carbs * f, fat: item.fat * f, iron: 0, omega3: 0 }
}

export const addNutrients = (a: Nutrients, b: Nutrients): Nutrients => ({
  kcal: a.kcal + b.kcal,
  protein: a.protein + b.protein,
  carbs: a.carbs + b.carbs,
  fat: a.fat + b.fat,
  iron: a.iron + b.iron,
  omega3: a.omega3 + b.omega3,
})

export const round1 = (v: number) => Math.round(v * 10) / 10

/** The food a stored line refers to: by id, or by name for older entries. */
export const foodOf = (item: MealItem, foods: Food[]) =>
  (item.foodId && foods.find((f) => f.id === item.foodId)) || foods.find((f) => f.name === item.food) || undefined

/** Builds a stored line from a food (or the old line when the food is gone) and an amount. */
export function itemOf(food: Food | undefined, amount: number, saved?: MealItem): MealItem {
  const n = food ? nutrientsOf(food, amount) : saved ? nutrientsOfSaved(saved, amount) : ZERO
  return {
    foodId: food?.id,
    food: food?.name ?? saved?.food ?? '(διαγραμμένο)',
    amount,
    unit: food?.unit ?? saved?.unit ?? 'g',
    kcal: round1(n.kcal),
    protein: round1(n.protein),
    carbs: round1(n.carbs),
    fat: round1(n.fat),
  }
}

/**
 * A saved meal as a MACROS entry: ingredients re-priced with the current foods, and the entry's
 * numbers per serving (same convention as calculator entries).
 */
export function entryFromRecipe(items: MealItem[], servings: number, foods: Food[]) {
  const lines = items.map((it) => itemOf(foodOf(it, foods), it.amount, it))
  const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => lines.reduce((a, l) => a + l[k], 0) / servings
  return {
    items: lines,
    kcal: Math.round(sum('kcal')),
    protein: round1(sum('protein')),
    carbs: round1(sum('carbs')),
    fat: round1(sum('fat')),
  }
}

/** An ingredient being edited (calculator / saved-meal editor). */
export interface Row {
  foodId: string
  amount: number | null
  /** The stored line, kept when its food no longer exists so the meal still adds up. */
  saved?: MealItem
}

export const rowsOf = (items: MealItem[], foods: Food[]): Row[] =>
  items.map((it) => {
    const food = foodOf(it, foods)
    return food ? { foodId: food.id, amount: it.amount } : { foodId: '', amount: it.amount, saved: it }
  })

export type Line = Row & { food?: Food; n: Nutrients; name: string; unit: string }

export function linesOf(rows: Row[], foodById: Map<string, Food>): Line[] {
  return rows.map((r) => {
    const food = foodById.get(r.foodId)
    const n = !r.amount ? ZERO : food ? nutrientsOf(food, r.amount) : r.saved ? nutrientsOfSaved(r.saved, r.amount) : ZERO
    return { ...r, food, n, name: food?.name ?? r.saved?.food ?? '(διαγραμμένο)', unit: food?.unit ?? r.saved?.unit ?? 'g' }
  })
}

/** The stored form of the edited lines (whole recipe). */
export const itemsOfLines = (lines: Line[]): MealItem[] =>
  lines.filter((l) => l.amount && (l.food || l.saved)).map((l) => itemOf(l.food, l.amount!, l.saved))
