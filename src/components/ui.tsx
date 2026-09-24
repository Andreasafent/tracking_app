import clsx from 'clsx'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { num, parseNum } from '../lib/format'

// ─── Hero: the big "balance" value at the top of every page
export function Hero(props: {
  label: string
  value: ReactNode
  unit?: string
  sub?: ReactNode
  top?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="hero-glow -mx-4 px-4 pt-4 pb-6 text-center lg:mx-0 lg:rounded-3xl">
      {props.top}
      <div className="mt-4 text-sm font-medium text-muted">{props.label}</div>
      <div className="mt-1 text-5xl font-bold tracking-tight">
        {props.value}
        {props.unit && <span className="ml-1 text-2xl font-semibold text-muted">{props.unit}</span>}
      </div>
      {props.sub && <div className="mt-2 text-sm text-muted">{props.sub}</div>}
      {props.children}
    </section>
  )
}

// ─── Prev / next navigator (dates, weeks, months)
export function Stepper(props: { label: ReactNode; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <IconButton onClick={props.onPrev} label="Προηγούμενο">
        <ChevronLeft size={18} />
      </IconButton>
      <div className="min-w-40 text-center text-sm font-semibold">{props.label}</div>
      <IconButton onClick={props.onNext} label="Επόμενο" disabled={props.nextDisabled}>
        <ChevronRight size={18} />
      </IconButton>
    </div>
  )
}

export function IconButton(props: { onClick: () => void; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      disabled={props.disabled}
      className="grid size-9 place-items-center rounded-full bg-surface-2 text-text transition duration-150 hover:bg-line active:scale-90 disabled:opacity-30 disabled:hover:bg-surface-2"
    >
      {props.children}
    </button>
  )
}

// ─── Quick actions: round buttons under the hero (Revolut's Add money / Exchange row)
export function QuickActions(props: { children: ReactNode }) {
  return <div className="mt-5 flex justify-center gap-5">{props.children}</div>
}

export function QuickAction(props: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} className="group flex w-16 flex-col items-center gap-1.5 transition active:scale-95">
      <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-text transition duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-white">
        {props.icon}
      </span>
      <span className="text-xs font-medium text-muted transition group-hover:text-text">{props.label}</span>
    </button>
  )
}

// ─── Widget card
export function Widget(props: {
  title: string
  icon?: ReactNode
  action?: ReactNode
  onClick?: () => void
  className?: string
  children: ReactNode
}) {
  // A clickable card is a div with button semantics (not a <button>), so it can hold its own buttons.
  // Inner buttons should stopPropagation so they don't also trigger the card.
  const clickable = props.onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick: props.onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            props.onClick!()
          }
        },
      }
    : {}
  return (
    <section
      {...clickable}
      className={clsx(
        'block w-full rounded-3xl bg-surface p-4 text-left',
        props.onClick &&
          'cursor-pointer transition duration-200 outline-none hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:ring-1 hover:ring-line focus-visible:ring-2 focus-visible:ring-accent active:translate-y-0 active:scale-[0.99]',
        props.className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {props.icon && <span className="text-accent">{props.icon}</span>}
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{props.title}</h2>
        <div className="ml-auto">{props.action}</div>
      </div>
      {props.children}
    </section>
  )
}

export function Grid(props: { children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={clsx('grid gap-3', props.cols === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2')}>{props.children}</div>
  )
}

/** A label + value pair inside widgets. */
export function Stat(props: { label: string; value: ReactNode; unit?: string; tone?: 'good' | 'bad' | 'warn' }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted uppercase">{props.label}</div>
      <div
        className={clsx(
          'text-lg font-semibold',
          props.tone === 'good' && 'text-good',
          props.tone === 'bad' && 'text-bad',
          props.tone === 'warn' && 'text-warn',
        )}
      >
        {props.value}
        {props.unit && <span className="ml-0.5 text-xs font-medium text-muted">{props.unit}</span>}
      </div>
    </div>
  )
}

export function Chip(props: { on: boolean | null | undefined; label: string; invert?: boolean }) {
  // invert: for things where "yes" is bad (alcohol, sugar, injury)
  const good = props.on == null ? null : props.invert ? !props.on : props.on
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        good == null && 'bg-surface-2 text-muted',
        good === true && 'bg-good/15 text-good',
        good === false && 'bg-bad/15 text-bad',
      )}
    >
      {props.label}
    </span>
  )
}

