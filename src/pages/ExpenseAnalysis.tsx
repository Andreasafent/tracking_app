import { ChevronDown, PieChart, ShoppingBag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Bar, ErrorNote, Grid, Hero, Stepper, Widget } from '../components/ui'
import { useExpenseCategories, useExpenseProducts, useExpenses } from '../lib/api'
import { MONTHS, monthRange, today } from '../lib/dates'
import { eur, groupByCategory } from '../lib/expenses'
import { num, signed } from '../lib/format'

export function ExpenseAnalysis() {
  const [params, setParams] = useSearchParams()
  const m = params.get('m') ?? today().slice(0, 7)
  const [year, month] = m.split('-').map(Number)
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }
  const range = monthRange(year, month)
  const prevRange = monthRange(prev.y, prev.m)
  const go = (y: number, mo: number) => setParams({ m: `${y}-${String(mo).padStart(2, '0')}` }, { replace: true })

  const expenses = useExpenses(prevRange.from, range.to)
  const products = useExpenseProducts().data ?? []
  const categories = useExpenseCategories().data ?? []
  const [open, setOpen] = useState<string | null>(null)

  const all = expenses.data ?? []
  const rows = useMemo(() => all.filter((e) => e.date >= range.from && e.date <= range.to), [all, range.from, range.to])
  const total = rows.reduce((a, e) => a + e.amount, 0)
  const prevTotal = all.filter((e) => e.date >= prevRange.from && e.date <= prevRange.to).reduce((a, e) => a + e.amount, 0)
  const groups = useMemo(() => groupByCategory(rows, products, categories), [rows, products, categories])
  const perProduct = groups
    .flatMap((g) => g.items.map((i) => ({ ...i, color: g.color })))
    .sort((a, b) => b.total - a.total)
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

  return (
    <div className="space-y-3">
      <Hero
        top={<Stepper label={`${MONTHS[month - 1]} ${year}`} onPrev={() => go(prev.y, prev.m)} onNext={() => go(next.y, next.m)} />}
        label="ΣΥΝΟΛΙΚΑ ΕΞΟΔΑ"
        value={eur(total)}
        sub={
          <>
            <b className="text-text">{prevTotal > 0 || total > 0 ? `${signed(total - prevTotal, 2)} €` : '—'}</b> από{' '}
            {MONTHS[prev.m - 1]} ({eur(prevTotal)}) · {num(rows.length, 0)} καταχωρήσεις
          </>
        }
      />
      <ErrorNote error={expenses.error} />

      {rows.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted">Δεν υπάρχουν έξοδα αυτό το μήνα</div>
      ) : (
        <Grid>
          <Widget title="Ανά κατηγορία" icon={<PieChart size={16} />}>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2">
              {groups.map((g) => (
                <div key={g.key} style={{ width: `${(g.total / total) * 100}%`, background: g.color }} />
              ))}
            </div>
            <ul className="mt-3 divide-y divide-line">
              {groups.map((g) => {
                const expanded = open === g.key
                return (
                  <li key={g.key}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : g.key)}
                      className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2"
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.label}</span>
                      <span className="text-xs text-muted">{pct(g.total)}%</span>
                      <span className="w-20 text-right text-sm font-bold">{eur(g.total)}</span>
                      <ChevronDown size={14} className={`shrink-0 text-muted transition ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {expanded && (
                      <ul className="anim-fade mb-2 space-y-2 pl-5">
                        {g.items.map((i) => (
                          <li key={i.label}>
                            <div className="flex items-baseline gap-2 text-sm">
                              <span className="min-w-0 flex-1 truncate">{i.label}</span>
                              {i.count > 1 && <span className="text-[11px] text-muted">×{i.count}</span>}
                              <span className="font-semibold">{eur(i.total)}</span>
                            </div>
                            <Bar value={i.total} max={g.total} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          </Widget>

          <Widget title="Ανά προϊόν" icon={<ShoppingBag size={16} />}>
            <ul className="space-y-3">
              {perProduct.map((i) => (
                <li key={i.label}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="size-2 shrink-0 self-center rounded-full" style={{ background: i.color }} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{i.label}</span>
                    {i.count > 1 && <span className="text-[11px] text-muted">×{i.count}</span>}
                    <span className="font-bold">{eur(i.total)}</span>
                  </div>
                  <div className="mt-1">
                    <Bar value={i.total} max={perProduct[0].total} />
                  </div>
                </li>
              ))}
            </ul>
          </Widget>
        </Grid>
      )}
    </div>
  )
}
