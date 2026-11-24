import clsx from 'clsx'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { ErrorNote } from '../components/ui'
import { useExpenseCategories, useExpenseProducts, useExpenses } from '../lib/api'
import { MONTHS, monthRange, today } from '../lib/dates'
import { eur, groupByCategory, moneyNum } from '../lib/expenses'
import { num, signed } from '../lib/format'
import '../styles/pages.css'

/** A month of spending: the total, the split by category and the ranking by product. */
export function ExpenseAnalysis() {
  const [params, setParams] = useSearchParams()
  const now = today().slice(0, 7)
  const m = params.get('m') ?? now
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
  const perProduct = groups.flatMap((g) => g.items.map((i) => ({ ...i, color: g.color }))).sort((a, b) => b.total - a.total)
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

  return (
    <div className="da da-flat">
      <header className="da-top">
        <div>
          <h2 className="da-title">{MONTHS[month - 1]}</h2>
          <div className="da-date">{year}</div>
        </div>
        <div className="da-nav">
          <button type="button" className="da-today" disabled={m === now} onClick={() => setParams({}, { replace: true })}>
            Τώρα
          </button>
          <button type="button" aria-label="Προηγούμενος μήνας" onClick={() => go(prev.y, prev.m)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Επόμενος μήνας" onClick={() => go(next.y, next.m)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <ErrorNote error={expenses.error} />

      <div className="da-grid">
        <section className="da-card da-dark da-full">
          <div className="da-row">
            <span>Συνολικά έξοδα</span>
          </div>
          <div className="da-num da-hero">
            {moneyNum(total)}
            <small>€</small>
          </div>
          <div className="da-caption">
            <b>{prevTotal > 0 || total > 0 ? `${signed(total - prevTotal, 2)} €` : '—'}</b> από {MONTHS[prev.m - 1]} ({eur(prevTotal)}) ·{' '}
            {num(rows.length, 0)} καταχωρήσεις
          </div>
        </section>

        {rows.length === 0 ? (
          <p className="da-empty da-full">Δεν υπάρχουν έξοδα αυτό το μήνα</p>
        ) : (
          <>
            <section className="da-card da-span2">
              <h3>Ανά κατηγορία</h3>
              <div className="ma-stack">
                {groups.map((g) => (
                  <i key={g.key} style={{ width: `${(g.total / total) * 100}%`, background: g.color }} />
                ))}
              </div>
              <ul className="ea-cats">
                {groups.map((g) => {
                  const expanded = open === g.key
                  return (
                    <li key={g.key} className="ea-cat">
                      <button type="button" aria-expanded={expanded} className="ea-cat-head" onClick={() => setOpen(expanded ? null : g.key)}>
                        <span className="ma-dot ea-dot" style={{ background: g.color }} />
                        <span className="ea-name">{g.label}</span>
                        <span className="ea-pct">{pct(g.total)}%</span>
                        <span className="ma-entry-kcal">{eur(g.total)}</span>
                        <ChevronDown size={14} className={clsx('ma-ico ea-chev', expanded && 'open')} />
                      </button>
                      {expanded && (
                        <ul className="ea-items anim-fade">
                          {g.items.map((i) => (
                            <li key={i.label}>
                              <div className="ea-item-row">
                                <span className="ea-name">{i.label}</span>
                                {i.count > 1 && <span className="ea-pct">×{i.count}</span>}
                                <b>{eur(i.total)}</b>
                              </div>
                              <div className="da-bar da-bar-thin" style={{ color: g.color }}>
                                <i style={{ width: `${(i.total / g.total) * 100}%` }} />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="da-card da-span2">
              <h3>Ανά προϊόν</h3>
              <ul className="ea-items ea-products">
                {perProduct.map((i) => (
                  <li key={`${i.label}-${i.color}`}>
                    <div className="ea-item-row">
                      <span className="ma-dot ea-dot" style={{ background: i.color }} />
                      <span className="ea-name">{i.label}</span>
                      {i.count > 1 && <span className="ea-pct">×{i.count}</span>}
                      <b>{eur(i.total)}</b>
                    </div>
                    <div className="da-bar da-bar-thin" style={{ color: i.color }}>
                      <i style={{ width: `${(i.total / perProduct[0].total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
