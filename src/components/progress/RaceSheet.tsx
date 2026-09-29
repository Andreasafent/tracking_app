import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useCreateDistance, useDeleteRow, useSaveRow } from '../../lib/api'
import type { DistanceEffort, PbDistance } from '../../lib/database.types'
import { today, type ISODate } from '../../lib/dates'
import { num } from '../../lib/format'
import {
  fmtLegPace,
  fmtLegs,
  fmtPace,
  fmtTime,
  legsOf,
  sameLegs,
  SPLITS,
  splitsOf,
  splitsTotal,
  toJson,
  TRI_FORMATS,
  type Legs,
  type Splits,
} from '../../lib/progress'
import { Button, DateInput, DurationInput, ErrorNote, Field, NumberInput, Segmented, Select, Sheet, TextInput } from '../ui'

const CUSTOM = '__custom'
/** Prefix for a standard triathlon format that has no pb_distances row yet. */
const FMT = 'fmt:'

/** "15K" for whole km, otherwise "12,5 km". */
const autoName = (km: number) => (Number.isInteger(km) ? `${km}K` : `${num(km, 3)} km`)

type Sport = PbDistance['sport']

type Form = {
  id?: string
  sport: Sport
  race_name: string
  date: ISODate
  /** Running: a distance id, or CUSTOM while typing one that isn't in the list. */
  distance_id: string
  custom_km: number | null
  custom_name: string
  /** Triathlon: a format's distance id, FMT + a standard format's name, or CUSTOM. */
  tri_id: string
  /** Custom triathlon legs in the units they're typed in (swim m, bike/run km). */
  tri_swim: number | null
  tri_bike: number | null
  tri_run: number | null
  tri_name: string
  splits: Splits
  time_sec: number | null
  goal_sec: number | null
  notes: string
}

