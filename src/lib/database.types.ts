// Generated from the Supabase schema (trimmed to the parts the app uses).
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type DailyLogRow = {
  active_rest: boolean | null
  alcohol: boolean | null
  anxiety: number | null
  arm: number | null
  burn_override: number | null
  calf: number | null
  chest: number | null
  creatine: boolean | null
  date: string
  energy: number | null
  fatigue: number | null
  focus: number | null
  glutes: number | null
  hips: number | null
  hrv: number | null
  hunger: number | null
  injury: boolean | null
  mood: number | null
  motivation: number | null
  notes: string | null
  resting_hr: number | null
  sleep_hours: number | null
  sleep_hr: number | null
  sleep_quality: number | null
  sleepiness: number | null
  steps: number | null
  sugar: boolean | null
  thigh: number | null
  updated_at: string
  user_id: string
  waist: number | null
  water: number | null
  weight: number | null
}

type ActivityRow = {
  archived: boolean
  distance_unit: string | null
  id: string
  key: string | null
  name: string
  sort: number
  user_id: string
}

type FoodRow = {
  carbs: number
  fat: number
  id: string
  iron: number | null
  kcal: number
  name: string
  omega3: number | null
  per_amount: number
  protein: number
  unit: string
  user_id: string
}

type MealEntryRow = {
  carbs: number | null
  created_at: string
  date: string
  fat: number | null
  id: string
  items: Json | null
  kcal: number
  name: string | null
  protein: number | null
  slot: MealSlot
  user_id: string
}

type PeriodRow = {
  burn_estimate: number
  carbs_target: number | null
  fat_target: number | null
  created_at: string
  end_date: string
  id: string
  label: string | null
  notes: string | null
  protein_target: number
  start_date: string
  target_intake: number
  user_id: string
}

type RunPlanWeekRow = {
  end_date: string
  id: string
  notes: string | null
  start_date: string
  target_km: number | null
  target_long_run: number | null
  target_weight_days: number | null
  user_id: string
  week_no: number
}

type WorkoutRow = {
  activity_id: string
  created_at: string
  date: string
  distance: number | null
  duration_min: number | null
  id: string
  notes: string | null
  rpe: number | null
  user_id: string
}

type Nullable<T> = { [K in keyof T]: T[K] | null }
type InsertOf<T, Required extends keyof T> = Partial<T> & Pick<T, Required>

type Table<Row, Req extends keyof Row, Rel = []> = {
  Row: Row
  Insert: InsertOf<Row, Req>
  Update: Partial<Row>
  Relationships: Rel
}

type DailySummaryRow = Nullable<{
  user_id: string
  date: string
  weight: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  target_intake: number
  protein_target: number
  burned: number
  remaining: number
  deficit: number
  creatine: boolean
  water: number
  alcohol: boolean
  sugar: boolean
  sleep_hours: number
  sleep_quality: number
  energy: number
  fatigue: number
  resting_hr: number
  sleep_hr: number
  hrv: number
  run_km: number
  run_min: number
  longest_run_km: number
  bike_km: number
  bike_min: number
  swim_m: number
  swim_min: number
  weights_min: number
  did_weights: boolean
  training_min: number
  rpe: number
  active_rest: boolean
  steps: number
  injury: boolean
  mood: number
  anxiety: number
  motivation: number
  focus: number
  hunger: number
  sleepiness: number
  waist: number
  chest: number
  hips: number
  thigh: number
  calf: number
  glutes: number
  arm: number
  carbs_target: number
  fat_target: number
}>

export type Database = {
  __InternalSupabase: { PostgrestVersion: '14.5' }
  public: {
    Tables: {
      activities: Table<ActivityRow, 'name'>
      daily_log: Table<DailyLogRow, 'date'>
      foods: Table<FoodRow, 'name' | 'kcal'>
      meal_entries: Table<MealEntryRow, 'date' | 'slot'>
      periods: Table<PeriodRow, 'start_date' | 'end_date' | 'target_intake' | 'burn_estimate'>
      run_plan_weeks: Table<RunPlanWeekRow, 'week_no' | 'start_date' | 'end_date'>
      workouts: Table<
        WorkoutRow,
        'date' | 'activity_id',
        [
          {
            foreignKeyName: 'workouts_activity_id_fkey'
            columns: ['activity_id']
            isOneToOne: false
            referencedRelation: 'activities'
            referencedColumns: ['id']
          },
        ]
      >
    }
    Views: {
      daily_summary: { Row: DailySummaryRow; Relationships: [] }
    }
    Functions: { [_ in never]: never }
    Enums: { meal_slot: MealSlot }
    CompositeTypes: { [_ in never]: never }
  }
}

export type DailyLog = DailyLogRow
export type Activity = ActivityRow
export type Food = FoodRow
export type MealEntry = MealEntryRow
export type Period = PeriodRow
export type RunPlanWeek = RunPlanWeekRow
export type Workout = WorkoutRow
export type DailySummary = DailySummaryRow
export type { MealSlot }
