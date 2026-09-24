import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useActivities, useDeleteWorkout, useSaveDailyLog, useSaveWorkout, useWorkouts } from '../lib/api'
import type { DailyLog } from '../lib/database.types'
import type { ISODate } from '../lib/dates'
import { num } from '../lib/format'
import { FieldRows, GROUPS, useDraft } from './DailyFields'
import { Button, ErrorNote, Field, NumberInput, Scale, Select, Sheet } from './ui'

/** ΓΥΜΝΑΣΤΙΚΗ: sessions (activity + distance + duration + RPE) plus the per-day fields. */
export function WorkoutSheet(props: { open: boolean; date: ISODate; log: DailyLog | null | undefined; onClose: () => void }) {
  const activities = useActivities().data?.filter((a) => !a.archived) ?? []
  const workouts = useWorkouts(props.date).data ?? []
  const saveWorkout = useSaveWorkout()
  const deleteWorkout = useDeleteWorkout()
  const saveLog = useSaveDailyLog()
  const [draft, set] = useDraft(props.log, GROUPS.gym.fields, props.open)

  const [activityId, setActivityId] = useState('')
  const [distance, setDistance] = useState<number | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [rpe, setRpe] = useState<number | null>(null)

  useEffect(() => {
    if (!activityId && activities.length) setActivityId(activities[0].id)
  }, [activities, activityId])

  const activity = activities.find((a) => a.id === activityId)
  const byId = (id: string) => activities.find((a) => a.id === id)

  function addWorkout() {
    saveWorkout.mutate(
      {
        date: props.date,
        activity_id: activityId,
        distance: activity?.distance_unit ? distance : null,
        duration_min: duration,
        rpe,
      },
      {
        onSuccess: () => {
          setDistance(null)
          setDuration(null)
          setRpe(null)
        },
      },
    )
  }

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="ΓΥΜΝΑΣΤΙΚΗ"
      footer={
        <Button
          className="w-full"
          disabled={saveLog.isPending}
          onClick={() => saveLog.mutate({ date: props.date, ...draft }, { onSuccess: props.onClose })}
        >
          Αποθήκευση
        </Button>
      }
    >
      <ErrorNote error={saveWorkout.error ?? deleteWorkout.error ?? saveLog.error} />

      {workouts.length > 0 && (
        <ul className="mb-4 space-y-2">
          {workouts.map((w) => {
            const a = byId(w.activity_id)
            return (
              <li key={w.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold">{a?.name ?? '—'}</div>
                  <div className="text-xs text-muted">
                    {[
                      w.distance != null && `${num(w.distance, 2)} ${a?.distance_unit ?? ''}`,
                      w.duration_min != null && `${num(w.duration_min, 0)} min`,
                      w.rpe != null && `RPE ${num(w.rpe)}`,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </div>
                </div>
                <button type="button" aria-label="Διαγραφή" className="text-muted" onClick={() => deleteWorkout.mutate(w.id)}>
                  <Trash2 size={18} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="rounded-2xl border border-line p-3">
        <div className="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Νέα δραστηριότητα</div>
        <Field label="Δραστηριότητα">
          <Select value={activityId} onChange={setActivityId} options={activities.map((a) => ({ value: a.id, label: a.name }))} />
        </Field>
        {activity?.distance_unit && (
          <Field label="Απόσταση">
            <NumberInput value={distance} onChange={setDistance} unit={activity.distance_unit} />
          </Field>
        )}
        <Field label="Διάρκεια">
          <NumberInput value={duration} onChange={setDuration} unit="min" integer />
        </Field>
        <Scale label="RPE" value={rpe} onChange={setRpe} />
        <Button variant="ghost" className="mt-2 w-full" disabled={!activityId || saveWorkout.isPending} onClick={addWorkout}>
          + Προσθήκη
        </Button>
      </div>

      <div className="mt-4">
        <FieldRows fields={GROUPS.gym.fields} draft={draft} set={set} />
      </div>
    </Sheet>
  )
}
