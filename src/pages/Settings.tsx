import { Archive, ArchiveRestore, LogOut, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button, ErrorNote, Field, Hero, Segmented, Select, TextInput, Widget } from '../components/ui'
import { useActivities, useSaveRow } from '../lib/api'
import { supabase } from '../lib/supabase'

type Theme = 'system' | 'light' | 'dark'

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
  const [unit, setUnit] = useState<'none' | 'km' | 'm'>('none')

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
              <span className={a.archived ? 'flex-1 text-sm text-muted line-through' : 'flex-1 text-sm font-semibold'}>
                {a.name}
              </span>
              <span className="text-xs text-muted">{a.distance_unit ?? 'χωρίς απόσταση'}</span>
              <button
                type="button"
                aria-label={a.archived ? 'Επαναφορά' : 'Απόκρυψη'}
                className="text-muted"
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
            <Select
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'none', label: 'Καμία' },
                { value: 'km', label: 'km' },
                { value: 'm', label: 'm' },
              ]}
            />
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

      <Button variant="danger" className="w-full" onClick={() => supabase.auth.signOut()}>
        <LogOut size={16} /> Αποσύνδεση
      </Button>
    </div>
  )
}