// ─── Ring progress
export function Ring(props: { value: number | null; max: number; size?: number; label?: ReactNode; over?: 'good' | 'bad' }) {
  const size = props.size ?? 96
  const stroke = 9
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = props.value == null || !props.max ? 0 : props.value / props.max
  const over = pct > 1
  const color = over ? (props.over === 'good' ? 'var(--good)' : 'var(--bad)') : 'var(--accent)'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(pct, 1))}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute text-center leading-tight">{props.label ?? <b>{Math.round(pct * 100)}%</b>}</div>
    </div>
  )
}

/** Ring for one macro: value in the middle, "/ target" under it, name below. No target → empty track. */
export function MacroRing(props: {
  label: string
  value: number | null | undefined
  target: number | null | undefined
  unit: string
  over: 'good' | 'bad'
  size?: number
}) {
  const size = props.size ?? 104
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Ring
        value={props.value ?? null}
        max={props.target ?? 0}
        size={size}
        over={props.over}
        label={
          <>
            <b className={size < 100 ? 'text-base' : 'text-lg'}>{num(props.value, 0)}</b>
            <div className="text-[10px] text-muted">
              {props.target ? `/ ${num(props.target, 0)} ${props.unit}` : props.unit}
            </div>
          </>
        }
      />
      <span className="text-center text-[11px] leading-tight font-semibold tracking-wider text-muted uppercase">
        {props.label}
        {!props.target && <span className="block text-[10px] font-medium tracking-normal normal-case">χωρίς στόχο</span>}
      </span>
    </div>
  )
}

export function Bar(props: { value: number | null; max: number | null; tone?: 'accent' | 'good' }) {
  const pct = props.value == null || !props.max ? 0 : Math.min(props.value / props.max, 1)
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
      <div
        className={clsx('h-full rounded-full', props.tone === 'good' ? 'bg-good' : 'bg-accent')}
        style={{ width: `${pct * 100}%`, transition: 'width 0.4s ease' }}
      />
    </div>
  )
}

// ─── Bottom sheet (modal on desktop)
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [props.open, props.onClose])

  if (!props.open) return null
  return (
    <div data-no-swipe className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onClose} />
      <div className="anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface lg:max-w-lg lg:rounded-3xl">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <h3 className="text-base font-semibold">{props.title}</h3>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Κλείσιμο"
            className="ml-auto grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{props.children}</div>
        {props.footer && (
          <div className="border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {props.footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function Button(props: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className={clsx(
        'inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40',
        (props.variant ?? 'primary') === 'primary' && 'bg-accent text-white hover:brightness-110',
        props.variant === 'ghost' && 'bg-surface-2 text-text hover:bg-line',
        props.variant === 'danger' && 'bg-bad/15 text-bad hover:bg-bad/25',
        props.className,
      )}
    >
      {props.children}
    </button>
  )
}

// ─── Form fields

export function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
      <span className="text-sm">
        {props.label}
        {props.hint && <span className="block text-xs text-muted">{props.hint}</span>}
      </span>
      {props.children}
    </label>
  )
}

/** Numeric input that accepts Greek commas and reports null when empty. */
export function NumberInput(props: {
  value: number | null | undefined
  onChange: (v: number | null) => void
  unit?: string
  placeholder?: string
  integer?: boolean
  className?: string
  /** Enables ↑/↓ keys and small up/down buttons that change the value by this amount. */
  step?: number
  min?: number
}) {
  const show = (v: number | null | undefined) => (v == null ? '' : String(v).replace('.', ','))
  const [text, setText] = useState(show(props.value))
  // Resync only when the value changes from outside (not while typing "82," etc.)
  useEffect(() => {
    if (parseNum(text) !== (props.value ?? null)) setText(show(props.value))
  }, [props.value])

  const bump = (dir: 1 | -1) => {
    if (!props.step) return
    const next = +((props.value ?? 0) + dir * props.step).toFixed(2)
    const v = Math.max(props.min ?? 0, next)
    setText(show(v))
    props.onChange(v)
  }

  return (
    <span className={clsx('flex items-center gap-1.5', props.className)}>
      <input
        inputMode={props.integer ? 'numeric' : 'decimal'}
        value={text}
        placeholder={props.placeholder ?? '—'}
        onChange={(e) => {
          setText(e.target.value)
          props.onChange(parseNum(e.target.value))
        }}
        onKeyDown={(e) => {
          if (!props.step) return
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            bump(e.key === 'ArrowUp' ? 1 : -1)
          }
        }}
        className={clsx(
          'h-10 rounded-xl bg-surface-2 px-3 text-right text-base font-semibold outline-none focus:ring-2 focus:ring-accent',
          props.step ? 'w-20' : 'w-24',
        )}
      />
      {props.step != null && (
        <span className="flex flex-col">
          {([1, -1] as const).map((d) => (
            <button
              key={d}
              type="button"
              tabIndex={-1}
              aria-label={d === 1 ? 'Αύξηση' : 'Μείωση'}
              onClick={() => bump(d)}
              className="grid h-5 w-6 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-text active:scale-90"
            >
              {d === 1 ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          ))}
        </span>
      )}
      {props.unit && <span className="w-8 text-xs text-muted">{props.unit}</span>}
    </span>
  )
}

