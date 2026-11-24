import clsx from 'clsx'
import { Flag, Minus, Plus, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { HistoryTab } from '../components/pacer/HistoryTab'
import { PlanTab } from '../components/pacer/PlanTab'
import { Button, ErrorNote, Segmented, Select } from '../components/ui'
import { usePacerPlans, useSaveRow } from '../lib/api'
import type { Json, PacerPlan } from '../lib/database.types'
import { today } from '../lib/dates'
import { num } from '../lib/format'
import {
  cumDist,
  cumulative,
  evaluateLap,
  fmtClock,
  fmtDelta,
  fmtFull,
  fmtPace,
  LAP_COUNT,
  lapDist,
  MAIN,
  MARATHON_KM,
  scenariosOf,
  TOTAL_TOL,
  type Scenario,
} from '../lib/pacer'
import { useElapsed, usePacerRun, useWakeLock } from '../lib/usePacerRun'
import '../styles/pages.css'

type Tab = 'race' | 'plan' | 'history'

/** Marathon pacer: a clock that survives a locked phone, laps per km and how they compare with three target plans. */
export function Pacer() {
  const plans = usePacerPlans()
  const [tab, setTab] = useState<Tab>('race')
  const list = plans.data ?? []

  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">Pacer</h2>
          <div className="da-date">42,195 χλμ · sub-4</div>
        </div>
      </header>

      <div className="ca-slot">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'race', label: 'ΑΓΩΝΑΣ' },
            { value: 'plan', label: 'ΠΛΑΝΟ' },
            { value: 'history', label: 'ΙΣΤΟΡΙΚΟ' },
          ]}
        />
      </div>

      <ErrorNote error={plans.error} />
      {plans.isSuccess && list.length === 0 && <p className="da-empty">Δεν υπάρχει πλάνο</p>}
      {/* The race stays mounted so its clock and screen lock survive a peek at the other tabs. */}
      {list.length > 0 && (
        <div className={tab === 'race' ? '' : 'hidden'}>
          <RaceTab plans={list} />
        </div>
      )}
      {tab === 'plan' && list.length > 0 && <PlanTab plans={list} />}
      {tab === 'history' && <HistoryTab plans={list} />}
    </div>
  )
}

type Tone = 'good' | 'bad' | 'warn' | 'mute'

/** A status line as a tinted tile: it has to read at a glance, mid-race. */
function Status(props: { tone: Tone; children: ReactNode }) {
  return <div className={clsx('pc-status', props.tone)}>{props.children}</div>
}

