// All dates in the app are local calendar days as 'YYYY-MM-DD' strings.

export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = (): ISODate => toISO(new Date())

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86_400_000)
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export interface Range {
  from: ISODate
  to: ISODate
}

// ─── Stats weeks: Thursday → Wednesday, numbered from the Thursday on/before Jan 1.
const THURSDAY = 4

function thursdayOnOrBefore(s: ISODate): ISODate {
  const dow = parseISO(s).getDay()
  return addDays(s, -((dow - THURSDAY + 7) % 7))
}

export function statsWeek(s: ISODate): Range & { no: number; year: number } {
  const from = thursdayOnOrBefore(s)
  const year = parseISO(addDays(from, 6)).getFullYear()
  const first = thursdayOnOrBefore(`${year}-01-01`)
  return { from, to: addDays(from, 6), no: diffDays(from, first) / 7 + 1, year }
}

export function statsWeeksOfYear(year: number): (Range & { no: number })[] {
  const out: (Range & { no: number })[] = []
  let from = thursdayOnOrBefore(`${year}-01-01`)
  // A week belongs to the year its Wednesday falls in (matches statsWeek).
  for (let no = 1; parseISO(addDays(from, 6)).getFullYear() === year; no++) {
    out.push({ from, to: addDays(from, 6), no })
    from = addDays(from, 7)
  }
  return out
}

// ─── Months: 7-day blocks from the 1st (1–7, 8–14, 15–21, 22–28, 29–end)
export function monthRange(year: number, month: number): Range {
  const last = new Date(year, month, 0).getDate()
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` }
}

export function monthBlocks(year: number, month: number): Range[] {
  const { to } = monthRange(year, month)
  const last = Number(to.slice(8))
  const blocks: Range[] = []
  for (let start = 1; start <= last; start += 7) {
    const end = Math.min(start + 6, last)
    blocks.push({ from: `${year}-${pad(month)}-${pad(start)}`, to: `${year}-${pad(month)}-${pad(end)}` })
  }
  return blocks
}

// ─── Formatting (Greek)
export const MONTHS = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος',
  'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]
const MONTHS_SHORT = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μαΐ', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ']
const DAYS = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο']

export function fmtDay(s: ISODate): string {
  const d = parseISO(s)
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function fmtShort(s: ISODate): string {
  const d = parseISO(s)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
}

export function fmtRange(r: Range): string {
  return `${fmtShort(r.from)} – ${fmtShort(r.to)}`
}

export function relativeDayLabel(s: ISODate): string {
  const diff = diffDays(s, today())
  if (diff === 0) return 'Σήμερα'
  if (diff === -1) return 'Χθες'
  if (diff === 1) return 'Αύριο'
  return fmtDay(s)
}
