import clsx from 'clsx'
import { CalendarDays, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { fmtDMY } from '../lib/dates'
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
    <section className="ui-hero -mx-4 px-4 pt-4 pb-6 text-center lg:mx-0 lg:rounded-3xl">
      {props.top}
      <div className="ui-hero-label mt-4 text-sm font-medium text-muted">{props.label}</div>
      <div className="ui-hero-value mt-1 text-5xl font-bold tracking-tight">
        {props.value}
        {props.unit && <span className="ui-hero-unit ml-1 text-2xl font-semibold text-muted">{props.unit}</span>}
      </div>
      {props.sub && <div className="ui-hero-sub mt-2 text-sm text-muted">{props.sub}</div>}
      {props.children}
    </section>
  )
}

// ─── Quick actions: round buttons under the hero (Revolut's Add money / Exchange row)
export function QuickActions(props: { children: ReactNode }) {
  return <div className="ui-qa mt-5 flex justify-center gap-5">{props.children}</div>
}

export function QuickAction(props: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={props.onClick} className="ui-qa-btn group flex w-16 flex-col items-center gap-1.5 transition active:scale-95">
      <span className="ui-qa-c grid size-12 place-items-center rounded-full bg-surface-2 text-text transition duration-200 group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-white">
        {props.icon}
      </span>
      <span className="ui-qa-l text-xs font-medium text-muted transition group-hover:text-text">{props.label}</span>
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
        'ui-widget block w-full min-w-0 rounded-3xl bg-surface p-4 text-left',
        props.onClick &&
          'cursor-pointer transition duration-200 outline-none hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 hover:ring-1 hover:ring-line focus-visible:ring-2 focus-visible:ring-accent active:translate-y-0 active:scale-[0.99]',
        props.className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        {props.icon && <span className="text-accent">{props.icon}</span>}
        <h2 className="ui-widget-title text-xs font-semibold tracking-wider text-muted uppercase">{props.title}</h2>
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
    <div className="ui-stat">
      <div className="ui-stat-label text-[11px] font-medium text-muted uppercase">{props.label}</div>
      <div
        className={clsx(
          'ui-stat-value text-lg font-semibold',
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
    <div data-no-swipe className="ui-sheet fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      <div className="ui-backdrop anim-fade absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onClose} />
      <div className="ui-sheet-panel anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface lg:max-w-lg lg:rounded-3xl">
        <div className="ui-sheet-head flex items-center gap-2 border-b border-line px-5 py-4">
          <h3 className="ui-sheet-title text-base font-semibold">{props.title}</h3>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Κλείσιμο"
            className="ui-sheet-close ml-auto grid size-8 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-text"
          >
            <X size={20} />
          </button>
        </div>
        <div className="ui-sheet-body flex-1 overflow-y-auto px-5 py-4">{props.children}</div>
        {props.footer && (
          <div className="ui-sheet-foot border-t border-line px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
        'ui-btn inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40',
        `ui-btn-${props.variant ?? 'primary'}`,
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
    <label className="ui-field flex items-center justify-between gap-4 border-b border-line py-3 last:border-0">
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
          'ui-num-input h-10 rounded-xl bg-surface-2 px-3 text-right text-base font-semibold outline-none focus:ring-2 focus:ring-accent',
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
      {props.unit && <span className="ui-unit w-8 text-xs text-muted">{props.unit}</span>}
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
        'ui-pill h-9 rounded-full px-4 text-sm font-semibold transition',
        props.value === v ? 'on bg-accent text-white' : 'bg-surface-2 text-muted hover:bg-line hover:text-text',
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
    <div className="ui-field border-b border-line py-3 last:border-0">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span>{props.label}</span>
        <span className="flex items-center gap-2">
          <b className={clsx('ui-scale-val text-lg', v == null && 'text-muted')}>{v == null ? '—' : num(v)}</b>
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
        style={{ '--p': `${((v ?? 5) / 10) * 100}%` } as React.CSSProperties}
        className={clsx('ui-range w-full accent-[var(--accent)]', v == null && 'opacity-40')}
      />
    </div>
  )
}

/** Big +/− stepper (water). */
export function PlusMinus(props: { value: number | null | undefined; onChange: (v: number | null) => void; step: number; unit?: string }) {
  const v = props.value ?? 0
  return (
    <span className="flex items-center gap-2">
      <button type="button" className="ui-step grid size-9 place-items-center rounded-full bg-surface-2 text-lg transition hover:bg-line active:scale-90" onClick={() => props.onChange(Math.max(0, +(v - props.step).toFixed(2)))}>
        −
      </button>
      <b className="w-14 text-center text-lg">{props.value == null ? '—' : num(props.value, 2)}</b>
      <button type="button" className="ui-step grid size-9 place-items-center rounded-full bg-surface-2 text-lg transition hover:bg-line active:scale-90" onClick={() => props.onChange(+(v + props.step).toFixed(2))}>
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
      className="ui-select h-10 rounded-xl bg-surface-2 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-accent"
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
    <div className="ui-seg flex rounded-full bg-surface-2 p-1">
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => props.onChange(o.value)}
          className={clsx(
            'ui-seg-b h-9 flex-1 rounded-full px-3 text-sm font-semibold transition',
            props.value === o.value ? 'on bg-surface text-text shadow' : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Date field shown as dd/mm/yyyy whatever the browser locale. A transparent native date input
 * sits on top so tapping anywhere opens the system date picker.
 */
export function DateInput(props: { value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <span className="ui-date relative inline-flex h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-sm font-semibold focus-within:ring-2 focus-within:ring-accent">
      <span className={clsx('tabular-nums', !props.value && 'text-muted')}>{props.value ? fmtDMY(props.value) : 'ηη/μμ/εεεε'}</span>
      <CalendarDays size={16} className="text-muted" />
      <input
        type="date"
        value={props.value ?? ''}
        onChange={(e) => props.onChange(e.target.value)}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker()
          } catch {
            // Older browsers: the native control handles the tap itself.
          }
        }}
        className="absolute inset-0 h-full w-full opacity-0"
      />
    </span>
  )
}

/** Duration as separate h / m / s boxes (phone keypads have no ':'). Reports seconds, or null when empty. */
export function DurationInput(props: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const split = (v: number | null | undefined) =>
    v == null
      ? ['', '', '']
      : [Math.floor(v / 3600), Math.floor((v % 3600) / 60), +(v % 60).toFixed(1)].map((n, i) =>
          i === 0 && n === 0 ? '' : String(n).replace('.', ','),
        )
  const [parts, setParts] = useState(split(props.value))
  const total = (p: string[]) => {
    if (p.every((x) => x.trim() === '')) return null
    const [h, m, s] = p.map((x) => parseNum(x) ?? 0)
    const t = h * 3600 + m * 60 + s
    return t > 0 ? +t.toFixed(1) : null
  }
  // Resync only when the value changes from outside.
  useEffect(() => {
    if (total(parts) !== (props.value ?? null)) setParts(split(props.value))
  }, [props.value])

  return (
    <span className="flex items-center gap-1">
      {(['ώ', 'λ', 'δ'] as const).map((u, i) => (
        <span key={u} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-muted">:</span>}
          <input
            inputMode={i === 2 ? 'decimal' : 'numeric'}
            value={parts[i]}
            placeholder={i === 0 ? '0' : '00'}
            aria-label={['Ώρες', 'Λεπτά', 'Δευτερόλεπτα'][i]}
            onChange={(e) => {
              const next = parts.map((x, j) => (j === i ? e.target.value : x))
              setParts(next)
              props.onChange(total(next))
            }}
            className="ui-box h-10 w-12 rounded-xl bg-surface-2 px-1 text-center text-base font-semibold outline-none focus:ring-2 focus:ring-accent"
          />
        </span>
      ))}
    </span>
  )
}

export function TextInput(props: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      className="ui-text h-11 w-full rounded-xl bg-surface-2 px-3 text-base outline-none focus:ring-2 focus:ring-accent"
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
