import { Archive, ArchiveRestore, LogOut, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, ErrorNote, Field, Hero, Segmented, Select, Sheet, TextInput, Widget } from '../components/ui'
import { useActivities, useActivityUsage, useDeleteRow, useSaveRow } from '../lib/api'
import type { Activity } from '../lib/database.types'
import { num } from '../lib/format'
import { supabase } from '../lib/supabase'

type Theme = 'system' | 'light' | 'dark'
type Unit = 'none' | 'km' | 'm'

const UNITS: { value: Unit; label: string }[] = [
  { value: 'none', label: 'Καμία' },
  { value: 'km', label: 'km' },
  { value: 'm', label: 'm' },
]

function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme')
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(readTheme)
  const activities = useActivities().data ?? []
  const save = useSaveRow('activities')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('none')
  const [editing, setEditing] = useState<Activity | null>(null)

  function applyTheme(t: Theme) {
    setTheme(t)
    try {
      if (t === 'system') localStorage.removeItem('theme')
      else localStorage.setItem('theme', t)
    } catch {
      /* storage unavailable */
    }
    if (t === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
  }

  return (
    <div className="space-y-3">
      <Hero label="ΡΥΘΜΙΣΕΙΣ" value="⚙︎" />

      <Widget title="Εμφάνιση">
        <Segmented
          value={theme}
          onChange={applyTheme}
          options={[
            { value: 'system', label: 'Αυτόματο' },
            { value: 'dark', label: 'Σκούρο' },
            { value: 'light', label: 'Φωτεινό' },
          ]}
        />
      </Widget>

      <Widget title="Δραστηριότητες">
        <ErrorNote error={save.error} />
        <ul className="divide-y divide-line">
          {activities.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => setEditing(a)}
                className="-ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-surface-2"
              >
                <span className={a.archived ? 'flex-1 truncate text-sm text-muted line-through' : 'flex-1 truncate text-sm font-semibold'}>
                  {a.name}
                </span>
                <span className="text-xs text-muted">{a.distance_unit ?? 'χωρίς απόσταση'}</span>
                <Pencil size={13} className="shrink-0 text-muted" />
              </button>
              <button
                type="button"
                aria-label={a.archived ? 'Επαναφορά' : 'Απόκρυψη'}
                className="text-muted transition hover:text-text active:scale-90"
                onClick={() => save.mutate({ id: a.id, name: a.name, archived: !a.archived })}
              >
                {a.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <TextInput value={name} onChange={setName} placeholder="Νέα δραστηριότητα (π.χ. Περπάτημα)" />
          <Field label="Μονάδα απόστασης">
            <Select value={unit} onChange={setUnit} options={UNITS} />
          </Field>
          <Button
            variant="ghost"
            className="w-full"
            disabled={!name.trim() || save.isPending}
            onClick={() =>
              save.mutate(
                { name: name.trim(), distance_unit: unit === 'none' ? null : unit, sort: activities.length + 1 },
                { onSuccess: () => setName('') },
              )
            }
          >
            <Plus size={16} /> Προσθήκη
          </Button>
        </div>
      </Widget>

      <ActivitySheet activity={editing} onClose={() => setEditing(null)} />

      <Button variant="danger" className="w-full" onClick={() => supabase.auth.signOut()}>
        <LogOut size={16} /> Αποσύνδεση
      </Button>
    </div>
  )
}

function ActivitySheet(props: { activity: Activity | null; onClose: () => void }) {
  const a = props.activity
  const save = useSaveRow('activities')
  const del = useDeleteRow('activities')
  const usage = useActivityUsage(a?.id ?? null)
  const used = usage.data ?? 0
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<Unit>('none')
  const [confirmDelete, setConfirmDelete] = useState(false)
  useEffect(() => {
    if (!a) return
    setName(a.name)
    setUnit((a.distance_unit ?? 'none') as Unit)
    setConfirmDelete(false)
    save.reset()
    del.reset()
  }, [a])

  const unitChanged = !!a && (a.distance_unit ?? 'none') !== unit

  return (
    <Sheet
      open={!!a}
      onClose={props.onClose}
      title="Επεξεργασία δραστηριότητας"
      footer={
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={!usage.isSuccess || used > 0 || del.isPending}
            onClick={() => (confirmDelete ? del.mutate(a!.id, { onSuccess: props.onClose }) : setConfirmDelete(true))}
          >
            {confirmDelete ? 'Διαγραφή;' : <Trash2 size={16} />}
          </Button>
          <Button
            className="flex-1"
            disabled={!name.trim() || save.isPending}
            onClick={() =>
              save.mutate(
                { id: a!.id, name: name.trim(), distance_unit: unit === 'none' ? null : unit },
                { onSuccess: props.onClose },
              )
            }
          >
            Αποθήκευση
          </Button>
        </div>
      }
    >
      <ErrorNote error={save.error ?? del.error ?? usage.error} />
      <TextInput value={name} onChange={setName} placeholder="Όνομα" />
      <Field label="Μονάδα απόστασης">
        <Select value={unit} onChange={setUnit} options={UNITS} />
      </Field>
      {unitChanged && used > 0 && (
        <p className="text-xs text-warn">
          Οι {num(used, 0)} προπονήσεις που υπάρχουν κρατούν τον αριθμό τους όπως είναι (δεν μετατρέπονται){unit === 'none' && ' και η απόσταση δεν θα εμφανίζεται'}.
        </p>
      )}
      {usage.isSuccess && used > 0 && (
        <p className="mt-3 text-xs text-muted">
          Χρησιμοποιείται σε {num(used, 0)} {used === 1 ? 'προπόνηση' : 'προπονήσεις'}, οπότε δεν διαγράφεται. Μπορείς να την
          αποκρύψεις από τη λίστα με το εικονίδιο αρχειοθέτησης.
        </p>
      )}
    </Sheet>
  )
}
