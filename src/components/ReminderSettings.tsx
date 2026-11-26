import { Bell, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useDeleteRow, useReminders, useSaveRow } from '../lib/api'
import type { Reminder } from '../lib/database.types'
import { fmtDayDMY, today } from '../lib/dates'
import { occurrences, repeatLabel } from '../lib/reminders'
import { Button, DateInput, ErrorNote, Field, NumberInput, Select, Sheet, TextInput, Widget, YesNo } from './ui'

type Repeat = 'once' | 'day' | 'week' | 'month'

const REPEATS: { value: Repeat; label: string }[] = [
  { value: 'once', label: 'Μία φορά' },
  { value: 'day', label: 'Ημέρες' },
  { value: 'week', label: 'Εβδομάδες' },
  { value: 'month', label: 'Μήνες' },
]

export function ReminderSettings() {
  const query = useReminders()
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null)

  /** The next date it falls on, today included. */
  const nextDate = (r: Reminder) => {
    const { last, next } = occurrences(r, today())
    return last === today() ? last : next
  }

  return (
    <Widget title="Ειδοποιήσεις / Υπενθυμίσεις" icon={<Bell size={16} />}>
      <ErrorNote error={query.error} />
      <ul className="divide-y divide-line">
        {(query.data ?? []).map((r) => {
          const next = nextDate(r)
          return (
            <li key={r.id} className="py-1">
              <button
                type="button"
                onClick={() => setEditing(r)}
                className="ui-row -mx-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  <span className="block text-xs text-muted">
                    {repeatLabel(r)} · {next ? `επόμενη ${fmtDayDMY(next)}` : fmtDayDMY(r.start_date)}
                  </span>
                </span>
                <Pencil size={13} className="shrink-0 text-muted" />
              </button>
            </li>
          )
        })}
      </ul>
      <Button variant="ghost" className="mt-2 w-full" onClick={() => setEditing('new')}>
        <Plus size={16} /> Νέα υπενθύμιση
      </Button>
      {editing && <ReminderSheet reminder={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Widget>
  )
}

function ReminderSheet(props: { reminder?: Reminder; onClose: () => void }) {
  const r = props.reminder
  const save = useSaveRow('reminders')
  const del = useDeleteRow('reminders')
  const [name, setName] = useState(r?.name ?? '')
  const [start, setStart] = useState(r?.start_date ?? today())
  const [repeat, setRepeat] = useState<Repeat>(r ? (r.repeat_unit ?? 'once') : 'week')
  const [every, setEvery] = useState<number | null>(r?.repeat_every ?? 1)
  const [lead, setLead] = useState<number | null>(r?.lead_days ?? 1)
  const [autoPhoto, setAutoPhoto] = useState(r?.auto_photo ?? false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const repeats = repeat !== 'once'
  const valid =
    !!name.trim() &&
    !!start &&
    (!repeats || (every != null && Number.isInteger(every) && every > 0)) &&
    (lead == null || (Number.isInteger(lead) && lead >= 0))

  const submit = () => {
    const repeat_unit = repeats ? repeat : null
    const repeat_every = repeats ? every! : 1
    // A new schedule starts clean: what was done under the old one doesn't carry over.
    const rescheduled = !!r && (r.start_date !== start || r.repeat_unit !== repeat_unit || r.repeat_every !== repeat_every)
    save.mutate(
      {
        id: r?.id,
        name: name.trim(),
        start_date: start,
        repeat_unit,
        repeat_every,
        lead_days: lead ?? 0,
        auto_photo: autoPhoto,
        ...(rescheduled && { done_through: null }),
      },
      { onSuccess: props.onClose },
    )
  }

  return (
    <Sheet
      open
      onClose={props.onClose}
      title={r ? 'Επεξεργασία υπενθύμισης' : 'Νέα υπενθύμιση'}
      footer={
        <div className="flex gap-2">
          {r && (
            <Button
              variant="danger"
              disabled={del.isPending}
              onClick={() => (confirmDelete ? del.mutate(r.id, { onSuccess: props.onClose }) : setConfirmDelete(true))}
            >
              {confirmDelete ? 'Διαγραφή;' : <Trash2 size={16} />}
            </Button>
          )}
          <Button className="flex-1" disabled={!valid || save.isPending} onClick={submit}>
            Αποθήκευση
          </Button>
        </div>
      }
    >
      <ErrorNote error={save.error ?? del.error} />
      <TextInput value={name} onChange={setName} placeholder="Όνομα (π.χ. Φωτογραφία προόδου)" />
      <Field label="Επανάληψη">
        <Select value={repeat} onChange={setRepeat} options={REPEATS} />
      </Field>
      {repeats && (
        <Field label="Κάθε πόσες" hint={REPEATS.find((x) => x.value === repeat)!.label.toLowerCase()}>
          <NumberInput value={every} onChange={setEvery} integer step={1} min={1} />
        </Field>
      )}
      <Field label={repeats ? 'Πρώτη φορά' : 'Ημερομηνία'} hint={start ? fmtDayDMY(start) : undefined}>
        <DateInput value={start} onChange={setStart} />
      </Field>
      <Field label="Ειδοποίηση νωρίτερα" hint="0 = μόνο την ίδια μέρα">
        <NumberInput value={lead} onChange={setLead} integer step={1} min={0} unit="μέρ." />
      </Field>
      <Field label="Αφορά φωτογραφία" hint="Φεύγει μόνη της όταν ανεβάσεις φωτογραφία">
        <YesNo value={autoPhoto} onChange={(v) => setAutoPhoto(v ?? false)} />
      </Field>
    </Sheet>
  )
}
