import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { supabase } from './lib/supabase'
import { Calculator } from './pages/Calculator'
import { Foods } from './pages/Foods'
import { Genika } from './pages/Genika'
import { Login } from './pages/Login'
import { Macros } from './pages/Macros'
import { Meals } from './pages/Meals'
import { Monthly } from './pages/Monthly'
import { Plan } from './pages/Plan'
import { Running } from './pages/Running'
import { SettingsPage } from './pages/Settings'
import { Weekly } from './pages/Weekly'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loading />
  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Genika />} />
        <Route path="macros" element={<Macros />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="meals" element={<Meals />} />
        <Route path="foods" element={<Foods />} />
        <Route path="plan" element={<Plan />} />
        <Route path="running" element={<Running />} />
        <Route path="weekly" element={<Weekly />} />
        <Route path="monthly" element={<Monthly />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Genika />} />
      </Route>
    </Routes>
  )
}
