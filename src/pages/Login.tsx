import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorNote, TextInput } from '../components/ui'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const res =
      mode === 'in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (res.error) setError(res.error.message)
    else if (mode === 'up' && !res.data.session) setInfo('Ο λογαριασμός δημιουργήθηκε. Επιβεβαίωσε το email σου και μετά συνδέσου.')
  }

  return (
    <div className="hero-glow grid min-h-dvh place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-3xl bg-surface p-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Tracking</h1>
        <p className="pb-2 text-sm text-muted">{mode === 'in' ? 'Σύνδεση' : 'Δημιουργία λογαριασμού'}</p>
        <TextInput type="email" value={email} onChange={setEmail} placeholder="Email" />
        <TextInput type="password" value={password} onChange={setPassword} placeholder="Κωδικός" />
        <ErrorNote error={error} />
        {info && <div className="rounded-2xl bg-good/15 px-4 py-3 text-sm text-good">{info}</div>}
        <Button type="submit" disabled={busy || !email || !password} className="w-full">
          {mode === 'in' ? 'Σύνδεση' : 'Εγγραφή'}
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
          className="w-full pt-1 text-center text-xs text-muted"
        >
          {mode === 'in' ? 'Πρώτη φορά; Δημιουργία λογαριασμού' : 'Έχεις λογαριασμό; Σύνδεση'}
        </button>
      </form>
    </div>
  )
}
