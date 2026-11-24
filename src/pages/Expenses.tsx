import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DuePayments } from '../components/DuePayments'
import { ExpenseSheet, type ExpenseTarget } from '../components/ExpenseSheet'
import { ErrorNote } from '../components/ui'
import { useDeleteRow, useExpenseCategories, useExpenseProducts, useExpenses } from '../lib/api'
import { addDays, fmtDay, monthRange, relativeDayLabel, today } from '../lib/dates'
import { eur, expenseTitle, moneyNum } from '../lib/expenses'
import { useDateParam } from '../lib/useDateParam'
import { useSwipe } from '../lib/useSwipe'
import '../styles/pages.css'

/** The day's expenses (free-form or from a product) and the payments coming due. */
export function Expenses() {
  const [date, setDate] = useDateParam()
  const [y, m] = date.split('-').map(Number)
  const month = monthRange(y, m)
  const monthExpenses = useExpenses(month.from, month.to)
  const products = useExpenseProducts().data ?? []
  const categories = useExpenseCategories().data ?? []
  const del = useDeleteRow('expenses')
  const [target, setTarget] = useState<ExpenseTarget | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(null), 3000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  // The new day slides in from the side you swiped towards.
  const [dir, setDir] = useState<'next' | 'prev' | null>(null)
  const go = (days: number) => {
    setDir(days > 0 ? 'next' : 'prev')
    setDate(addDays(date, days))
  }
  const swipe = useSwipe(() => go(1), () => go(-1))
  const anim = dir === 'next' ? 'anim-from-right' : dir === 'prev' ? 'anim-from-left' : ''

  const rows = monthExpenses.data ?? []
  const dayRows = rows.filter((e) => e.date === date)
  const dayTotal = dayRows.reduce((a, e) => a + e.amount, 0)
  const monthTotal = rows.reduce((a, e) => a + e.amount, 0)

  return (
    <div className="da da-flat" {...swipe}>
      <header className="da-top">
        <div>
          <h2 className="da-title">{relativeDayLabel(date)}</h2>
          <div className="da-date">{fmtDay(date)}</div>
        </div>
        <div className="da-nav">
          <button
            type="button"
            className="da-today"
            disabled={date === today()}
            onClick={() => {
              setDir(date < today() ? 'next' : 'prev')
              setDate(today())
            }}
          >
            Σήμερα
          </button>
          <button type="button" aria-label="Προηγούμενη μέρα" onClick={() => go(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="Επόμενη μέρα" onClick={() => go(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </header>

      <ErrorNote error={monthExpenses.error ?? del.error} />

      <div key={date} className={anim}>
        <div className="da-grid">
          <section className="da-card da-dark da-full">
            <div className="da-row">
              <span>Έξοδα ημέρας</span>
            </div>
            <div className="da-num da-hero">
              {moneyNum(dayTotal)}
              <small>€</small>
            </div>
            <div className="da-caption">
              μήνας <b>{eur(monthTotal)}</b>
              {dayRows.length > 0 && ` · ${dayRows.length} ${dayRows.length === 1 ? 'καταχώρηση' : 'καταχωρήσεις'} σήμερα`}
            </div>
            <div className="da-qa">
              <button type="button" onClick={() => setTarget({ kind: 'product' })}>
                <span className="c">
                  <Package size={20} />
                </span>
                Προϊόν
              </button>
              <button type="button" onClick={() => setTarget({ kind: 'free' })}>
                <span className="c">
                  <Plus size={20} />
                </span>
                Ελεύθερο
              </button>
            </div>
          </section>

          <div className="da-due da-full">
            <DuePayments />
          </div>

          <section className="da-card da-full">
            <h3>{dayRows.length ? `Έξοδα (${dayRows.length})` : 'Έξοδα'}</h3>
            {dayRows.length === 0 ? (
              <p className="da-empty ca-empty">Κανένα έξοδο αυτή τη μέρα</p>
            ) : (
              <ul className="ma-entries">
                {dayRows.map((e) => {
                  const product = products.find((p) => p.id === e.product_id)
                  const cat = categories.find((c) => c.id === (product ? product.category_id : e.category_id))
                  const armed = confirmDelete === e.id
                  return (
                    <li key={e.id} className="ma-entry">
                      <button type="button" className="ma-entry-main" onClick={() => setTarget({ expense: e })}>
                        <span className="ma-dot ea-dot" style={{ background: cat?.color ?? '#8a8f98' }} />
                        <span className="ma-entry-text">
                          <span className="ma-entry-name">{expenseTitle(e, products)}</span>
                          <span className="ma-entry-sub">
                            {cat?.name ?? 'Άλλα έξοδα'}
                            {e.quantity != null && e.quantity !== 1 && ` · ×${e.quantity}`}
                          </span>
                        </span>
                        <span className="ma-entry-kcal">{eur(e.amount)}</span>
                        <Pencil size={13} className="ma-ico" />
                      </button>
                      <button
                        type="button"
                        aria-label={armed ? 'Επιβεβαίωση διαγραφής' : 'Διαγραφή'}
                        disabled={del.isPending}
                        className={clsx('ma-del', armed && 'armed')}
                        onClick={() => {
                          // Two taps: the first arms the button, the second deletes.
                          if (armed) del.mutate(e.id, { onSettled: () => setConfirmDelete(null) })
                          else setConfirmDelete(e.id)
                        }}
                      >
                        {armed ? 'Διαγραφή;' : <Trash2 size={14} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <ExpenseSheet target={target} date={date} onClose={() => setTarget(null)} />
    </div>
  )
}
