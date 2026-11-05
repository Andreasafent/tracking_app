import { Copy, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useDeleteRow, useSaveRow } from '../../lib/api'
import type { Json, PacerPlan } from '../../lib/database.types'
import { cumulative, fmtClock, fmtPace, lapDist, LAP_COUNT, scenariosOf, segmentsOf, type Scenario } from '../../lib/pacer'
import { Button, ErrorNote, Field, NumberInput, Select, Sheet, TextInput, Widget } from '../ui'

/** The plan: the section cheat sheet, the per-km table (tap a row to edit its paces) and plan management. */
export function PlanTab(props: { plans: PacerPlan[] }) {
  const [id, setId] = useState(props.plans[0].id)
  const plan = props.plans.find((p) => p.id === id) ?? props.plans[0]
  const scenarios = scenariosOf(plan)
  const segments = segmentsOf(plan)
  const cums = scenarios.map((s) => cumulative(s.laps))
  const [editKm, setEditKm] = useState<number | null>(null)
  const [renaming, setRenaming] = useState(false)

  return (
    <div className="space-y-3">
      <Widget
        title="Πλάνο"
        action={
          <div className="flex gap-1">
            <PlanActions plan={plan} count={props.plans.length} onRename={() => setRenaming(true)} onGone={() => setId(props.plans.find((p) => p.id !== plan.id)!.id)} />
          </div>
        }
      >
        {props.plans.length > 1 ? (
          <Select value={plan.id} onChange={setId} options={props.plans.map((p) => ({ value: p.id, label: p.name }))} />
        ) : (
          <div className="text-sm font-semibold">{plan.name}</div>
        )}
      </Widget>

      {segments.length > 0 && (
        <Widget title="Ρυθμός ανά τμήμα (/χλμ)">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-[11px] text-muted uppercase">
              <tr>
                <th className="text-left font-medium">Τμήμα</th>
                {scenarios.map((s) => (
                  <th key={s.label} className="text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {segments.map((seg) => (
                <tr key={seg.label}>
                  <td className="py-2 pr-2">{seg.label}</td>
                  {seg.paces.map((p, i) => (
                    <td key={i} className="py-2 text-right">
                      {fmtPace(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Widget>
      )}

      <Widget title="Ανά χιλιόμετρο">
        <p className="mb-2 text-xs text-muted">Σύνολο και pace ανά στόχο. Πάτα μια γραμμή για να αλλάξεις το pace.</p>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-[11px] text-muted uppercase">
            <tr>
              <th className="text-left font-medium">Χλμ</th>
              {scenarios.map((s) => (
                <th key={s.label} className="text-right font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Array.from({ length: LAP_COUNT }, (_, i) => i + 1).map((km) => (
              <tr key={km} onClick={() => setEditKm(km)} className="cursor-pointer transition hover:bg-surface-2">
                <td className="py-2 pl-1">{km === LAP_COUNT ? 'τέρμα' : km}</td>
                {scenarios.map((s, si) => (
                  <td key={s.label} className="py-2 text-right">
                    <div className="font-semibold">{fmtClock(cums[si][km - 1])}</div>
                    <div className="text-[11px] text-muted">{fmtPace(s.laps[km - 1] / lapDist(km))}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Widget>

      <EditLapSheet plan={plan} km={editKm} onClose={() => setEditKm(null)} />
      <RenameSheet plan={plan} open={renaming} onClose={() => setRenaming(false)} />
    </div>
  )
}

function PlanActions(props: { plan: PacerPlan; count: number; onRename: () => void; onGone: () => void }) {
  const save = useSaveRow('pacer_plans')
  const del = useDeleteRow('pacer_plans')
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  const btn = 'grid size-8 place-items-center rounded-full bg-surface-2 text-muted transition hover:bg-line hover:text-text active:scale-90 disabled:opacity-30'
  return (
    <>
      <button type="button" aria-label="Μετονομασία" title="Μετονομασία" className={btn} onClick={props.onRename}>
        <Pencil size={14} />
      </button>
      <button
        type="button"
        aria-label="Αντίγραφο"
        title="Αντίγραφο πλάνου"
        disabled={save.isPending}
        className={btn}
        onClick={() =>
          save.mutate({ name: `${props.plan.name} (αντίγραφο)`, scenarios: props.plan.scenarios, segments: props.plan.segments })
        }
      >
        <Copy size={14} />
      </button>
      <button
        type="button"
        aria-label={armed ? 'Επιβεβαίωση διαγραφής' : 'Διαγραφή'}
        title="Διαγραφή πλάνου"
        disabled={props.count < 2 || del.isPending}
        className={armed ? 'anim-fade h-8 rounded-full bg-bad px-3 text-xs font-semibold text-white' : btn}
        onClick={() => {
          if (armed) del.mutate(props.plan.id, { onSuccess: props.onGone })
          else setArmed(true)
        }}
      >
        {armed ? 'Διαγραφή;' : <Trash2 size={14} />}
      </button>
    </>
  )
}

function RenameSheet(props: { plan: PacerPlan; open: boolean; onClose: () => void }) {
  const save = useSaveRow('pacer_plans')
  const [name, setName] = useState('')
  useEffect(() => {
    if (props.open) setName(props.plan.name)
  }, [props.open, props.plan.name])
  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="Όνομα πλάνου"
      footer={
        <Button className="w-full" disabled={!name.trim() || save.isPending} onClick={() => save.mutate({ id: props.plan.id, name: name.trim(), scenarios: props.plan.scenarios }, { onSuccess: props.onClose })}>
          Αποθήκευση
        </Button>
      }
    >
      <ErrorNote error={save.error} />
      <TextInput value={name} onChange={setName} placeholder="Όνομα" />
    </Sheet>
  )
}

/** Edit one lap's time for every scenario. Cumulative times follow from the laps. */
function EditLapSheet(props: { plan: PacerPlan; km: number | null; onClose: () => void }) {
  const save = useSaveRow('pacer_plans')
  const scenarios = scenariosOf(props.plan)
  const [vals, setVals] = useState<number[]>([])
  useEffect(() => {
    if (props.km != null) setVals(scenarios.map((s) => s.laps[props.km! - 1]))
    // Re-init only when a different km is opened.
  }, [props.km])
  const km = props.km

  const onSave = () => {
    const next: Scenario[] = scenarios.map((s, i) => {
      const laps = s.laps.map((v, j) => (j === km! - 1 ? vals[i] : v))
      return { ...s, laps, target_sec: laps.reduce((a, b) => a + b, 0) }
    })
    save.mutate({ id: props.plan.id, name: props.plan.name, scenarios: next as unknown as Json }, { onSuccess: props.onClose })
  }

  return (
    <Sheet
      open={km != null}
      onClose={props.onClose}
      title={km === LAP_COUNT ? 'Τελευταία 195 μ.' : `Χιλιόμετρο ${km}`}
      footer={
        <Button className="w-full" disabled={save.isPending || vals.some((v) => !(v > 0))} onClick={onSave}>
          Αποθήκευση
        </Button>
      }
    >
      <ErrorNote error={save.error} />
      <p className="mb-1 text-xs text-muted">
        {km === LAP_COUNT ? 'Ο χρόνος για τα τελευταία 195 μέτρα.' : 'Ο χρόνος του χιλιομέτρου (= pace/χλμ).'} Οι συνολικοί χρόνοι από εδώ και
        πέρα ξαναϋπολογίζονται.
      </p>
      {scenarios.map((s, i) => (
        <Field key={s.label} label={s.label}>
          <span className="flex items-center gap-1.5">
            <NumberInput integer value={Math.floor((vals[i] ?? 0) / 60)} onChange={(m) => setVals((v) => v.map((x, j) => (j === i ? (m ?? 0) * 60 + (x % 60) : x)))} unit="λ" className="[&_input]:w-14" />
            <NumberInput integer value={(vals[i] ?? 0) % 60} onChange={(sec) => setVals((v) => v.map((x, j) => (j === i ? Math.floor(x / 60) * 60 + (sec ?? 0) : x)))} unit="δ" className="[&_input]:w-14" />
          </span>
        </Field>
      ))}
    </Sheet>
  )
}
