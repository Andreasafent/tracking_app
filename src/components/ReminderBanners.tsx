import clsx from 'clsx'
import { Bell, Camera, Check } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useReminders, useSaveRow } from '../lib/api'
import { diffDays, fmtDayDMY, today } from '../lib/dates'
import { useBodyPhotos } from '../lib/photos'
import { reminderState } from '../lib/reminders'
import { ErrorNote } from './ui'

/** Pending reminders as of today (whatever day the page is showing). */
export function ReminderBanners() {
  const reminders = useReminders()
  const photos = useBodyPhotos()
  const save = useSaveRow('reminders')
  const navigate = useNavigate()
  const now = today()

  // Wait for the photos too, so an already-satisfied reminder doesn't flash.
  if (!reminders.data || photos.isLoading) return <ErrorNote error={reminders.error} />
  const lastPhoto = photos.data?.[0]?.taken_on ?? null

  const pending = reminders.data
    .flatMap((r) => {
      const s = reminderState(r, now, lastPhoto)
      return s ? [{ r, ...s }] : []
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="mb-2.5 space-y-2.5 empty:hidden">
      <ErrorNote error={save.error} />
      {pending.map(({ r, date, state }) => {
        const days = Math.abs(diffDays(date, now))
        const when =
          state === 'due'
            ? 'Σήμερα'
            : state === 'upcoming'
              ? days === 1
                ? 'Αύριο'
                : `Σε ${days} μέρες`
              : days === 1
                ? 'Εκκρεμεί από χθες'
                : `Εκκρεμεί ${days} μέρες`
        return (
          <div key={r.id} className="flex items-center gap-3 rounded-3xl bg-surface p-3 pl-4">
            <Bell size={18} className={clsx('shrink-0', state === 'upcoming' ? 'text-accent' : 'text-warn')} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.name}</div>
              <div className={clsx('text-xs', state === 'overdue' ? 'text-warn' : 'text-muted')}>
                {when} · {fmtDayDMY(date)}
              </div>
            </div>
            {r.auto_photo && (
              <button
                type="button"
                aria-label="Ανέβασμα φωτογραφίας"
                onClick={() => navigate('/photos')}
                className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 transition hover:bg-line active:scale-90"
              >
                <Camera size={16} />
              </button>
            )}
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate({ id: r.id, name: r.name, start_date: r.start_date, done_through: date })}
              className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent transition hover:brightness-110 active:scale-95"
            >
              <Check size={14} /> Έγινε
            </button>
          </div>
        )
      })}
    </div>
  )
}
