import { Activity, Brain, Calculator, ChevronRight, Dumbbell, HeartPulse, Plus, Ruler, Salad, Scale as ScaleIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { GroupSheet, type GroupKey } from '../components/DailyFields'
import { WorkoutSheet } from '../components/WorkoutSheet'
import { Chip, ErrorNote, Grid, Hero, MacroRing, QuickAction, QuickActions, Stat, Stepper, Widget } from '../components/ui'
import { useActivities, useDailyLog, usePeriods, useSummaries, useWorkouts } from '../lib/api'
import { addDays, relativeDayLabel, today } from '../lib/dates'
import { num, signed } from '../lib/format'
import { weight7 } from '../lib/stats'
import { useDateParam } from '../lib/useDateParam'
import { useSwipe } from '../lib/useSwipe'

export function Genika() {
  const [date, setDate] = useDateParam()
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupKey | null>(null)
  const [gymOpen, setGymOpen] = useState(false)
  // Direction of the last day change, so the new day slides in from the matching side.
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const go = (days: number) => {
    setDir(days > 0 ? 'next' : 'prev')
    setDate(addDays(date, days))
  }
  const swipe = useSwipe(() => go(1), () => go(-1))
  const anim = dir === 'next' ? 'anim-from-right' : dir === 'prev' ? 'anim-from-left' : ''

  const summaries = useSummaries(addDays(date, -6), date)
  const log = useDailyLog(date).data
  const workouts = useWorkouts(date).data ?? []
  const activities = useActivities().data ?? []

  const rows = summaries.data ?? []
  const s = rows.find((r) => r.date === date)
  const w7 = weight7(rows, date)

  // Days with no data yet have no summary row, so fall back to the period covering the date.
  const period = usePeriods().data?.find((p) => p.start_date <= date && p.end_date >= date)
  const target = s?.target_intake ?? period?.target_intake ?? null
  const remaining = target == null ? null : target - (s?.kcal ?? 0)
  const q = date === today() ? '' : `?d=${date}`

  return (
    <div className="min-h-[calc(100dvh-4rem)] space-y-3" {...swipe}>
      <Hero
        top={<Stepper label={relativeDayLabel(date)} onPrev={() => go(-1)} onNext={() => go(1)} />}
        label="ΑΠΟΜΕΝΟΥΝ"
        value={
          <span key={date} className={`inline-block ${anim}`}>
            {remaining == null ? '—' : num(remaining, 0)}
          </span>
        }
        unit="kcal"
        sub={
          <>
            {num(s?.kcal ?? 0, 0)} / {num(target, 0)} kcal · ΒΑΡΟΣ 7ημ{' '}
            <b className="text-text">{num(w7, 2)} kg</b>
            <button
              type="button"
              onClick={() => navigate('/plan')}
              className="mx-auto mt-2 flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted transition hover:bg-line hover:text-text"
            >
              {period ? `Περίοδος: ${period.label ?? 'χωρίς όνομα'}` : 'Δεν υπάρχει περίοδος — όρισε στόχους'}
              <ChevronRight size={14} />
            </button>
          </>
        }
      >
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Γεύμα" onClick={() => navigate(`/macros${q}`)} />
          <QuickAction icon={<ScaleIcon size={20} />} label="Βάρος" onClick={() => setGroup('nutrition')} />
          <QuickAction icon={<Activity size={20} />} label="Άσκηση" onClick={() => setGymOpen(true)} />
          <QuickAction icon={<Calculator size={20} />} label="Calculator" onClick={() => navigate(`/calculator${q}`)} />
        </QuickActions>
      </Hero>

      <ErrorNote error={summaries.error} />

      <div key={date} className={anim}>
        <Grid>
          <Widget title="Nutrition" icon={<Salad size={16} />} onClick={() => setGroup('nutrition')}>
            <div className="grid grid-cols-2 gap-x-2 gap-y-4 justify-items-center">
              <MacroRing label="Θερμίδες" value={s?.kcal} target={target} unit="kcal" over="bad" />
              <MacroRing label="Πρωτεΐνη" value={s?.protein} target={period?.protein_target} unit="g" over="good" />
              <MacroRing label="Υδατάνθρακες" value={s?.carbs} target={period?.carbs_target} unit="g" over="bad" />
              <MacroRing label="Λιπαρά" value={s?.fat} target={period?.fat_target} unit="g" over="bad" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Stat label="Burned" value={num(s?.burned ?? log?.burn_override ?? period?.burn_estimate, 0)} unit="kcal" />
              <Stat label="Έλλειμμα" value={signed(s?.deficit, 0)} unit="kcal" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip on={log?.creatine} label="Κρεατίνη" />
              <Chip on={log?.alcohol} label="Αλκοόλ" invert />
              <Chip on={log?.sugar} label="Ζάχαρη" invert />
              <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
                💧 {num(log?.water, 2)} lt
              </span>
              <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
                ⚖️ {num(log?.weight, 2)} kg
              </span>
            </div>
          </Widget>

          <Widget title="Recovery / Body metrics" icon={<HeartPulse size={16} />} onClick={() => setGroup('recovery')}>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Ύπνος" value={num(log?.sleep_hours, 2)} unit="h" />
              <Stat label="Ποιότητα" value={num(log?.sleep_quality)} unit="/10" />
              <Stat label="Ενέργεια" value={num(log?.energy)} unit="/10" />
              <Stat label="Κούραση" value={num(log?.fatigue)} unit="/10" />
              <Stat label="Resting HR" value={num(log?.resting_hr, 0)} />
              <Stat label="HRV" value={num(log?.hrv, 0)} unit="ms" />
            </div>
          </Widget>

          <Widget title="Γυμναστική" icon={<Dumbbell size={16} />} onClick={() => setGymOpen(true)}>
            {workouts.length === 0 ? (
              <div className="text-sm text-muted">Καμία δραστηριότητα — πάτα για προσθήκη</div>
            ) : (
              <ul className="space-y-1.5">
                {workouts.map((w) => {
                  const a = activities.find((x) => x.id === w.activity_id)
                  return (
                    <li key={w.id} className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{a?.name}</span>
                      <span className="text-muted">
                        {[
                          w.distance != null && `${num(w.distance, 2)} ${a?.distance_unit ?? ''}`,
                          w.duration_min != null && `${num(w.duration_min, 0)}′`,
                          w.rpe != null && `RPE ${num(w.rpe)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold">
                👟 {num(log?.steps, 0)} βήματα
              </span>
              <Chip on={log?.active_rest} label="Active rest" />
              <Chip on={log?.injury} label="Injury" invert />
            </div>
          </Widget>

          <Widget title="Mental / Emotional" icon={<Brain size={16} />} onClick={() => setGroup('mental')}>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Διάθεση" value={num(log?.mood)} />
              <Stat label="Άγχος" value={num(log?.anxiety)} />
              <Stat label="Κίνητρο" value={num(log?.motivation)} />
              <Stat label="Συγκέντρ." value={num(log?.focus)} />
              <Stat label="Πείνα" value={num(log?.hunger)} />
              <Stat label="Νύστα" value={num(log?.sleepiness)} />
            </div>
          </Widget>

          <Widget title="Μετρήσεις" icon={<Ruler size={16} />} onClick={() => setGroup('metrics')}>
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Μέση" value={num(log?.waist)} />
              <Stat label="Στήθος" value={num(log?.chest)} />
              <Stat label="Γοφοί" value={num(log?.hips)} />
              <Stat label="Μηρός" value={num(log?.thigh)} />
              <Stat label="Γάμπα" value={num(log?.calf)} />
              <Stat label="Γλουτοί" value={num(log?.glutes)} />
              <Stat label="Βραχίονας" value={num(log?.arm)} />
            </div>
          </Widget>
        </Grid>
      </div>

      <GroupSheet group={group} date={date} log={log} onClose={() => setGroup(null)} />
      <WorkoutSheet open={gymOpen} date={date} log={log} onClose={() => setGymOpen(false)} />
    </div>
  )
}
