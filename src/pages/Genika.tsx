import { useNavigate } from 'react-router'
import clsx from 'clsx'
import { Activity, ArrowUpRight, Calculator, ChevronLeft, ChevronRight, Plus, Scale, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { GroupSheet, type GroupKey } from '../components/DailyFields'
import { DuePayments } from '../components/DuePayments'
import { WorkoutSheet } from '../components/WorkoutSheet'
import { ErrorNote } from '../components/ui'
import { useActivities, useDailyLog, usePeriods, useSummaries, useTrainingPlans, useWorkouts } from '../lib/api'
import { addDays, fmtDay, today } from '../lib/dates'
import { num, signed } from '../lib/format'
import { KCAL_PER_KG } from '../lib/stats'
import { intakeTarget } from '../lib/training'
import { useSwipe } from '../lib/useSwipe'
import { NutRings, Spark } from '../components/ChartParts'
import { useDayData } from '../lib/useDayData'
import '../styles/pages.css'

/** A card that can also be a button (opens a sheet). Inner buttons stop propagation. */
function Card(props: { className?: string; onClick?: () => void; children: ReactNode }) {
  const { onClick } = props
  return (
    <section
      className={clsx('da-card', onClick && 'da-click', props.className)}
      {...(onClick
        ? {
            role: 'button',
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onClick()
              }
            },
          }
        : {})}
    >
      {props.children}
    </section>
  )
}

