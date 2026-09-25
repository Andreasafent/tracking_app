import clsx from 'clsx'
import {
  Apple,
  ArrowLeft,
  BarChart3,
  Calculator,
  CalendarDays,
  Footprints,
  House,
  Menu,
  Settings,
  Target,
  UtensilsCrossed,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'

export const NAV = [
  { to: '/', label: 'ΓΕΝΙΚΑ', icon: House },
  { to: '/macros', label: 'MACROS', icon: UtensilsCrossed },
  { to: '/calculator', label: 'CALCULATOR', icon: Calculator },
  { to: '/foods', label: 'ΤΡΟΦΙΜΑ', icon: Apple },
  { to: '/plan', label: 'NEW PLAN / ΣΤΟΧΟΙ', icon: Target },
  { to: '/running', label: 'KMAGE', icon: Footprints },
  { to: '/weekly', label: 'WEEKLY STATS', icon: BarChart3 },
  { to: '/monthly', label: 'MONTHLY STATS', icon: CalendarDays },
  { to: '/settings', label: 'ΡΥΘΜΙΣΕΙΣ', icon: Settings },
]

function NavList(props: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={props.onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition',
              isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:translate-x-0.5 hover:bg-surface-2 hover:text-text',
            )
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Back: previous in-app page if there is one, otherwise home. Hidden on home when there's nowhere to go. */
function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const hasHistory = location.key !== 'default'
  if (!hasHistory && location.pathname === '/') return null
  return (
    <button
      type="button"
      aria-label="Πίσω"
      onClick={() => (hasHistory ? navigate(-1) : navigate('/'))}
      className="grid size-9 place-items-center rounded-full text-text transition hover:bg-surface-2 active:scale-90"
    >
      <ArrowLeft size={20} />
    </button>
  )
}

export function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const current = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))

  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r border-line p-4 lg:flex">
        <div className="px-3 pt-2 text-lg font-extrabold tracking-tight">Tracking</div>
        <NavList />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-bg/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="Μενού"
          onClick={() => setOpen(true)}
          className="-ml-1 grid size-9 place-items-center rounded-full transition hover:bg-surface-2 active:scale-90"
        >
          <Menu size={22} />
        </button>
        <BackButton />
        <span className="text-sm font-bold tracking-wide">{current?.label}</span>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="anim-from-left absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-surface p-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div className="px-3 pt-2 text-lg font-extrabold tracking-tight">Tracking</div>
            <NavList onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full min-w-0 max-w-5xl overflow-x-clip px-4 pb-[max(2rem,env(safe-area-inset-bottom))] lg:px-8 lg:py-6">
        {/* Desktop top bar (mobile has its own header above) */}
        <div className="mb-2 hidden h-9 items-center gap-2 lg:flex">
          <BackButton />
          <span className="text-sm font-bold tracking-wide text-muted">{current?.label}</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