function RaceTab(props: { plans: PacerPlan[] }) {
  const { state, start, lap, undo, reset, markSaved } = usePacerRun()
  const save = useSaveRow('pacer_runs')
  const [chosen, setChosen] = useState('')
  const [mark, setMark] = useState<number | null>(null)
  const [armed, setArmed] = useState(false)

  const started = state.startedAt != null
  const running = started && state.finished == null
  const elapsed = useElapsed(state.startedAt, running)
  const wake = useWakeLock(running)
  const plan = props.plans.find((p) => p.id === (state.planId ?? chosen)) ?? props.plans[0]
  const scenarios = scenariosOf(plan)
  const laps = state.laps
  const nextKm = (laps.at(-1)?.km ?? 0) + 1
  const markKm = Math.min(LAP_COUNT, Math.max(nextKm, mark ?? nextKm))
  const ev = evaluateLap(laps, scenarios)
  const clock = state.finished ?? elapsed

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  // The finished run is stored once; a failed save can be retried with the button.
  const saveRun = () =>
    save.mutate(
      { plan_id: state.planId, run_date: today(), laps: laps as unknown as Json, total_sec: state.finished },
      { onSuccess: markSaved },
    )
  useEffect(() => {
    if (state.finished != null && !state.saved && !save.isPending && !save.isError) saveRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.finished, state.saved])

  const pressLap = () => {
    navigator.vibrate?.(40)
    lap(markKm)
    setMark(null)
  }

  return (
    <div className="da-grid">
      <section className="da-card da-dark da-full">
        <div className="da-row">
          <span>{state.finished != null ? 'Τερματισμός' : started ? plan.name : 'Χρονόμετρο'}</span>
          {started && state.finished == null && <span className="da-dim pc-live">{wake ? 'οθόνη ανοιχτή' : 'οθόνη ελεύθερη'}</span>}
        </div>
        <div className="da-num pc-clock">{fmtFull(clock)}</div>
        <div className="da-caption">
          {ev ? (
            <>
              χλμ <b>{num(cumDist(ev.km), ev.km > 42 ? 3 : 0)}</b> / {num(MARATHON_KM, 3)} · μέσο pace <b>{fmtPace(ev.avgPace)}</b>/χλμ
            </>
          ) : started ? (
            'πάτα LAP σε κάθε χιλιόμετρο'
          ) : (
            plan.name
          )}
        </div>

        {!started && (
          <div className="pc-pre">
            {props.plans.length > 1 && (
              <Select value={plan.id} onChange={setChosen} options={props.plans.map((p) => ({ value: p.id, label: p.name }))} />
            )}
            <div className="pc-scen">
              {scenarios.map((s, i) => (
                <span key={s.label} className={i === MAIN ? 'main' : ''}>
                  {s.label}
                  {i === MAIN && ' · κύριος'}
                </span>
              ))}
            </div>
            <button type="button" className="pc-start" onClick={() => start(plan.id)}>
              <Flag size={22} /> START
            </button>
            <p className="pc-hint">
              Το χρονόμετρο μετράει από την ώρα που πάτησες START, οπότε είναι σωστό ακόμα κι αν κλειδώσει το κινητό. Ξεκλείδωσε για να
              δεις τον χρόνο ή να πατήσεις LAP.
            </p>
          </div>
        )}
      </section>

      {running && (
        <section className="da-full">
          <button type="button" className="pc-lap" onClick={pressLap}>
            {markKm === LAP_COUNT ? `ΤΕΡΜΑΤΙΣΜΟΣ · ${num(MARATHON_KM, 3)}` : `LAP · χλμ ${markKm}`}
          </button>
          <div className="pc-tools">
            <span className="pc-mark">
              <button type="button" aria-label="Προηγούμενο χλμ" disabled={markKm <= nextKm} onClick={() => setMark(markKm - 1)}>
                <Minus size={16} />
              </button>
              <span className="da-dim">σημειώνω χλμ</span>
              <b>{markKm}</b>
              <button type="button" aria-label="Επόμενο χλμ" disabled={markKm >= LAP_COUNT} onClick={() => setMark(markKm + 1)}>
                <Plus size={16} />
              </button>
            </span>
            <button type="button" className="pc-undo" disabled={laps.length === 0} onClick={undo}>
              <Undo2 size={15} /> Αναίρεση
            </button>
          </div>
          <p className="da-dim pc-note">
            Αν ξέχασες χιλιόμετρα, ανέβασε το «σημειώνω χλμ»· τα ενδιάμεσα συμπληρώνονται ισοκατανεμημένα.
          </p>
        </section>
      )}

      {state.finished != null && (
        <section className="da-card da-full">
          <div className="ma-head">
            <h3>Ολοκληρώθηκε</h3>
            {state.saved ? (
              <span className="ta-status current">
                <i />
                Αποθηκεύτηκε
              </span>
            ) : save.isPending ? (
              <span className="da-dim">Αποθήκευση…</span>
            ) : (
              <Button onClick={saveRun}>Αποθήκευση</Button>
            )}
          </div>
          <div className="da-num da-mid">{fmtFull(state.finished)}</div>
          <div className="da-dim">
            {state.finished < 4 * 3600 ? 'Sub-4 ✓' : 'Πάνω από 4:00:00'} · μέσο pace {fmtPace(state.finished / MARATHON_KM)}/χλμ
          </div>
          <ErrorNote error={save.error} />
        </section>
      )}

      {ev && <Evaluation ev={ev} scenarios={scenarios} />}

      {laps.length > 0 && <LapTable laps={laps} scenarios={scenarios} />}

      {started && (
        <div className="da-full">
          <Button
            variant={armed ? 'danger' : 'ghost'}
            className="w-full"
            onClick={() => {
              // Two taps: the first arms the button, the second wipes the race.
              if (armed) {
                reset()
                setArmed(false)
                setMark(null)
                save.reset()
              } else setArmed(true)
            }}
          >
            <RotateCcw size={16} /> {armed ? 'Σίγουρα; Διαγραφή αγώνα' : state.finished != null ? 'Νέος αγώνας' : 'Ακύρωση αγώνα'}
          </Button>
        </div>
      )}
    </div>
  )
}

