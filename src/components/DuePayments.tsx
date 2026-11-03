import { CalendarClock, Check, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { useExpenseProducts, useSaveRow } from '../lib/api'
import { addDays, diffDays, fmtDMY, today } from '../lib/dates'
import { eur, nextDueAfter, recurrenceLabel } from '../lib/expenses'
import { ExpenseSheet, type ExpenseTarget } from './ExpenseSheet'
import { ErrorNote, Widget } from './ui'

/** Repeating products whose payment is overdue or due within a week. Renders nothing when none are. */
export function DuePayments() {
  const products = useExpenseProducts().data ?? []
  const save = useSaveRow('expense_products')
  const [target, setTarget] = useState<ExpenseTarget | null>(null)

  const horizon = addDays(today(), 7)
  const due = products
    .filter((p) => p.active && p.recurrence && p.next_due && p.next_due <= horizon)
    .sort((a, b) => a.next_due!.localeCompare(b.next_due!))
  if (!due.length) return null

  return (
    <Widget title="Πληρωμές που λήγουν" icon={<CalendarClock size={16} />}>
      <ErrorNote error={save.error} />
      <ul className="divide-y divide-line">
        {due.map((p) => {
          const days = diffDays(p.next_due!, today())
          return (
            <li key={p.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                <div className="text-xs text-muted">
                  <span className={days < 0 ? 'font-semibold text-bad' : days === 0 ? 'font-semibold text-warn' : ''}>
                    {days < 0 ? `καθυστέρηση ${-days} ημ.` : days === 0 ? 'σήμερα' : `σε ${days} ημ.`}
                  </span>{' '}
                  · {fmtDMY(p.next_due!)} · {recurrenceLabel(p.recurrence).toLowerCase()}
                  {p.unit_price != null && ` · ${eur(p.unit_price)}`}
                </div>
              </div>
              <button
                type="button"
                aria-label="Παράλειψη"
                title="Παράλειψη (χωρίς καταχώρηση εξόδου)"
                disabled={save.isPending}
                onClick={() => save.mutate({ id: p.id, name: p.name, next_due: nextDueAfter(p.next_due!, p.recurrence!) })}
                className="grid size-9 place-items-center rounded-full bg-surface-2 text-muted transition hover:bg-line hover:text-text active:scale-90"
              >
                <SkipForward size={15} />
              </button>
              <button
                type="button"
                aria-label="Πληρώθηκε"
                title="Καταχώρηση πληρωμής"
                onClick={() => setTarget({ product: p, kind: 'product', due: true })}
                className="grid size-9 place-items-center rounded-full bg-accent text-white transition hover:brightness-110 active:scale-90"
              >
                <Check size={16} />
              </button>
            </li>
          )
        })}
      </ul>
      <ExpenseSheet target={target} date={today()} onClose={() => setTarget(null)} />
    </Widget>
  )
}
