import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorNote, TextInput } from '../components/ui'
import '../styles/layout.css'
import '../styles/ui.css'
import '../styles/pages.css'

function useLoginForm() {
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

  return { email, setEmail, password, setPassword, mode, setMode, error, info, busy, submit }
}

/** The sign-in screen: warm grey, one floating card, ink button. */
export function Login() {
  const { email, setEmail, password, setPassword, mode, setMode, error, info, busy, submit } = useLoginForm()
  return (
    <div className="la la-login">
      <form onSubmit={submit} className="la-login-card">
        <div className="la-brand">
          <span className="la-mark" aria-hidden />
          Tracking
        </div>
        <p className="la-login-sub">{mode === 'in' ? 'Σύνδεση' : 'Δημιουργία λογαριασμού'}</p>
        <TextInput type="email" value={email} onChange={setEmail} placeholder="Email" />
        <TextInput type="password" value={password} onChange={setPassword} placeholder="Κωδικός" />
        <ErrorNote error={error} />
        {info && <div className="rounded-2xl bg-good/15 px-4 py-3 text-sm text-good">{info}</div>}
        <Button type="submit" disabled={busy || !email || !password} className="w-full">
          {mode === 'in' ? 'Σύνδεση' : 'Εγγραφή'}
        </Button>
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')} className="la-login-switch">
          {mode === 'in' ? 'Πρώτη φορά; Δημιουργία λογαριασμού' : 'Έχεις λογαριασμό; Σύνδεση'}
        </button>
      </form>
    </div>
  )
}
