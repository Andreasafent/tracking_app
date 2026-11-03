import type { Expense, ExpenseCategory, ExpenseProduct, Recurrence } from './database.types'
import { parseISO, toISO, type ISODate } from './dates'
import { num } from './format'

export const eur = (v: number | null | undefined) => (v == null ? '—' : `${num(v, 2)} €`)

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: 'weekly', label: 'Εβδομαδιαία' },
  { value: 'monthly', label: 'Μηνιαία' },
  { value: 'quarterly', label: 'Τριμηνιαία' },
  { value: 'semiannual', label: 'Εξαμηνιαία' },
  { value: 'yearly', label: 'Ετήσια' },
]

export const recurrenceLabel = (r: Recurrence | null) => RECURRENCES.find((x) => x.value === r)?.label ?? ''

const MONTH_STEP: Record<Exclude<Recurrence, 'weekly'>, number> = { monthly: 1, quarterly: 3, semiannual: 6, yearly: 12 }

/** The payment date after `from`. Month-based steps keep the day, clamped to the month's end (31 Jan → 28 Feb). */
export function nextDueAfter(from: ISODate, r: Recurrence): ISODate {
  const d = parseISO(from)
  if (r === 'weekly') {
    d.setDate(d.getDate() + 7)
    return toISO(d)
  }
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + MONTH_STEP[r])
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return toISO(d)
}

/** What an expense is called in lists: its title, else the product, else a placeholder. */
export const expenseTitle = (e: Expense, products: ExpenseProduct[]) =>
  e.name || products.find((p) => p.id === e.product_id)?.name || 'Χωρίς τίτλο'

export const OTHER_KEY = '__other'
export const OTHER_LABEL = 'Άλλα έξοδα'
export const OTHER_COLOR = '#8a8f98'

export type CategoryTotal = {
  key: string
  label: string
  color: string
  total: number
  /** Spend per product (or title, for free entries) inside the category, biggest first. */
  items: { label: string; total: number; count: number }[]
}

/** Groups expenses by the category of their product; free entries and uncategorised products go to "Άλλα έξοδα". */
export function groupByCategory(expenses: Expense[], products: ExpenseProduct[], categories: ExpenseCategory[]): CategoryTotal[] {
  const groups = new Map<string, CategoryTotal>()
  for (const e of expenses) {
    const product = products.find((p) => p.id === e.product_id)
    const cat = product?.category_id ? categories.find((c) => c.id === product.category_id) : undefined
    const key = cat?.id ?? OTHER_KEY
    let g = groups.get(key)
    if (!g) {
      g = { key, label: cat?.name ?? OTHER_LABEL, color: cat?.color ?? OTHER_COLOR, total: 0, items: [] }
      groups.set(key, g)
    }
    g.total += e.amount
    const label = e.name || product?.name || 'Χωρίς τίτλο'
    const item = g.items.find((i) => i.label === label)
    if (item) {
      item.total += e.amount
      item.count += 1
    } else g.items.push({ label, total: e.amount, count: 1 })
  }
  const out = [...groups.values()]
  for (const g of out) g.items.sort((a, b) => b.total - a.total)
  return out.sort((a, b) => b.total - a.total)
}
