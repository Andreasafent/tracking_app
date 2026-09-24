import { useEffect, useState } from 'react'
import { useSaveDailyLog } from '../lib/api'
import type { DailyLog } from '../lib/database.types'
import type { ISODate } from '../lib/dates'
import { Button, ErrorNote, Field, NumberInput, PlusMinus, Scale, Sheet, YesNo } from './ui'

type LogKey = Exclude<keyof DailyLog, 'user_id' | 'date' | 'updated_at' | 'notes'>

export type FieldSpec =
  | { key: LogKey; label: string; kind: 'num' | 'int'; unit?: string; hint?: string }
  | { key: LogKey; label: string; kind: 'bool' | 'scale' }
  | { key: LogKey; label: string; kind: 'water'; unit?: string }

export const GROUPS = {
  nutrition: {
    title: 'NUTRITION',
    fields: [
      { key: 'weight', label: 'ΒΑΡΟΣ', kind: 'num', unit: 'kg' },
      { key: 'creatine', label: 'ΚΡΕΑΤΙΝΗ', kind: 'bool' },
      { key: 'water', label: 'ΝΕΡΟ', kind: 'water', unit: 'lt' },
      { key: 'alcohol', label: 'ΑΛΚΟΟΛ', kind: 'bool' },
      { key: 'sugar', label: 'ΖΑΧΑΡΗ', kind: 'bool' },
      { key: 'burn_override', label: 'Cals BURNED', kind: 'int', unit: 'kcal', hint: 'Κενό = από την περίοδο' },
    ],
  },
  recovery: {
    title: 'RECOVERY / BODY METRICS',
    fields: [
      { key: 'sleep_hours', label: 'ΩΡΕΣ ΥΠΝΟΥ', kind: 'num', unit: 'h' },
      { key: 'sleep_quality', label: 'ΠΟΙΟΤΗΤΑ ΥΠΝΟΥ', kind: 'scale' },
      { key: 'energy', label: 'ΕΠΙΠΕΔΟ ΕΝΕΡΓΕΙΑΣ', kind: 'scale' },
      { key: 'fatigue', label: 'ΚΟΥΡΑΣΗ', kind: 'scale' },
      { key: 'resting_hr', label: 'RESTING HR', kind: 'int', unit: 'bpm' },
      { key: 'sleep_hr', label: 'SLEEP HR', kind: 'int', unit: 'bpm' },
      { key: 'hrv', label: 'HRV (SDNN)', kind: 'int', unit: 'ms' },
    ],
  },
  gym: {
    title: 'ΓΥΜΝΑΣΤΙΚΗ',
    fields: [
      { key: 'steps', label: 'ΒΗΜΑΤΑ', kind: 'int' },
      { key: 'active_rest', label: 'ACTIVE REST', kind: 'bool' },
      { key: 'injury', label: 'Injury / Pain', kind: 'bool' },
    ],
  },
  mental: {
    title: 'MENTAL / EMOTIONAL',
    fields: [
      { key: 'mood', label: 'ΔΙΑΘΕΣΗ', kind: 'scale' },
      { key: 'anxiety', label: 'ΑΓΧΟΣ', kind: 'scale' },
      { key: 'motivation', label: 'ΚΙΝΗΤΡΟ', kind: 'scale' },
      { key: 'focus', label: 'ΣΥΓΚΕΝΤΡΩΣΗ', kind: 'scale' },
      { key: 'hunger', label: 'ΠΕΙΝΑ', kind: 'scale' },
      { key: 'sleepiness', label: 'ΝΥΣΤΑ', kind: 'scale' },
    ],
  },
  metrics: {
    title: 'ΜΕΤΡΗΣΕΙΣ',
    fields: [
      { key: 'waist', label: 'ΜΕΣΗ', kind: 'num', unit: 'cm' },
      { key: 'chest', label: 'ΣΤΗΘΟΣ', kind: 'num', unit: 'cm' },
      { key: 'hips', label: 'ΓΟΦΟΙ', kind: 'num', unit: 'cm' },
      { key: 'thigh', label: 'ΜΗΡΟΣ', kind: 'num', unit: 'cm' },
      { key: 'calf', label: 'ΓΑΜΠΑ', kind: 'num', unit: 'cm' },
      { key: 'glutes', label: 'ΓΛΟΥΤΟΙ', kind: 'num', unit: 'cm' },
      { key: 'arm', label: 'ΒΡΑΧΙΟΝΑΣ', kind: 'num', unit: 'cm' },
    ],
  },
} satisfies Record<string, { title: string; fields: FieldSpec[] }>

export type GroupKey = keyof typeof GROUPS

type Draft = Partial<Pick<DailyLog, LogKey>>

export function useDraft(log: DailyLog | null | undefined, fields: readonly FieldSpec[], open: boolean) {
  const [draft, setDraft] = useState<Draft>({})
  useEffect(() => {
    if (open) setDraft(Object.fromEntries(fields.map((f) => [f.key, log?.[f.key] ?? null])) as Draft)
  }, [open, log, fields])
  return [draft, (k: LogKey, v: number | boolean | null) => setDraft((d) => ({ ...d, [k]: v }) as Draft)] as const
}

export function FieldRows(props: {
  fields: readonly FieldSpec[]
  draft: Draft
  set: (k: LogKey, v: number | boolean | null) => void
}) {
  return (
    <div>
      {props.fields.map((f) => {
        const v = props.draft[f.key]
        switch (f.kind) {
          case 'scale':
            return <Scale key={f.key} label={f.label} value={v as number | null} onChange={(x) => props.set(f.key, x)} />
          case 'bool':
            return (
              <Field key={f.key} label={f.label}>
                <YesNo value={v as boolean | null} onChange={(x) => props.set(f.key, x)} />
              </Field>
            )
          case 'water':
            return (
              <Field key={f.key} label={f.label}>
                <PlusMinus value={v as number | null} step={0.25} unit={f.unit} onChange={(x) => props.set(f.key, x)} />
              </Field>
            )
          default:
            return (
              <Field key={f.key} label={f.label} hint={'hint' in f ? f.hint : undefined}>
                <NumberInput
                  value={v as number | null}
                  unit={f.unit}
                  integer={f.kind === 'int'}
                  onChange={(x) => props.set(f.key, x == null ? null : f.kind === 'int' ? Math.round(x) : x)}
                />
              </Field>
            )
        }
      })}
    </div>
  )
}

/** Bottom sheet editing one ΓΕΝΙΚΑ group for a date. */
export function GroupSheet(props: {
  group: GroupKey | null
  date: ISODate
  log: DailyLog | null | undefined
  onClose: () => void
}) {
  const spec = props.group ? GROUPS[props.group] : null
  const fields = spec?.fields ?? []
  const [draft, set] = useDraft(props.log, fields, !!spec)
  const save = useSaveDailyLog()

  return (
    <Sheet
      open={!!spec}
      onClose={props.onClose}
      title={spec?.title ?? ''}
      footer={
        <Button
          className="w-full"
          disabled={save.isPending}
          onClick={() => save.mutate({ date: props.date, ...draft }, { onSuccess: props.onClose })}
        >
          Αποθήκευση
        </Button>
      }
    >
      <ErrorNote error={save.error} />
      <FieldRows fields={fields} draft={draft} set={set} />
    </Sheet>
  )
}
