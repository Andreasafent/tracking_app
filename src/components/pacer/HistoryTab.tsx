import clsx from 'clsx'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useDeleteRow, usePacerRuns } from '../../lib/api'
import type { PacerPlan, PacerRun } from '../../lib/database.types'
import { fmtDMY } from '../../lib/dates'
import {
  cumulative,
  fmtClock,
  fmtDelta,
  fmtPace,
  lapDist,
  lapsOf,
  LAP_COUNT,
  MAIN,
  MARATHON_KM,
  scenariosOf,
  TOTAL_TOL,
} from '../../lib/pacer'
import { Button, ErrorNote, Sheet, Widget } from '../ui'

/** Finished races with their splits, compared with the plan they were run against. */
export function HistoryTab(props: { plans: PacerPlan[] }) {
  const runs = usePacerRuns()
  const [open, setOpen] = useState<PacerRun | null>(null)
  const list = runs.data ?? []

  return (
    <div className="space-y-3">
      <ErrorNote error={runs.error} />
      <Widget title={`${list.length} αγώνες`}>
        {list.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted">Δεν υπάρχουν αποθηκευμένοι αγώνες</div>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(r)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{fmtDMY(r.run_date)}</div>
                    <div className="truncate text-xs text-muted">{props.plans.find((p) => p.id === r.plan_id)?.name ?? 'Πλάνο διαγράφηκε'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">{r.total_sec == null ? '—' : fmtClock(r.total_sec)}</div>
                    {r.total_sec != null && <div className="text-xs text-muted tabular-nums">{fmtPace(r.total_sec / MARATHON_KM)}/χλμ</div>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Widget>
      <RunSheet run={open} plans={props.plans} onClose={() => setOpen(null)} />
    </div>
  )
}

function RunSheet(props: { run: PacerRun | null; plans: PacerPlan[]; onClose: () => void }) {
  const del = useDeleteRow('pacer_runs')
  const run = props.run
  const plan = props.plans.find((p) => p.id === run?.plan_id)
  const scenarios = plan ? scenariosOf(plan) : []
  const main = scenarios[Math.min(MAIN, scenarios.length - 1)]
  const cum = main ? cumulative(main.laps) : null
  const laps = run ? lapsOf(run.laps) : []

  return (
    <Sheet
      open={!!run}
      onClose={props.onClose}
      title={run ? `${fmtDMY(run.run_date)} · ${run.total_sec == null ? '—' : fmtClock(run.total_sec)}` : ''}
      footer={
        run && (
          <Button variant="danger" className="w-full" onClick={() => del.mutate(run.id, { onSuccess: props.onClose })}>
            <Trash2 size={16} /> Διαγραφή αγώνα
          </Button>
        )
      }
    >
      <ErrorNote error={del.error} />
      <table className="w-full text-sm tabular-nums">
        <thead className="text-[11px] text-muted uppercase">
          <tr>
            <th className="text-left font-medium">Χλμ</th>
            <th className="text-right font-medium">Split</th>
            <th className="text-right font-medium">Pace</th>
            <th className="text-right font-medium">Σύνολο</th>
            {cum && <th className="text-right font-medium">vs {main.label}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {laps.map((l, i) => {
            const split = l.t - (laps[i - 1]?.t ?? 0)
            const d = cum ? l.t - cum[l.km - 1] : 0
            return (
              <tr key={l.km} className={l.est ? 'text-muted italic' : ''}>
                <td className="py-1.5">{l.km === LAP_COUNT ? 'τέρμα' : l.km}</td>
                <td className="py-1.5 text-right">{l.est && '~'}{fmtClock(split)}</td>
                <td className="py-1.5 text-right">{fmtPace(split / lapDist(l.km))}</td>
                <td className="py-1.5 text-right">{fmtClock(l.t)}</td>
                {cum && (
                  <td className={clsx('py-1.5 text-right', Math.abs(d) <= TOTAL_TOL ? 'text-good' : d > 0 ? 'text-bad' : 'text-warn')}>{fmtDelta(d)}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </Sheet>
  )
}
