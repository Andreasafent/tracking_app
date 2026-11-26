import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Layout } from './components/Layout'
import { Loading } from './components/ui'
import { supabase } from './lib/supabase'
import { Calculator } from './pages/Calculator'
import { ExpenseAnalysis } from './pages/ExpenseAnalysis'
import { Expenses } from './pages/Expenses'
import { Foods } from './pages/Foods'
import { Genika } from './pages/Genika'
import { Login } from './pages/Login'
import { Macros } from './pages/Macros'
import { Meals } from './pages/Meals'
import { Monthly } from './pages/Monthly'
import { Pacer } from './pages/Pacer'
import { Photos } from './pages/Photos'
import { Plan } from './pages/Plan'
import { Products } from './pages/Products'
import { Progress } from './pages/Progress'
import { Running } from './pages/Running'
import { SettingsPage } from './pages/Settings'
import { Shopping } from './pages/Shopping'
import { Training } from './pages/Training'
import { Weekly } from './pages/Weekly'

/** The preview used to live under /a; old bookmarks land on the same page at the root. */
function LegacyPreview() {
  const { pathname, search } = useLocation()
  return <Navigate to={(pathname.replace(/^\/a/, '') || '/') + search} replace />
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Loading />
  if (!session) return <Login />
  return <AppRoutes />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Genika />} />
        <Route path="macros" element={<Macros />} />
        <Route path="calculator" element={<Calculator />} />
        <Route path="training" element={<Training />} />
        <Route path="plan" element={<Plan />} />
        <Route path="running" element={<Running />} />
        <Route path="pacer" element={<Pacer />} />
        <Route path="progress" element={<Progress />} />
        <Route path="meals" element={<Meals />} />
        <Route path="foods" element={<Foods />} />
        <Route path="shopping" element={<Shopping />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="expense-analysis" element={<ExpenseAnalysis />} />
        <Route path="products" element={<Products />} />
        <Route path="weekly" element={<Weekly />} />
        <Route path="monthly" element={<Monthly />} />
        <Route path="photos" element={<Photos />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="a/*" element={<LegacyPreview />} />
        <Route path="*" element={<Genika />} />
      </Route>
    </Routes>
  )
}