export function RaceSheet(props: { race?: DistanceEffort; distances: PbDistance[]; onClose: () => void }) {
  const save = useSaveRow('distance_efforts')
  const del = useDeleteRow('distance_efforts')
  const createDistance = useCreateDistance()
  const r = props.race
  const runs = props.distances.filter((d) => d.sport === 'run')
  const tris = props.distances.filter((d) => d.sport === 'triathlon')
  const sport: Sport = (r && props.distances.find((d) => d.id === r.distance_id)?.sport) || 'run'

  const [f, setF] = useState<Form>({
    id: r?.id,
    sport,
    race_name: r?.race_name ?? '',
    date: r?.date ?? today(),
    distance_id: (sport === 'run' && r?.distance_id) || (runs.find((d) => d.meters === 42195) ?? runs[0])?.id || CUSTOM,
    custom_km: null,
    custom_name: '',
    tri_id: (sport === 'triathlon' && r?.distance_id) || tris[0]?.id || `${FMT}Olympic`,
    tri_swim: null,
    tri_bike: null,
    tri_run: null,
    tri_name: '',
    splits: r ? splitsOf(r) : {},
    time_sec: r?.time_sec ?? null,
    goal_sec: r?.goal_sec ?? null,
    notes: r?.notes ?? '',
  })
  const set = (v: Partial<Form>) => setF((x) => ({ ...x, ...v }))
  const setSplit = (k: keyof Splits, v: number | null) => setF((x) => ({ ...x, splits: { ...x.splits, [k]: v } }))

  const tri = f.sport === 'triathlon'
  const future = f.date > today()
  const busy = save.isPending || createDistance.isPending

  // Running distance
  const runCustom = f.distance_id === CUSTOM
  const meters = runCustom ? (f.custom_km ?? 0) * 1000 : (runs.find((x) => x.id === f.distance_id)?.meters ?? 0)

  // Triathlon format and its legs
  const triCustom = f.tri_id === CUSTOM
  const stdFormat = TRI_FORMATS.find((x) => FMT + x.name === f.tri_id)
  const legs: Legs | null = triCustom
    ? f.tri_swim && f.tri_bike && f.tri_run
      ? { swim: f.tri_swim, bike: f.tri_bike * 1000, run: f.tri_run * 1000 }
      : null
    : (stdFormat?.legs ?? legsOf(tris.find((x) => x.id === f.tri_id) ?? { legs: null }))
  const triOptions = [
    ...tris.map((x) => ({ value: x.id, label: x.name })),
    // Standard formats not created yet (matched by their legs, whatever they were named).
    ...TRI_FORMATS.filter((x) => !tris.some((d) => legsOf(d) && sameLegs(legsOf(d)!, x.legs))).map((x) => ({
      value: FMT + x.name,
      label: x.name,
    })),
    { value: CUSTOM, label: 'Custom…' },
  ]

  const splitTotal = splitsTotal(f.splits)
  const total = tri && splitTotal != null ? splitTotal : f.time_sec

  const dupName =
    createDistance.error?.message.includes('pb_distances_user_id_name_key') &&
    'Υπάρχει ήδη απόσταση με αυτό το όνομα — δώσε άλλο όνομα.'

  /** The race's distance id; a custom distance or new format reuses a matching one or is created. */
  const distanceId = async () => {
    if (!tri) {
      if (!runCustom) return f.distance_id
      const same = runs.find((x) => Math.abs(x.meters - meters) < 0.5)
      if (same) return same.id
      const created = await createDistance.mutateAsync({
        name: f.custom_name.trim() || autoName(f.custom_km!),
        meters: +meters.toFixed(1),
      })
      return created!.id
    }
    if (!triCustom && !stdFormat) return f.tri_id
    const l = legs!
    const same = tris.find((x) => legsOf(x) && sameLegs(legsOf(x)!, l))
    if (same) return same.id
    const created = await createDistance.mutateAsync({
      name: stdFormat?.name ?? (f.tri_name.trim() || `Custom ${fmtLegs(l)}`),
      meters: +(l.swim + l.bike + l.run).toFixed(1),
      sport: 'triathlon',
      legs: toJson(l),
    })
    return created!.id
  }

  const submit = async () =>
    save.mutate(
      {
        id: f.id,
        is_race: true,
        race_name: f.race_name.trim(),
        date: f.date,
        distance_id: await distanceId(),
        time_sec: future ? null : total,
        splits: tri && !future && splitTotal != null ? toJson(f.splits) : null,
        goal_sec: f.goal_sec,
        notes: f.notes.trim() || null,
      },
      { onSuccess: props.onClose },
    )

  const valid = !!f.race_name.trim() && !!f.date && (tri ? !!legs : !runCustom || !!f.custom_km)

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={r ? r.race_name || 'Αγώνας' : 'Νέος αγώνας'}
      footer={
        <div className="flex gap-2">
          {f.id && (
            <Button variant="danger" onClick={() => del.mutate(f.id!, { onSuccess: props.onClose })}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button className="flex-1" disabled={!valid || busy} onClick={() => submit().catch(() => {})}>
            Αποθήκευση
          </Button>
        </div>
      }
    >
      <ErrorNote error={dupName || createDistance.error || save.error || del.error} />
      <div className="mb-3">
        <Segmented
          value={f.sport}
          onChange={(v) => set({ sport: v })}
          options={[
            { value: 'run', label: 'Τρέξιμο' },
            { value: 'triathlon', label: 'Τρίαθλο' },
          ]}
        />
      </div>
      <TextInput
        value={f.race_name}
        onChange={(race_name) => set({ race_name })}
        placeholder={tri ? 'Όνομα (π.χ. Vouliagmeni Triathlon)' : 'Όνομα (π.χ. Αυθεντικός Μαραθώνιος)'}
      />
      <Field label="Ημερομηνία">
        <DateInput value={f.date} onChange={(date) => set({ date })} />
      </Field>

      {!tri ? (
        <>
          <Field label="Απόσταση">
            <Select
              value={f.distance_id}
              onChange={(distance_id) => set({ distance_id })}
              options={[...runs.map((x) => ({ value: x.id, label: x.name })), { value: CUSTOM, label: 'Custom…' }]}
            />
          </Field>
          {runCustom && (
            <div className="rounded-2xl bg-surface-2/60 px-3">
              <Field label="Custom απόσταση">
                <NumberInput value={f.custom_km} onChange={(custom_km) => set({ custom_km })} unit="km" />
              </Field>
              <div className="py-3">
                <TextInput
                  value={f.custom_name}
                  onChange={(custom_name) => set({ custom_name })}
                  placeholder={`Όνομα απόστασης (προαιρετικό${f.custom_km ? `, π.χ. ${autoName(f.custom_km)}` : ''})`}
                />
              </div>
              <p className="pb-3 text-xs text-muted">Θα προστεθεί και στις ΑΠΟΣΤΑΣΕΙΣ για να κρατάει PB.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <Field label="Format" hint={legs ? fmtLegs(legs) : undefined}>
            <Select value={f.tri_id} onChange={(tri_id) => set({ tri_id })} options={triOptions} />
          </Field>
          {triCustom && (
            <div className="rounded-2xl bg-surface-2/60 px-3">
              <Field label="Κολύμβηση">
                <NumberInput value={f.tri_swim} integer onChange={(tri_swim) => set({ tri_swim })} unit="m" />
              </Field>
              <Field label="Ποδήλατο">
                <NumberInput value={f.tri_bike} onChange={(tri_bike) => set({ tri_bike })} unit="km" />
              </Field>
              <Field label="Τρέξιμο">
                <NumberInput value={f.tri_run} onChange={(tri_run) => set({ tri_run })} unit="km" />
              </Field>
              <div className="py-3">
                <TextInput value={f.tri_name} onChange={(tri_name) => set({ tri_name })} placeholder="Όνομα format (προαιρετικό)" />
              </div>
            </div>
          )}
        </>
      )}

      <Field label="Στόχος" hint={f.goal_sec && !tri && meters ? fmtPace(f.goal_sec, meters) : 'Συνολικός χρόνος · προαιρετικό'}>
        <DurationInput value={f.goal_sec} onChange={(goal_sec) => set({ goal_sec })} />
      </Field>

      {!future && tri && (
        <div className="mt-2 rounded-2xl bg-surface-2/60 px-3">
          {SPLITS.map((x) => (
            <Field key={x.key} label={x.label} hint={fmtLegPace(x.key, f.splits[x.key], legs) ?? undefined}>
              <DurationInput value={f.splits[x.key]} onChange={(v) => setSplit(x.key, v)} />
            </Field>
          ))}
          {splitTotal != null ? (
            <div className="flex items-center justify-between py-3 text-sm">
              <span>Συνολικός χρόνος</span>
              <b className="text-lg tabular-nums">{fmtTime(splitTotal)}</b>
            </div>
          ) : (
            <Field label="Συνολικός χρόνος" hint="Ή συμπλήρωσε τα σκέλη από πάνω">
              <DurationInput value={f.time_sec} onChange={(time_sec) => set({ time_sec })} />
            </Field>
          )}
        </div>
      )}

      {!future && !tri && (
        <Field label="Τελικός χρόνος" hint={f.time_sec && meters ? fmtPace(f.time_sec, meters) : 'Κενό αν δεν τον έχεις ακόμα'}>
          <DurationInput value={f.time_sec} onChange={(time_sec) => set({ time_sec })} />
        </Field>
      )}

      <div className="pt-3">
        <TextInput value={f.notes} onChange={(notes) => set({ notes })} placeholder="Σημείωση (προαιρετικό)" />
      </div>
    </Sheet>
  )
}

/** "Κολύμβηση 32:10 · T1 2:05 · ..." under a triathlon result. */
export function SplitsLine(props: { splits: Splits }) {
  const parts = SPLITS.filter((x) => props.splits[x.key] != null)
  if (!parts.length) return null
  return (
    <div className="mt-0.5 truncate text-[11px] text-muted tabular-nums">
      {parts.map((x) => `${x.label} ${fmtTime(props.splits[x.key])}`).join(' · ')}
    </div>
  )
}
