import clsx from 'clsx'
import { Flag, Minus, Plus, RotateCcw, Undo2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { HistoryTab } from '../components/pacer/HistoryTab'
import { PlanTab } from '../components/pacer/PlanTab'
import { Button, ErrorNote, Hero, Segmented, Select, Widget } from '../components/ui'
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

type Tab = 'race' | 'plan' | 'history'

export function Pacer() {
  const plans = usePacerPlans()
  const [tab, setTab] = useState<Tab>('race')
  const list = plans.data ?? []

  return (
    <div className="space-y-3">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'race', label: 'ΑΓΩΝΑΣ' },
          { value: 'plan', label: 'ΠΛΑΝΟ' },
          { value: 'history', label: 'ΙΣΤΟΡΙΚΟ' },
        ]}
      />
      <ErrorNote error={plans.error} />
      {plans.isSuccess && list.length === 0 && <div className="py-10 text-center text-sm text-muted">Δεν υπάρχει πλάνο</div>}
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
const TONES: Record<Tone, string> = {
  good: 'bg-good/15 text-good',
  bad: 'bg-bad/15 text-bad',
  warn: 'bg-warn/15 text-warn',
  mute: 'bg-surface-2 text-muted',
}
function Pill(props: { tone: Tone; children: ReactNode }) {
  return <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', TONES[props.tone])}>{props.children}</span>
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
    <div className="space-y-3">
      <Hero
        label={state.finished != null ? 'ΤΕΡΜΑΤΙΣΜΟΣ' : started ? plan.name : 'ΧΡΟΝΟΜΕΤΡΟ'}
        value={<span className="tabular-nums">{fmtFull(clock)}</span>}
        sub={
          ev ? (
            <>
              χλμ <b className="text-text">{num(cumDist(ev.km), ev.km > 42 ? 3 : 0)}</b> / {num(MARATHON_KM, 3)} · μέσο pace{' '}
              <b className="text-text">{fmtPace(ev.avgPace)}</b>/χλμ
            </>
          ) : started ? (
            'πάτα LAP σε κάθε χιλιόμετρο'
          ) : (
            plan.name
          )
        }
      />

      {!started && (
        <Widget title="Πριν την εκκίνηση">
          {props.plans.length > 1 && (
            <div className="mb-3">
              <Select
                value={plan.id}
                onChange={setChosen}
                options={props.plans.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            {scenarios.map((s, i) => (
              <Pill key={s.label} tone={i === MAIN ? 'good' : 'mute'}>
                {s.label}
                {i === MAIN && ' · κύριος στόχος'}
              </Pill>
            ))}
          </div>
          <Button className="h-16 w-full text-lg" onClick={() => start(plan.id)}>
            <Flag size={20} /> START
          </Button>
          <p className="mt-3 text-xs text-muted">
            Το χρονόμετρο μετράει από την ώρα που πάτησες START, οπότε είναι σωστό ακόμα κι αν κλειδώσει το κινητό. Ξεκλείδωσε για
            να δεις τον χρόνο ή να πατήσεις LAP. Κατά τον αγώνα η οθόνη προσπαθεί να μένει ανοιχτή.
          </p>
        </Widget>
      )}

      {running && (
        <>
          <button
            type="button"
            onClick={pressLap}
            className="h-24 w-full rounded-3xl bg-accent text-2xl font-extrabold tracking-wide text-white transition active:scale-[0.98]"
          >
            {markKm === LAP_COUNT ? `ΤΕΡΜΑΤΙΣΜΟΣ · ${num(MARATHON_KM, 3)}` : `LAP · χλμ ${markKm}`}
          </button>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Προηγούμενο χλμ"
                disabled={markKm <= nextKm}
                onClick={() => setMark(markKm - 1)}
                className="grid size-9 place-items-center rounded-full bg-surface-2 transition active:scale-90 disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span className="text-muted">σημειώνω χλμ</span>
              <b className="w-6 text-center">{markKm}</b>
              <button
                type="button"
                aria-label="Επόμενο χλμ"
                disabled={markKm >= LAP_COUNT}
                onClick={() => setMark(markKm + 1)}
                className="grid size-9 place-items-center rounded-full bg-surface-2 transition active:scale-90 disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </span>
            <button
              type="button"
              disabled={laps.length === 0}
              onClick={undo}
              className="flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-semibold transition active:scale-95 disabled:opacity-30"
            >
              <Undo2 size={14} /> Αναίρεση
            </button>
          </div>
          <p className="text-center text-xs text-muted">
            {wake ? 'Η οθόνη μένει ανοιχτή.' : 'Η οθόνη μπορεί να κλειδώσει· ο χρόνος παραμένει σωστός.'} Αν ξέχασες χιλιόμετρα, ανέβασε
            το «σημειώνω χλμ»· τα ενδιάμεσα συμπληρώνονται ισοκατανεμημένα.
          </p>
        </>
      )}

      {state.finished != null && (
        <Widget title="Ολοκληρώθηκε">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-3xl font-bold tabular-nums">{fmtFull(state.finished)}</div>
              <div className="text-xs text-muted">
                {state.finished < 4 * 3600 ? 'Sub-4 ✓' : 'Πάνω από 4:00:00'} · μέσο pace {fmtPace(state.finished / MARATHON_KM)}/χλμ
              </div>
            </div>
            {state.saved ? (
              <Pill tone="good">Αποθηκεύτηκε</Pill>
            ) : save.isPending ? (
              <Pill tone="mute">Αποθήκευση…</Pill>
            ) : (
              <Button onClick={saveRun}>Αποθήκευση</Button>
            )}
          </div>
          <ErrorNote error={save.error} />
        </Widget>
      )}

      {ev && <Evaluation ev={ev} scenarios={scenarios} />}

      {laps.length > 0 && <LapTable laps={laps} scenarios={scenarios} />}

      {started && (
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
      <Widget title={lapFinal ? 'Τελευταία 195 μ.' : `Χλμ ${ev.km}`}>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums">{fmtPace(ev.pace)}</span>
          <span className="text-xs text-muted">/χλμ · χρόνος {fmtClock(ev.lapSec)}</span>
          <span className="ml-auto text-xs text-muted">πλάνο {fmtPace(ev.planned)}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ev.state === 'ok' ? (
            <Pill tone="good">Εντός pace ({main.label})</Pill>
          ) : (
            <Pill tone={ev.state === 'slow' ? 'bad' : 'warn'}>
              {ev.state === 'slow' ? 'Πιο αργός' : 'Πιο γρήγορος'} κατά {Math.round(Math.abs(ev.diff))}″/χλμ
            </Pill>
          )}
          {ev.state !== 'ok' && ev.alsoIn.map((l) => <Pill key={l} tone="mute">Εντός pace {l}</Pill>)}
        </div>
      </Widget>

      <Widget title="Συνολικός χρόνος">
        <div className="mb-3 flex flex-wrap gap-2">
          {ev.totalState === 'ok' ? (
            <Pill tone="good">Εντός ±{TOTAL_TOL / 60}′ από το {main.label}</Pill>
          ) : ev.totalState === 'behind' ? (
            <Pill tone="bad">Πίσω από το {main.label} κατά {fmtClock(behindBy)}</Pill>
          ) : (
            <Pill tone="warn">Μπροστά από το {main.label} κατά {fmtClock(behindBy)}</Pill>
          )}
          {ev.totalState !== 'ok' && ev.within.length > 0 && <Pill tone="mute">Εντός ±{TOTAL_TOL / 60}′ από {ev.within.join(', ')}</Pill>}
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] text-muted uppercase">
            <tr>
              <th className="text-left font-medium">Στόχος</th>
              <th className="text-right font-medium">Πλάνο στο χλμ</th>
              <th className="text-right font-medium">Διαφορά</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {scenarios.map((s, i) => {
              const d = ev.deltas[i]
              const within = Math.abs(d) <= TOTAL_TOL
              return (
                <tr key={s.label} className={i === MAIN ? 'font-semibold' : ''}>
                  <td className="py-2">{s.label}</td>
                  <td className="py-2 text-right tabular-nums">{fmtClock(cumulative(s.laps)[ev.km - 1])}</td>
                  <td className={clsx('py-2 text-right tabular-nums', within ? 'text-good' : d > 0 ? 'text-bad' : 'text-warn')}>
                    {fmtDelta(d)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Widget>

      <Widget title="Sub-4">
        <div className="mb-3">
          <Pill tone={ev.sub4.onTrack ? 'good' : 'bad'}>
            {ev.sub4.onTrack
              ? `On track · ${fmtClock(-ev.sub4.delta)} μπροστά από το όριο`
              : `Πίσω από το όριο sub-4 κατά ${fmtClock(ev.sub4.delta)}`}
          </Pill>
        </div>
        <dl className="space-y-1.5 text-sm">
          <Row k="Μέσο pace μέχρι τώρα" v={`${fmtPace(ev.avgPace)}/χλμ`} />
          <Row
            k="Pace για sub-4 στα υπόλοιπα"
            v={ev.sub4.requiredPace == null ? '—' : `${fmtPace(ev.sub4.requiredPace)}/χλμ`}
          />
          <Row
            k={`Πρόβλεψη αν ακολουθήσεις το ${main.label}`}
            v={fmtFull(ev.sub4.projected)}
            tone={ev.sub4.projected < 4 * 3600 ? 'good' : 'bad'}
          />
        </dl>
      </Widget>

      {ev.next && (
        <Widget title={`Επόμενο ${ev.next.km === LAP_COUNT ? 'τμήμα (195 μ.)' : `χλμ ${ev.next.km}`}`}>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold tabular-nums">{fmtPace(ev.next.advised)}</span>
            <span className="text-xs text-muted">
              /χλμ · χρόνος {fmtClock(ev.next.lapTarget)} · πλάνο {fmtPace(ev.next.planned)}
            </span>
          </div>
          <div className="mt-3">
            <Pill tone={ev.next.verb === 'hold' ? 'good' : ev.next.verb === 'faster' ? 'warn' : 'mute'}>
              {ev.next.verb === 'faster' ? 'Πιο γρήγορα από το πλάνο' : ev.next.verb === 'slower' ? 'Πιο αργά από το πλάνο' : 'Κράτα το πλάνο'}
            </Pill>
          </div>
        </Widget>
      )}
    </>
  )
}

function Row(props: { k: string; v: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{props.k}</dt>
      <dd className={clsx('font-semibold tabular-nums', props.tone === 'good' && 'text-good', props.tone === 'bad' && 'text-bad')}>{props.v}</dd>
    </div>
  )
}

function LapTable(props: { laps: { km: number; t: number; est?: boolean }[]; scenarios: Scenario[] }) {
  const main = props.scenarios[Math.min(MAIN, props.scenarios.length - 1)]
  const cum = cumulative(main.laps)
  return (
    <Widget title="Χιλιόμετρα">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] text-muted uppercase">
          <tr>
            <th className="text-left font-medium">Χλμ</th>
            <th className="text-right font-medium">Split</th>
            <th className="text-right font-medium">Pace</th>
            <th className="text-right font-medium">Σύνολο</th>
            <th className="text-right font-medium">vs {main.label}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {[...props.laps].reverse().map((l) => {
            const prev = props.laps[l.km - 2]?.t ?? 0
            const split = l.t - prev
            const d = l.t - cum[l.km - 1]
            return (
              <tr key={l.km} className={l.est ? 'text-muted italic' : ''}>
                <td className="py-1.5">{l.km === LAP_COUNT ? 'τέρμα' : l.km}</td>
                <td className="py-1.5 text-right">{l.est && '~'}{fmtClock(split)}</td>
                <td className="py-1.5 text-right">{fmtPace(split / lapDist(l.km))}</td>
                <td className="py-1.5 text-right">{fmtClock(l.t)}</td>
                <td className={clsx('py-1.5 text-right', Math.abs(d) <= TOTAL_TOL ? 'text-good' : d > 0 ? 'text-bad' : 'text-warn')}>
                  {fmtDelta(d)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Widget>
  )
}