/** ΝΑΙ / ΟΧΙ with an explicit "not logged" state (matters for x/7 counts). */
export function YesNo(props: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const opt = (v: boolean, label: string) => (
    <button
      type="button"
      onClick={() => props.onChange(props.value === v ? null : v)}
      className={clsx(
        'h-9 rounded-full px-4 text-sm font-semibold transition',
        props.value === v ? 'bg-accent text-white' : 'bg-surface-2 text-muted hover:bg-line hover:text-text',
      )}
    >
      {label}
    </button>
  )
  return (
    <span className="flex gap-1.5">
      {opt(true, 'ΝΑΙ')}
      {opt(false, 'ΟΧΙ')}
    </span>
  )
}

/** 0–10 scale in 0.5 steps (the ΛΙΣΤΕΣ scale). */
export function Scale(props: { label: string; value: number | null | undefined; onChange: (v: number | null) => void }) {
  const v = props.value
  return (
    <div className="border-b border-line py-3 last:border-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{props.label}</span>
        <span className="flex items-center gap-2">
          <b className={clsx('text-lg', v == null && 'text-muted')}>{v == null ? '—' : num(v)}</b>
          {v != null && (
            <button type="button" onClick={() => props.onChange(null)} className="text-xs text-muted transition hover:text-bad">
              καθαρ.
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={v ?? 5}
        onChange={(e) => props.onChange(Number(e.target.value))}
        onPointerDown={(e) => v == null && props.onChange(Number((e.target as HTMLInputElement).value))}
        className={clsx('w-full accent-[var(--accent)]', v == null && 'opacity-40')}
      />
    </div>
  )
}

/** Big +/− stepper (water). */
export function PlusMinus(props: { value: number | null | undefined; onChange: (v: number | null) => void; step: number; unit?: string }) {
  const v = props.value ?? 0
  return (
    <span className="flex items-center gap-2">
      <button type="button" className="grid size-9 place-items-center rounded-full bg-surface-2 text-lg transition hover:bg-line active:scale-90" onClick={() => props.onChange(Math.max(0, +(v - props.step).toFixed(2)))}>
        −
      </button>
      <b className="w-14 text-center text-lg">{props.value == null ? '—' : num(props.value, 2)}</b>
      <button type="button" className="grid size-9 place-items-center rounded-full bg-surface-2 text-lg transition hover:bg-line active:scale-90" onClick={() => props.onChange(+(v + props.step).toFixed(2))}>
        +
      </button>
      {props.unit && <span className="text-xs text-muted">{props.unit}</span>}
    </span>
  )
}

export function Select<T extends string>(props: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as T)}
      className="h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent"
    >
      {props.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Segmented<T extends string>(props: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex rounded-full bg-surface-2 p-1">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onChange(o.value)}
          className={clsx(
            'h-9 flex-1 rounded-full px-3 text-sm font-semibold transition',
            props.value === o.value ? 'bg-surface text-text shadow' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className="h-11 w-full rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent"
    />
  )
}

export function Loading() {
  return <div className="py-16 text-center text-sm text-muted">Φόρτωση…</div>
}

export function ErrorNote(props: { error: unknown }) {
  if (!props.error) return null
  const msg = props.error instanceof Error ? props.error.message : String(props.error)
  return <div className="rounded-2xl bg-bad/15 px-4 py-3 text-sm text-bad">{msg}</div>
}
