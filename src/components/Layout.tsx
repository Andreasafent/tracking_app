import clsx from 'clsx'
import {
  Apple,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calculator,
  CalendarDays,
  Camera,
  ChartPie,
  Dumbbell,
  Footprints,
  House,
  Menu,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Target,
  Timer,
  Trophy,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import '../styles/pages.css'
import '../styles/layout.css'
import '../styles/ui.css'

type Item = { to: string; label: string; icon: LucideIcon }

/** The sidebar, grouped. Labels are the names used throughout the app. */
const GROUPS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [
      { to: '/', label: 'ΓΕΝΙΚΑ', icon: House },
      { to: '/macros', label: 'MACROS', icon: UtensilsCrossed },
      { to: '/calculator', label: 'CALCULATOR', icon: Calculator },
    ],
  },
  {
    title: 'Προπόνηση',
    items: [
      { to: '/training', label: 'TRAINING PLAN', icon: Dumbbell },
      { to: '/plan', label: 'TARGETS', icon: Target },
      { to: '/running', label: 'MARATHON BLOCK', icon: Footprints },
      { to: '/pacer', label: 'PACER', icon: Timer },
      { to: '/progress', label: 'PROGRESS / PBs', icon: Trophy },
    ],
  },
  {
    title: 'Φαγητό',
    items: [
      { to: '/meals', label: 'ΓΕΥΜΑΤΑ', icon: BookOpen },
      { to: '/foods', label: 'ΤΡΟΦΙΜΑ', icon: Apple },
      { to: '/shopping', label: 'ΛΙΣΤΑ ΑΓΟΡΩΝ', icon: ShoppingCart },
    ],
  },
  {
    title: 'Έξοδα',
    items: [
      { to: '/expenses', label: 'ΕΞΟΔΑ', icon: Wallet },
      { to: '/expense-analysis', label: 'ΑΝΑΛΥΣΗ ΕΞΟΔΩΝ', icon: ChartPie },
      { to: '/products', label: 'ΠΡΟΙΟΝΤΑ', icon: ShoppingBag },
    ],
  },
  {
    title: 'Στατιστικά',
    items: [
      { to: '/weekly', label: 'WEEKLY STATS', icon: BarChart3 },
      { to: '/monthly', label: 'MONTHLY STATS', icon: CalendarDays },
      { to: '/photos', label: 'ΦΩΤΟ ΠΡΟΟΔΟΥ', icon: Camera },
    ],
  },
  { title: null, items: [{ to: '/settings', label: 'ΡΥΘΜΙΣΕΙΣ', icon: Settings }] },
]

const ITEMS = GROUPS.flatMap((g) => g.items)

function SideContent(props: { onNavigate?: () => void }) {
  return (
    <>
      <div className="la-brand">
        <span className="la-mark" aria-hidden />
        Tracking
      </div>
      <nav className="la-nav">
        {GROUPS.map((g, gi) => (
          <div key={gi} className="la-groupwrap">
            {g.title && <div className="la-group">{g.title}</div>}
            {g.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={props.onNavigate}
                className={({ isActive }) => clsx('la-item', isActive && 'active')}
              >
                <Icon size={18} strokeWidth={1.8} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </>
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

/** The app frame: warm grey background, a floating sidebar card, content straight on the grey. */
export function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const current = ITEMS.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))

  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="la">
      <div className="la-shell">
        <aside className="la-side">
          <SideContent />
        </aside>

        <div className="la-col">
          <header className="la-bar">
            <button type="button" aria-label="Μενού" className="la-round" onClick={() => setOpen(true)}>
              <Menu size={20} />
            </button>
            <BackButton />
            <span className="la-bartitle">{current?.label}</span>
          </header>

          {open && (
            <div className="la-drawer">
              <div className="anim-fade la-backdrop" onClick={() => setOpen(false)} />
              <aside className="anim-from-left la-drawer-panel">
                <SideContent onNavigate={() => setOpen(false)} />
              </aside>
            </div>
          )}

          <main className="la-main">
            <div className="la-desktopback">
              <BackButton />
              <span>{current?.label}</span>
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
