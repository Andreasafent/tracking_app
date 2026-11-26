import type { Reminder } from './database.types'
import { addDays, diffDays, parseISO, toISO, type ISODate } from './dates'

type Schedule = Pick<Reminder, 'start_date' | 'repeat_unit' | 'repeat_every' | 'lead_days' | 'auto_photo' | 'done_through'>

/** Same day-of-month n months later, clamped to the month's last day (31/1 → 28/2). */
function addMonths(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return toISO(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)))
}

/** The last occurrence on or before `day` and the first one after it. */
export function occurrences(r: Schedule, day: ISODate): { last: ISODate | null; next: ISODate | null } {
  const start = r.start_date
  if (day < start) return { last: null, next: start }
  if (!r.repeat_unit) return { last: start, next: null }

  if (r.repeat_unit === 'month') {
    let i = 0
    while (addMonths(start, (i + 1) * r.repeat_every) <= day) i++
    return { last: addMonths(start, i * r.repeat_every), next: addMonths(start, (i + 1) * r.repeat_every) }
  }
  const step = r.repeat_every * (r.repeat_unit === 'week' ? 7 : 1)
  const last = addDays(start, Math.floor(diffDays(day, start) / step) * step)
  return { last, next: addDays(last, step) }
}

export type ReminderState = {
  date: ISODate
  state: 'upcoming' | 'due' | 'overdue'
}

/**
 * What to show today, or null. A missed occurrence stays until it's marked done (or the next
 * one replaces it); the next one appears lead_days before its date.
 */
export function reminderState(r: Schedule, today: ISODate, lastPhoto: ISODate | null): ReminderState | null {
  // An early photo only counts within the lead time, and never reaches back into the previous period.
  const period = r.repeat_unit ? r.repeat_every * { day: 1, week: 7, month: 28 }[r.repeat_unit] : Infinity
  const early = Math.min(r.lead_days, period - 1)
  const done = (date: ISODate) =>
    (r.done_through != null && r.done_through >= date) ||
    (r.auto_photo && lastPhoto != null && lastPhoto >= addDays(date, -early))

  const { last, next } = occurrences(r, today)
  if (last && !done(last)) return { date: last, state: last === today ? 'due' : 'overdue' }
  if (next && diffDays(next, today) <= r.lead_days && !done(next)) return { date: next, state: 'upcoming' }
  return null
}

const UNIT_LABELS = {
  day: ['Κάθε μέρα', 'ημέρες'],
  week: ['Κάθε εβδομάδα', 'εβδομάδες'],
  month: ['Κάθε μήνα', 'μήνες'],
} as const

export function repeatLabel(r: Pick<Reminder, 'repeat_unit' | 'repeat_every'>): string {
  if (!r.repeat_unit) return 'Μία φορά'
  const [one, many] = UNIT_LABELS[r.repeat_unit]
  return r.repeat_every === 1 ? one : `Κάθε ${r.repeat_every} ${many}`
}
