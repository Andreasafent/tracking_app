import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { must, supabase } from './supabase'
import type { Database, DailyLog, Json, MealSlot } from './database.types'
import type { ISODate } from './dates'

type Tables = Database['public']['Tables']
type Insert<T extends keyof Tables> = Tables[T]['Insert']
type Update<T extends keyof Tables> = Tables[T]['Update']

// ─── Queries

/** All daily summaries in a date range (inclusive). Stats pages pull the whole year. */
export function useSummaries(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: ['summary', from, to],
    queryFn: async () =>
      must(await supabase.from('daily_summary').select('*').gte('date', from).lte('date', to).order('date')),
  })
}

export function useDailyLog(date: ISODate) {
  return useQuery({
    queryKey: ['daily_log', date],
    queryFn: async () => must(await supabase.from('daily_log').select('*').eq('date', date).maybeSingle()),
  })
}

export function useMeals(date: ISODate) {
  return useQuery({
    queryKey: ['meals', date],
    queryFn: async () =>
      must(await supabase.from('meal_entries').select('*').eq('date', date).order('created_at')),
  })
}

export function useWorkouts(date: ISODate) {
  return useQuery({
    queryKey: ['workouts', date],
    queryFn: async () =>
      must(await supabase.from('workouts').select('*').eq('date', date).order('created_at')),
  })
}

export function useActivities() {
  return useQuery({
    queryKey: ['activities'],
    queryFn: async () => must(await supabase.from('activities').select('*').order('sort').order('name')),
    staleTime: Infinity,
  })
}

export function useFoods() {
  return useQuery({
    queryKey: ['foods'],
    queryFn: async () => must(await supabase.from('foods').select('*').order('name')),
    staleTime: Infinity,
  })
}

export function usePeriods() {
  return useQuery({
    queryKey: ['periods'],
    queryFn: async () => must(await supabase.from('periods').select('*').order('start_date')),
  })
}

export function useRunPlan() {
  return useQuery({
    queryKey: ['run_plan'],
    queryFn: async () => must(await supabase.from('run_plan_weeks').select('*').order('week_no')),
  })
}

// ─── Mutations. Every write invalidates the summaries, since they're all derived.

function useWrite<V>(fn: (v: V) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of [...keys, 'summary']) qc.invalidateQueries({ queryKey: [k] })
    },
  })
}

export function useSaveDailyLog() {
  return useWrite(
    async (v: Partial<DailyLog> & { date: ISODate }) =>
      must(await supabase.from('daily_log').upsert({ ...v, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })),
    ['daily_log'],
  )
}

export type MealInput = {
  date: ISODate
  slot: MealSlot
  name?: string | null
  kcal: number
  protein?: number | null
  carbs?: number | null
  fat?: number | null
  items?: Json | null
}

export function useSaveMeal() {
  return useWrite(
    async ({ id, ...v }: MealInput & { id?: string }) =>
      id
        ? must(await supabase.from('meal_entries').update(v).eq('id', id))
        : must(await supabase.from('meal_entries').insert(v)),
    ['meals'],
  )
}

export function useDeleteMeal() {
  return useWrite(async (id: string) => must(await supabase.from('meal_entries').delete().eq('id', id)), ['meals'])
}

export function useSaveWorkout() {
  return useWrite(
    async ({ id, ...v }: Insert<'workouts'> & { id?: string }) =>
      id
        ? must(await supabase.from('workouts').update(v).eq('id', id))
        : must(await supabase.from('workouts').insert(v)),
    ['workouts'],
  )
}

export function useDeleteWorkout() {
  return useWrite(async (id: string) => must(await supabase.from('workouts').delete().eq('id', id)), ['workouts'])
}

/** Generic save/delete for the simple CRUD tables. */
type CrudTable = 'foods' | 'periods' | 'run_plan_weeks' | 'activities'
const crudKey: Record<CrudTable, string> = {
  foods: 'foods',
  periods: 'periods',
  run_plan_weeks: 'run_plan',
  activities: 'activities',
}

export function useSaveRow<T extends CrudTable>(table: T) {
  return useWrite(async ({ id, ...v }: Insert<T> & Update<T> & { id?: string }) => {
    // The generic table name defeats supabase-js's per-table typing; values are typed by the caller.
    const q = supabase.from(table as 'foods')
    return id
      ? must(await q.update(v as Update<'foods'>).eq('id', id))
      : must(await q.insert(v as Insert<'foods'>))
  }, [crudKey[table]])
}

export function useDeleteRow(table: CrudTable) {
  return useWrite(async (id: string) => must(await supabase.from(table).delete().eq('id', id)), [crudKey[table]])
}
