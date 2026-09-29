import clsx from 'clsx'
import { Check, Flag, Plus, Timer, Trash2, Trophy, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useAddDistances, useDeleteRow, useDistanceEfforts, usePbDistances, useSaveRow } from '../../lib/api'
import type { DistanceEffort, PbDistance } from '../../lib/database.types'
import { addDays, fmtDMY, fmtShort, today, type ISODate } from '../../lib/dates'
import {
  bestEffort,
  countdown,
  DEFAULT_DISTANCES,
  fmtKm,
  fmtPace,
  fmtTime,
  isUpcoming,
  pbIds,
  predict,
} from '../../lib/progress'
import { TrendChart } from '../Charts'
import { Button, DateInput, DurationInput, ErrorNote, Field, Grid, Hero, NumberInput, QuickAction, QuickActions, Sheet, Stat, TextInput, Widget, YesNo } from '../ui'

/** Offers the standard distances when there are none yet (shared with the races tab). */
export function DefaultDistances() {
  const add = useAddDistances()
  return (
    <Widget title="Αποστάσεις" icon={<Flag size={16} />}>
      <p className="mb-3 text-sm text-muted">Δεν έχεις αποστάσεις ακόμα. Ξεκίνα με τις βασικές ή πρόσθεσε δικές σου.</p>
      <ErrorNote error={add.error} />
      <Button disabled={add.isPending} onClick={() => add.mutate(DEFAULT_DISTANCES)}>
        <Plus size={16} /> 1K, 5K, 10K, Ημιμαραθώνιος, Μαραθώνιος
      </Button>
    </Widget>
  )
}

