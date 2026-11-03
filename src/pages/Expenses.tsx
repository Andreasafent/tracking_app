import { Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DuePayments } from '../components/DuePayments'
import { ExpenseSheet, type ExpenseTarget } from '../components/ExpenseSheet'
import { ErrorNote, Hero, QuickAction, QuickActions, Stepper, Widget } from '../components/ui'
import { useDeleteRow, useExpenseCategories, useExpenseProducts, useExpenses } from '../lib/api'
import { addDays, monthRange, relativeDayLabel } from '../lib/dates'
import { eur, expenseTitle } from '../lib/expenses'
import { useDateParam } from '../lib/useDateParam'
import { useSwipe } from '../lib/useSwipe'

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
    <div className="min-h-[calc(100dvh-4rem)] space-y-3" {...swipe}>
      <Hero
        top={<Stepper label={relativeDayLabel(date)} onPrev={() => go(-1)} onNext={() => go(1)} />}
        label="ΕΞΟΔΑ ΗΜΕΡΑΣ"
        value={
          <span key={date} className={`inline-block ${anim}`}>
            {eur(dayTotal)}
          </span>
        }
        sub={
          <>
            μήνας: <b className="text-text">{eur(monthTotal)}</b>
          </>
        }
      >
        <QuickActions>
          <QuickAction icon={<Package size={20} />} label="Προϊόν" onClick={() => setTarget({ kind: 'product' })} />
          <QuickAction icon={<Plus size={20} />} label="Ελεύθερο" onClick={() => setTarget({ kind: 'free' })} />
        </QuickActions>
      </Hero>

      <ErrorNote error={monthExpenses.error ?? del.error} />

      <DuePayments />

      <div key={date} className={`space-y-3 ${anim}`}>
        <Widget title={dayRows.length ? `Έξοδα (${dayRows.length})` : 'Έξοδα'}>
          {dayRows.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted">Κανένα έξοδο αυτή τη μέρα</div>
          ) : (
            <ul className="divide-y divide-line">
              {dayRows.map((e) => {
                const product = products.find((p) => p.id === e.product_id)
                const cat = categories.find((c) => c.id === product?.category_id)
                const armed = confirmDelete === e.id
                return (
                  <li key={e.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setTarget({ expense: e })}
                      className="-ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2"
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color ?? 'var(--muted)' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{expenseTitle(e, products)}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {cat?.name ?? 'Άλλα έξοδα'}
                          {e.quantity != null && e.quantity !== 1 && ` · ×${e.quantity}`}
                        </span>
                      </span>
                      <span className="text-sm font-bold">{eur(e.amount)}</span>
                      <Pencil size={13} className="shrink-0 text-muted" />
                    </button>
                    <button
                      type="button"
                      aria-label={armed ? 'Επιβεβαίωση διαγραφής' : 'Διαγραφή'}
                      disabled={del.isPending}
                      onClick={() => {
                        // Two taps: the first arms the button, the second deletes.
                        if (armed) del.mutate(e.id, { onSettled: () => setConfirmDelete(null) })
                        else setConfirmDelete(e.id)
                      }}
                      className={
                        armed
                          ? 'anim-fade h-8 shrink-0 rounded-full bg-bad px-3 text-xs font-semibold text-white transition active:scale-95'
                          : 'grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-bad/15 hover:text-bad active:scale-90'
                      }
                    >
                      {armed ? 'Διαγραφή;' : <Trash2 size={14} />}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Widget>
      </div>

      <ExpenseSheet target={target} date={date} onClose={() => setTarget(null)} />
    </div>
  )
}