function Evaluation(props: { ev: NonNullable<ReturnType<typeof evaluateLap>>; scenarios: Scenario[] }) {
  const { ev, scenarios } = props
  const main = scenarios[Math.min(MAIN, scenarios.length - 1)]
  const behindBy = ev.deltas[scenarios.indexOf(main)]
  const lapFinal = ev.km === LAP_COUNT
  return (
    <>
      <section className="da-card da-span2">
        <div className="ma-head">
          <h3>{lapFinal ? 'Τελευταία 195 μ.' : `Χλμ ${ev.km}`}</h3>
          <span className="da-dim">πλάνο {fmtPace(ev.planned)}</span>
        </div>
        <div className="ma-sum">
          <span className="da-num ma-kcal">{fmtPace(ev.pace)}</span>
          <span className="da-dim">/χλμ · χρόνος {fmtClock(ev.lapSec)}</span>
        </div>
        {ev.state === 'ok' ? (
          <Status tone="good">Εντός pace ({main.label})</Status>
        ) : (
          <Status tone={ev.state === 'slow' ? 'bad' : 'warn'}>
            {ev.state === 'slow' ? 'Πιο αργός' : 'Πιο γρήγορος'} κατά {Math.round(Math.abs(ev.diff))}″/χλμ
          </Status>
        )}
        {ev.state !== 'ok' && ev.alsoIn.length > 0 && <p className="da-dim pc-also">Εντός pace και για: {ev.alsoIn.join(', ')}</p>}
      </section>

      <section className="da-card da-span2">
        <h3>Συνολικός χρόνος</h3>
        {ev.totalState === 'ok' ? (
          <Status tone="good">
            Εντός ±{TOTAL_TOL / 60}′ από το {main.label}
          </Status>
        ) : ev.totalState === 'behind' ? (
          <Status tone="bad">
            Πίσω από το {main.label} κατά {fmtClock(behindBy)}
          </Status>
        ) : (
          <Status tone="warn">
            Μπροστά από το {main.label} κατά {fmtClock(behindBy)}
          </Status>
        )}
        {ev.totalState !== 'ok' && ev.within.length > 0 && (
          <p className="da-dim pc-also">
            Εντός ±{TOTAL_TOL / 60}′ από: {ev.within.join(', ')}
          </p>
        )}
        <table className="pc-table">
          <thead>
            <tr>
              <th>Στόχος</th>
              <th>Πλάνο στο χλμ</th>
              <th>Διαφορά</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s, i) => {
              const d = ev.deltas[i]
              const within = Math.abs(d) <= TOTAL_TOL
              return (
                <tr key={s.label} className={i === MAIN ? 'main' : ''}>
                  <td>{s.label}</td>
                  <td>{fmtClock(cumulative(s.laps)[ev.km - 1])}</td>
                  <td className={within ? 'good' : d > 0 ? 'bad' : 'warn'}>{fmtDelta(d)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="da-card da-span2">
        <h3>Sub-4</h3>
        <Status tone={ev.sub4.onTrack ? 'good' : 'bad'}>
          {ev.sub4.onTrack
            ? `On track · ${fmtClock(-ev.sub4.delta)} μπροστά από το όριο`
            : `Πίσω από το όριο sub-4 κατά ${fmtClock(ev.sub4.delta)}`}
        </Status>
        <dl className="da-rows">
          <div>
            <dt>Μέσο pace μέχρι τώρα</dt>
            <dd>{fmtPace(ev.avgPace)}/χλμ</dd>
          </div>
          <div>
            <dt>Pace για sub-4 στα υπόλοιπα</dt>
            <dd>{ev.sub4.requiredPace == null ? '—' : `${fmtPace(ev.sub4.requiredPace)}/χλμ`}</dd>
          </div>
          <div>
            <dt>Πρόβλεψη (πλάνο {main.label})</dt>
            <dd className={ev.sub4.projected < 4 * 3600 ? 'pc-good' : 'pc-bad'}>{fmtFull(ev.sub4.projected)}</dd>
          </div>
        </dl>
      </section>

      {ev.next && (
        <section className="da-card da-span2">
          <h3>Επόμενο {ev.next.km === LAP_COUNT ? 'τμήμα (195 μ.)' : `χλμ ${ev.next.km}`}</h3>
          <div className="ma-sum">
            <span className="da-num ma-kcal">{fmtPace(ev.next.advised)}</span>
            <span className="da-dim">
              /χλμ · χρόνος {fmtClock(ev.next.lapTarget)} · πλάνο {fmtPace(ev.next.planned)}
            </span>
          </div>
          <Status tone={ev.next.verb === 'hold' ? 'good' : ev.next.verb === 'faster' ? 'warn' : 'mute'}>
            {ev.next.verb === 'faster' ? 'Πιο γρήγορα από το πλάνο' : ev.next.verb === 'slower' ? 'Πιο αργά από το πλάνο' : 'Κράτα το πλάνο'}
          </Status>
        </section>
      )}
    </>
  )
}

function LapTable(props: { laps: { km: number; t: number; est?: boolean }[]; scenarios: Scenario[] }) {
  const main = props.scenarios[Math.min(MAIN, props.scenarios.length - 1)]
  const cum = cumulative(main.laps)
  return (
    <section className="da-card da-full">
      <h3>Χιλιόμετρα</h3>
      <table className="pc-table pc-laps">
        <thead>
          <tr>
            <th>Χλμ</th>
            <th>Split</th>
            <th>Pace</th>
            <th>Σύνολο</th>
            <th>vs {main.label}</th>
          </tr>
        </thead>
        <tbody>
          {[...props.laps].reverse().map((l) => {
            const prev = props.laps[l.km - 2]?.t ?? 0
            const split = l.t - prev
            const d = l.t - cum[l.km - 1]
            return (
              <tr key={l.km} className={l.est ? 'est' : ''}>
                <td>{l.km === LAP_COUNT ? 'τέρμα' : l.km}</td>
                <td>
                  {l.est && '~'}
                  {fmtClock(split)}
                </td>
                <td>{fmtPace(split / lapDist(l.km))}</td>
                <td>{fmtClock(l.t)}</td>
                <td className={Math.abs(d) <= TOTAL_TOL ? 'good' : d > 0 ? 'bad' : 'warn'}>{fmtDelta(d)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