export function DistancesTab(props: { tabs: ReactNode }) {
  const distancesQ = usePbDistances()
  const effortsQ = useDistanceEfforts()
  // Triathlon formats live on the races tab.
  const distances = (distancesQ.data ?? []).filter((d) => d.sport === 'run')
  const all = effortsQ.data ?? []
  const runIds = new Set(distances.map((d) => d.id))
  const efforts = all.filter((e) => runIds.has(e.distance_id))
  const t = today()
  const [open, setOpen] = useState<{ id?: string } | null>(null)
  // Looked up live so renames show straight away.
  const openDistance = open?.id ? distances.find((d) => d.id === open.id) : undefined

  const effortsOf = (id: string) => efforts.filter((e) => e.distance_id === id)
  const pbs90 = distances.reduce((n, d) => {
    const ids = pbIds(effortsOf(d.id))
    return n + effortsOf(d.id).filter((e) => ids.has(e.id) && e.date > addDays(t, -90)).length
  }, 0)
  const next = all.filter((e) => isUpcoming(e, t) && e.date >= t)[0]
  const nextDist = next && (distancesQ.data ?? []).find((d) => d.id === next.distance_id)

  return (
    <div className="space-y-3">
      <Hero
        top={props.tabs}
        label="PBs · ΤΕΛΕΥΤΑΙΕΣ 90 ΜΕΡΕΣ"
        value={pbs90}
        sub={
          next ? (
            <>
              Επόμενος αγώνας: <b className="text-text">{next.race_name || nextDist?.name}</b> {countdown(next.date, t)}
            </>
          ) : (
            `${distances.length} αποστάσεις · ${efforts.filter((e) => e.time_sec != null).length} χρόνοι`
          )
        }
      >
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Απόσταση" onClick={() => setOpen({})} />
        </QuickActions>
      </Hero>

      <ErrorNote error={distancesQ.error ?? effortsQ.error} />

      {!distancesQ.isLoading && distances.length === 0 && <DefaultDistances />}

      <Grid>
        {distances.map((d) => {
          const list = effortsOf(d.id)
          const best = bestEffort(list)
          const last = list.filter((e) => e.time_sec != null).at(-1)
          const pred = predict(d, distances, efforts, t)
          return (
            <Widget
              key={d.id}
              title={d.name}
              icon={<Timer size={16} />}
              action={<span className="text-xs text-muted">{fmtKm(d.meters)}</span>}
              onClick={() => setOpen({ id: d.id })}
            >
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="text-3xl font-bold tracking-tight tabular-nums">{fmtTime(best?.time_sec)}</div>
                  <div className="text-xs text-muted">
                    {best ? `${fmtPace(best.time_sec, d.meters)} · ${fmtDMY(best.date)}` : 'Χωρίς χρόνο ακόμα'}
                  </div>
                </div>
                {best && <Trophy size={20} className="mb-1 text-warn" />}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                <Stat label="Χρόνοι" value={list.filter((e) => e.time_sec != null).length} />
                <Stat label="Τελευταίος" value={<span className="tabular-nums">{fmtTime(last?.time_sec)}</span>} />
                <Stat label="Πρόβλεψη" value={<span className="tabular-nums">{fmtTime(pred?.sec)}</span>} />
              </div>
            </Widget>
          )
        })}
      </Grid>

      {distances.length > 0 && (
        <p className="px-2 text-xs text-muted">
          Πρόβλεψη: τύπος Riegel από το καλύτερο σου χρόνο (τελευταίο 12μηνο) σε άλλη απόσταση ≥ 1,5 km.
        </p>
      )}

      {open && (!open.id || openDistance) && (
        <DistanceSheet distance={openDistance} distances={distances} allEfforts={efforts} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

type Form = { id?: string; date: ISODate; time_sec: number | null; is_race: boolean; race_name: string; notes: string }
const blank = (): Form => ({ date: today(), time_sec: null, is_race: false, race_name: '', notes: '' })

function DistanceSheet(props: {
  distance?: PbDistance
  distances: PbDistance[]
  allEfforts: DistanceEffort[]
  onClose: () => void
}) {
  const saveDist = useSaveRow('pb_distances')
  const delDist = useDeleteRow('pb_distances')
  const saveEffort = useSaveRow('distance_efforts')
  const delEffort = useDeleteRow('distance_efforts')
  const d = props.distance
  const [name, setName] = useState(d?.name ?? '')
  const [km, setKm] = useState<number | null>(d ? d.meters / 1000 : null)
  const [form, setForm] = useState<Form>(blank())
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (v: Partial<Form>) => {
    setForm((f) => ({ ...f, ...v }))
    setSaved(false)
  }

  const t = today()
  const efforts = d ? props.allEfforts.filter((e) => e.distance_id === d.id) : []
  const timed = efforts.filter((e) => e.time_sec != null)
  const best = bestEffort(efforts)
  const pbs = pbIds(efforts)
  const pred = d && predict(d, props.distances, props.allEfforts, t)
  const recent = timed.slice(-3)
  const recentAvg = recent.length ? recent.reduce((a, e) => a + e.time_sec!, 0) / recent.length : null

  const dupName = (e: unknown) =>
    e instanceof Error && e.message.includes('pb_distances_user_id_name_key') ? 'Υπάρχει ήδη απόσταση με αυτό το όνομα.' : e
  const error = dupName(saveDist.error) || delDist.error || saveEffort.error || delEffort.error

  const saveDistance = () =>
    saveDist.mutate(
      { id: d?.id, name: name.trim(), meters: +(km! * 1000).toFixed(1) },
      { onSuccess: () => !d && props.onClose() },
    )

  // Running best after each effort, so the chart shows the PB line stepping down.
  const chartData = timed.map((e, i) => ({
    label: fmtShort(e.date),
    time: e.time_sec,
    pb: Math.min(...timed.slice(0, i + 1).map((x) => x.time_sec!)),
  }))

  if (!d) {
    return (
      <Sheet
        open
        onClose={props.onClose}
        title="Νέα απόσταση"
        footer={
          <Button className="w-full" disabled={!name.trim() || !km || saveDist.isPending} onClick={saveDistance}>
            Δημιουργία
          </Button>
        }
      >
        <ErrorNote error={error} />
        <TextInput value={name} onChange={setName} placeholder="Όνομα (π.χ. 3K, Ημιμαραθώνιος)" />
        <Field label="Απόσταση">
          <NumberInput value={km} onChange={setKm} unit="km" />
        </Field>
      </Sheet>
    )
  }

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={`${d.name} · ${fmtKm(d.meters)}`}
      footer={
        <div className="flex gap-2">
          {form.id && (
            <Button variant="ghost" onClick={() => setForm(blank())}>
              Νέος
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!form.time_sec || !form.date || saveEffort.isPending}
            onClick={() =>
              saveEffort.mutate(
                {
                  id: form.id,
                  distance_id: d.id,
                  date: form.date,
                  time_sec: form.time_sec,
                  is_race: form.is_race,
                  race_name: form.is_race ? form.race_name.trim() || null : null,
                  notes: form.notes.trim() || null,
                },
                {
                  onSuccess: () => {
                    setForm(blank())
                    setSaved(true)
                  },
                },
              )
            }
          >
            {saved ? (
              <>
                <Check size={16} /> Αποθηκεύτηκε
              </>
            ) : form.id ? (
              `Ενημέρωση ${fmtDMY(form.date)}`
            ) : (
              'Καταγραφή χρόνου'
            )}
          </Button>
        </div>
      }
    >
      <ErrorNote error={error} />

      <div className="rounded-2xl bg-surface-2/60 px-3">
        <Field label="Ημερομηνία">
          <DateInput value={form.date} onChange={(date) => set({ date })} />
        </Field>
        <Field label="Χρόνος" hint={form.time_sec ? fmtPace(form.time_sec, d.meters) : 'ώρες : λεπτά : δευτ.'}>
          <DurationInput value={form.time_sec} onChange={(time_sec) => set({ time_sec })} />
        </Field>
        <Field label="Αγώνας;">
          <YesNo value={form.is_race} onChange={(v) => set({ is_race: !!v })} />
        </Field>
        {form.is_race && (
          <div className="pb-3">
            <TextInput value={form.race_name} onChange={(race_name) => set({ race_name })} placeholder="Όνομα αγώνα" />
          </div>
        )}
        <div className="py-3">
          <TextInput value={form.notes} onChange={(notes) => set({ notes })} placeholder="Σημείωση (προαιρετικό)" />
        </div>
      </div>

      {timed.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="PB" value={<span className="tabular-nums">{fmtTime(best?.time_sec)}</span>} />
          <Stat label="PB ρυθμός" value={fmtPace(best?.time_sec, d.meters).replace(' /km', '')} unit="/km" />
          <Stat
            label={pred ? `Πρόβλ. (${pred.from.name})` : 'Μ.Ο. 3 τελευτ.'}
            value={<span className="tabular-nums">{fmtTime(pred ? pred.sec : recentAvg)}</span>}
          />
        </div>
      )}

      {timed.length > 1 && (
        <div className="mt-4">
          <TrendChart
            data={chartData}
            x="label"
            height={170}
            reversed
            yFormat={fmtTime}
            series={[
              { key: 'time', label: 'Χρόνος', color: 'var(--series-1)', format: fmtTime },
              { key: 'pb', label: 'PB', color: 'var(--series-3)', format: fmtTime },
            ]}
            footer={<p className="mt-1 text-right text-[11px] text-muted">↑ πιο γρήγορα</p>}
          />
        </div>
      )}

      {efforts.length > 0 && (
        <>
          <h4 className="mt-5 mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Ιστορικό</h4>
          <ul className="divide-y divide-line">
            {[...efforts].reverse().map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-1">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      id: e.id,
                      date: e.date,
                      time_sec: e.time_sec,
                      is_race: e.is_race,
                      race_name: e.race_name ?? '',
                      notes: e.notes ?? '',
                    })
                  }
                  className={clsx(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition hover:bg-surface-2',
                    form.id === e.id && 'bg-accent-soft',
                  )}
                >
                  <span className="w-20 shrink-0 text-xs text-muted">{fmtDMY(e.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold tabular-nums">{fmtTime(e.time_sec)}</span>
                    {e.time_sec != null && <span className="ml-2 text-xs text-muted">{fmtPace(e.time_sec, d.meters)}</span>}
                    {(e.race_name || e.notes) && (
                      <span className="block truncate text-xs text-muted">
                        {[e.race_name, e.notes].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  {e.is_race && (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {isUpcoming(e, t) ? countdown(e.date, t) : 'Αγώνας'}
                    </span>
                  )}
                  {pbs.has(e.id) && <Trophy size={14} className="shrink-0 text-warn" aria-label="PB" />}
                </button>
                <button
                  type="button"
                  aria-label="Διαγραφή"
                  onClick={() => {
                    delEffort.mutate(e.id)
                    if (form.id === e.id) setForm(blank())
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-bad active:scale-90"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-5 rounded-2xl bg-surface-2/60 px-3 py-2">
        <summary className="py-1 text-sm font-semibold text-muted">Ρυθμίσεις απόστασης</summary>
        <div className="space-y-2 py-2">
          <TextInput value={name} onChange={setName} placeholder="Όνομα" />
          <Field label="Απόσταση">
            <NumberInput value={km} onChange={setKm} unit="km" />
          </Field>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => (confirmDelete ? delDist.mutate(d.id, { onSuccess: props.onClose }) : setConfirmDelete(true))}
            >
              <Trash2 size={16} />
              {confirmDelete && `Διαγραφή μαζί με ${efforts.length} χρόνους;`}
            </Button>
            <Button
              variant="ghost"
              className="flex-1"
              disabled={!name.trim() || !km || saveDist.isPending || (name.trim() === d.name && km * 1000 === d.meters)}
              onClick={saveDistance}
            >
              Αποθήκευση
            </Button>
          </div>
        </div>
      </details>
    </Sheet>
  )
}