function Rows(props: { items: [string, ReactNode][] }) {
  return (
    <dl className="da-rows">
      {props.items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A yes/no marker: filled when on (red for the "bad if yes" ones), hollow when off or not logged. */
function Flag(props: { on: boolean | null | undefined; label: string; bad?: boolean }) {
  return (
    <span className="da-flag">
      <i className={props.on ? (props.bad ? 'bad' : 'on') : ''} />
      {props.label}
    </span>
  )
}

/** The home page: the day's calories left, weight, sleep, nutrition, training, mental state and measurements. */
export function Genika() {
  const d = useDayData()
  const date = d.date
  const navigate = useNavigate()
  const [group, setGroup] = useState<GroupKey | null>(null)
  const [gymOpen, setGymOpen] = useState(false)
  // Direction of the last day change, so the new day slides in from the matching side.
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const go = (days: number) => {
    setDir(days > 0 ? 'next' : 'prev')
    d.go(days)
  }
  const swipe = useSwipe(() => go(1), () => go(-1))
  const anim = dir === 'next' ? 'anim-from-right' : dir === 'prev' ? 'anim-from-left' : ''

  const summaries = useSummaries(addDays(date, -13), date)
  const log = useDailyLog(date).data
  const workouts = useWorkouts(date).data ?? []
  const activities = useActivities().data ?? []
  const period = usePeriods().data?.find((p) => p.start_date <= date && p.end_date >= date)
  const intake = intakeTarget(date, useTrainingPlans().data ?? [], period)
  const s = summaries.data?.find((r) => r.date === date)

  const eaten = d.target ? Math.min(1, d.kcal / d.target) : 0
  const rows = summaries.data ?? []
  const weightSeries = rows.filter((r) => r.weight != null).map((r) => ({ date: r.date as string, weight: r.weight as number }))
  const weightNow = log?.weight ?? weightSeries.at(-1)?.weight ?? null
  const anchor = weightSeries.filter((r) => r.date <= addDays(date, -7)).at(-1)
  const weightDelta = weightNow != null && anchor ? weightNow - anchor.weight : null
  // The 7 days ending on the selected day (days with no meals logged don't count).
  const logged = d.week.filter((w) => w.kcal != null)
  const weekRows = rows.filter((r) => d.week.some((w) => w.date === r.date) && r.kcal)
  const avgKcal = logged.reduce((a, w) => a + (w.kcal ?? 0), 0) / (logged.length || 1)
  const deficitTotal = weekRows.reduce((a, r) => a + (r.deficit ?? 0), 0)
  const proteinDays = weekRows.filter((r) => r.protein)
  const avgProtein = proteinDays.reduce((a, r) => a + (r.protein ?? 0), 0) / (proteinDays.length || 1)
  const withTarget = logged.filter((w) => w.target != null)
  const underTarget = withTarget.filter((w) => (w.kcal ?? 0) <= (w.target ?? 0)).length
  const q = date === today() ? '' : `?d=${date}`
  const macros = [
    { key: 'protein', name: 'Πρωτεΐνη', value: s?.protein ?? 0, target: period?.protein_target ?? null },
    { key: 'carbs', name: 'Υδατάνθρακες', value: s?.carbs ?? 0, target: period?.carbs_target ?? null },
    { key: 'fat', name: 'Λιπαρά', value: s?.fat ?? 0, target: period?.fat_target ?? null },
  ]

  return (
    <div className="da da-flat" {...swipe}>
      <header className="da-top">
        <div>
          <h2 className="da-title">{d.label}</h2>
          <div className="da-date">{fmtDay(date)}</div>
        </div>
        <div className="da-nav">
          <button
            type="button"
            className="da-today"
            disabled={d.isToday}
            onClick={() => {
              setDir(date < today() ? 'next' : 'prev')
              d.goToday()
            }}
          >
            Σήμερα
          </button>
          <button type="button" aria-label="Προηγούμενη μέρα" onClick={() => go(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Επόμενη μέρα" onClick={() => go(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <ErrorNote error={summaries.error} />

      <div key={date} className={anim}>
        <div className="da-grid">
          <section className="da-card da-dark da-span2">
            <div className="da-row">
              <span>{d.remaining != null && d.remaining < 0 ? 'Πάνω από τον στόχο' : 'Απομένουν'}</span>
              <button type="button" className="da-arrow" aria-label="Άνοιγμα MACROS" onClick={() => navigate(`/macros${q}`)}>
                <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="da-num da-hero">
              {d.remaining == null ? '—' : num(Math.abs(d.remaining), 0)}
              <small>kcal</small>
            </div>
            <div className="da-bar" style={{ color: '#9AD8B8' }}>
              <i style={{ width: `${eaten * 100}%` }} />
            </div>
            <div className="da-caption">
              {num(d.kcal, 0)} από {d.target == null ? '—' : num(d.target, 0)}
              {intake.source === 'training' && ' · στόχος από training plan'}
            </div>
            {d.target == null && (
              <button type="button" className="da-notice" onClick={() => navigate('/training')}>
                <TriangleAlert size={14} /> Δεν υπάρχει στόχος θερμίδων για αυτή τη μέρα
              </button>
            )}
            <button type="button" className="da-link" onClick={() => navigate('/plan')}>
              {period ? `Περίοδος: ${period.label ?? 'χωρίς όνομα'}` : 'Δεν υπάρχει περίοδος — όρισε στόχους'} →
            </button>
            <div className="da-qa">
              <button type="button" onClick={() => navigate(`/macros${q}`)}>
                <span className="c">
                  <Plus size={20} />
                </span>
                Γεύμα
              </button>
              <button type="button" onClick={() => setGroup('nutrition')}>
                <span className="c">
                  <Scale size={20} />
                </span>
                Βάρος
              </button>
              <button type="button" onClick={() => setGymOpen(true)}>
                <span className="c">
                  <Activity size={20} />
                </span>
                Άσκηση
              </button>
              <button type="button" onClick={() => navigate(`/calculator${q}`)}>
                <span className="c">
                  <Calculator size={20} />
                </span>
                Calculator
              </button>
            </div>
          </section>

          <Card onClick={() => setGroup('nutrition')}>
            <h3>Βάρος</h3>
            <div className="da-num da-mid">
              {num(d.weightAvg, 1)}
              <small>kg</small>
            </div>
            <div className="da-dim">μ.ο. 7 ημερών</div>
            <Spark values={weightSeries.map((r) => r.weight)} className="da-spark da-spark-lg" />
            <Rows
              items={[
                ['Σήμερα', weightNow == null ? '—' : `${num(weightNow, 2)} kg`],
                ['Από 7ημ', weightDelta == null ? '—' : `${signed(weightDelta, 1)} kg`],
                ['Εύρος', weightSeries.length ? `${num(Math.min(...weightSeries.map((r) => r.weight)), 1)}–${num(Math.max(...weightSeries.map((r) => r.weight)), 1)}` : '—'],
              ]}
            />
          </Card>

          <Card onClick={() => setGroup('recovery')}>
            <h3>Ύπνος</h3>
            <div className="da-num da-mid">
              {num(log?.sleep_hours, 1)}
              <small>ώρες</small>
            </div>
            <Rows
              items={[
                ['Ποιότητα', `${num(log?.sleep_quality)} /10`],
                ['Ενέργεια', `${num(log?.energy)} /10`],
                ['Κούραση', `${num(log?.fatigue)} /10`],
                ['Resting HR', num(log?.resting_hr, 0)],
                ['HRV', `${num(log?.hrv, 0)} ms`],
              ]}
            />
          </Card>

          <div className="da-due da-full">
            <DuePayments />
          </div>

          <Card className="da-span2" onClick={() => setGroup('nutrition')}>
            <h3>Θρεπτικά</h3>
            <div className="da-nut">
              <NutRings macros={macros} colors={['#17503B', '#5FAE88', '#131512']} track="#e3e4dd" className="da-rings" />
              <dl className="da-ledger">
                {macros.map((m) => (
                  <div key={m.key}>
                    <dt>{m.name}</dt>
                    <dd>
                      {num(m.value, 0)}
                      <span>{m.target ? ` / ${num(m.target, 0)}` : ''} g</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="da-nutmeta">
              <div>
                <div className="da-dim">Burned</div>
                <div className="da-num da-stat">
                  {num(s?.burned ?? log?.burn_override ?? period?.burn_estimate, 0)}
                  <small>kcal</small>
                </div>
              </div>
              <div>
                <div className="da-dim">Έλλειμμα</div>
                <div className="da-num da-stat">
                  {signed(s?.deficit, 0)}
                  <small>kcal</small>
                </div>
              </div>
            </div>
            <div className="da-flags">
              <Flag on={log?.creatine} label="Κρεατίνη" />
              <Flag on={log?.alcohol} label="Αλκοόλ" bad />
              <Flag on={log?.sugar} label="Ζάχαρη" bad />
              <span className="da-flag da-dim">Νερό {num(log?.water, 2)} lt</span>
            </div>
          </Card>

          <Card className="da-span2">
            <h3>Τελευταίες 7 μέρες</h3>
            <div className="da-quad">
              <div>
                <div className="da-num da-stat">
                  {logged.length ? num(avgKcal, 0) : '—'}
                  <small>kcal</small>
                </div>
                <div className="da-dim">μ.ο. θερμίδες</div>
              </div>
              <div>
                <div className="da-num da-stat">
                  {logged.length ? signed(deficitTotal, 0) : '—'}
                  <small>kcal</small>
                </div>
                <div className="da-dim">έλλειμμα{logged.length ? ` · ≈ ${signed(-deficitTotal / KCAL_PER_KG, 1)} kg` : ''}</div>
              </div>
              <div>
                <div className="da-num da-stat">
                  {proteinDays.length ? num(avgProtein, 0) : '—'}
                  <small>g</small>
                </div>
                <div className="da-dim">μ.ο. πρωτεΐνη</div>
              </div>
              <div>
                <div className="da-num da-stat">
                  {withTarget.length ? `${underTarget} / ${withTarget.length}` : '—'}
                </div>
                <div className="da-dim">μέρες εντός στόχου</div>
              </div>
            </div>
            <div className="da-caption da-dim">καταγεγραμμένες μέρες: {logged.length} από 7</div>
          </Card>

          <Card className="da-ink da-span2" onClick={() => setGymOpen(true)}>
            <div className="da-row">
              <h3>Γυμναστική</h3>
              <span className="da-muted-on-dark">{d.trainingKcal == null ? '' : `πλάνο ${num(d.trainingKcal, 0)} kcal`}</span>
            </div>
            {d.training.length > 0 && (
              <ul className="da-tasks">
                {d.training.map((e, i) => (
                  <li key={i}>
                    <span className="da-dot" />
                    <span>{e}</span>
                  </li>
                ))}
              </ul>
            )}
            {workouts.length === 0 ? (
              <p className="da-empty">Καμία δραστηριότητα — πάτα για προσθήκη</p>
            ) : (
              <Rows
                items={workouts.map((w) => {
                  const a = activities.find((x) => x.id === w.activity_id)
                  return [
                    a?.name ?? '—',
                    [
                      w.distance != null && `${num(w.distance, 2)} ${a?.distance_unit ?? ''}`,
                      w.duration_min != null && `${num(w.duration_min, 0)}′`,
                      w.rpe != null && `RPE ${num(w.rpe)}`,
                    ]
                      .filter(Boolean)
                      .join(' · '),
                  ] as [string, ReactNode]
                })}
              />
            )}
            <div className="da-flags">
              <span className="da-flag">{num(log?.steps, 0)} βήματα</span>
              <Flag on={log?.active_rest} label="Active rest" />
              <Flag on={log?.injury} label="Injury" bad />
            </div>
          </Card>

          <Card onClick={() => setGroup('mental')}>
            <h3>Mental</h3>
            <Rows
              items={[
                ['Διάθεση', num(log?.mood)],
                ['Άγχος', num(log?.anxiety)],
                ['Κίνητρο', num(log?.motivation)],
                ['Συγκέντρ.', num(log?.focus)],
                ['Πείνα', num(log?.hunger)],
                ['Νύστα', num(log?.sleepiness)],
              ]}
            />
          </Card>

          <Card onClick={() => setGroup('metrics')}>
            <h3>Μετρήσεις</h3>
            <Rows
              items={[
                ['Μέση', num(log?.waist)],
                ['Στήθος', num(log?.chest)],
                ['Γοφοί', num(log?.hips)],
                ['Μηρός', num(log?.thigh)],
                ['Γάμπα', num(log?.calf)],
                ['Γλουτοί', num(log?.glutes)],
                ['Βραχίονας', num(log?.arm)],
              ]}
            />
          </Card>
        </div>
      </div>

      <GroupSheet group={group} date={date} log={log} onClose={() => setGroup(null)} />
      <WorkoutSheet open={gymOpen} date={date} log={log} onClose={() => setGymOpen(false)} />
    </div>
  )
}
