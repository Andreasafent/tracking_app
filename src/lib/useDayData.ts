import { usePeriods, useSummaries, useTrainingPlans } from './api'
import { addDays, eachDay, parseISO, relativeDayLabel, today, type ISODate } from './dates'
import { weight7 } from './stats'
import { daysOf, intakeTarget } from './training'
import { useDateParam } from './useDateParam'

const LETTERS = ['Κ', 'Δ', 'Τ', 'Τ', 'Π', 'Π', 'Σ']

export type WeekDay = { date: ISODate; letter: string; kcal: number | null; target: number | null; selected: boolean }

/** The ΓΕΝΙΚΑ numbers of one day, already shaped for the design variants — all real data. */
export function useDayData() {
  const [date, setDate] = useDateParam()
  const summaries = useSummaries(addDays(date, -13), date)
  const periods = usePeriods().data ?? []
  const plans = useTrainingPlans().data ?? []
  const rows = summaries.data ?? []
  const s = rows.find((r) => r.date === date)
  const periodOf = (d: ISODate) => periods.find((p) => p.start_date <= d && p.end_date >= d)

  const target = intakeTarget(date, plans, periodOf(date)).kcal
  const kcal = s?.kcal ?? 0
  const week: WeekDay[] = eachDay(addDays(date, -6), date).map((d) => {
    const r = rows.find((x) => x.date === d)
    return {
      date: d,
      letter: LETTERS[parseISO(d).getDay()],
      kcal: r?.kcal ? r.kcal : null,
      target: intakeTarget(d, plans, periodOf(d)).kcal,
      selected: d === date,
    }
  })
  const plan = plans.find((p) => p.start_date <= date && p.end_date >= date)
  const trainingDay = plan ? daysOf(plan).find((d) => d.date === date) : undefined

  return {
    date,
    label: relativeDayLabel(date),
    go: (days: number) => setDate(addDays(date, days)),
    goToday: () => setDate(today()),
    isToday: date === today(),
    loading: summaries.isLoading,
    kcal,
    target,
    remaining: target == null ? null : target - kcal,
    macros: [
      { key: 'protein', name: 'Πρωτεΐνη', value: s?.protein ?? 0, target: s?.protein_target ?? null },
      { key: 'carbs', name: 'Υδατάνθρακες', value: s?.carbs ?? 0, target: s?.carbs_target ?? null },
      { key: 'fat', name: 'Λιπαρά', value: s?.fat ?? 0, target: s?.fat_target ?? null },
    ],
    weightAvg: weight7(rows, date),
    weights: rows.filter((r) => r.weight != null).map((r) => r.weight as number),
    steps: s?.steps ?? null,
    sleep: s?.sleep_hours ?? null,
    water: s?.water ?? null,
    creatine: s?.creatine ?? null,
    week,
    training: trainingDay?.exercises.filter(Boolean) ?? [],
    trainingKcal: trainingDay?.kcal ?? null,
  }
}

export type DayData = ReturnType<typeof useDayData>
