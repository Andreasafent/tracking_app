import { Check, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { useExpenseProducts, useSaveRow } from '../lib/api'
import { addDays, diffDays, fmtDMY, today } from '../lib/dates'
import { eur, nextDueAfter, recurrenceLabel } from '../lib/expenses'
import '../styles/due-payments.css'
import { ExpenseSheet, type ExpenseTarget } from './ExpenseSheet'
import { ErrorNote } from './ui'

/** Repeating products whose payment is overdue or due within a week. Renders nothing when none are. */
export function DuePayments() {
  const products = useExpenseProducts().data ?? []
  const save = useSaveRow('expense_products')
  const [target, setTarget] = useState<ExpenseTarget | null>(null)
  const [all, setAll] = useState(false)

  const horizon = addDays(today(), 7)
  const due = products
    .filter((p) => p.active && p.recurrence && p.next_due && p.next_due <= horizon)
    .sort((a, b) => a.next_due!.localeCompare(b.next_due!))
  if (!due.length) return null
  // Three at a time, so a long list doesn't push the day's numbers off the screen.
  const shown = all ? due : due.slice(0, 3)

  return (
    <section className="due">
      <header className="due-head">
        <h3>Πληρωμές που λήγουν</h3>
        <span className="due-count">{due.length}</span>
      </header>
      <ErrorNote error={save.error} />
      <ul>
        {shown.map((p) => {
          const days = diffDays(p.next_due!, today())
          return (
            <li key={p.id} className="due-tile">
              <div className="due-top">
                <span className="due-name">{p.name}</span>
                {p.unit_price != null && <span className="due-amount">{eur(p.unit_price)}</span>}
              </div>
              <div className="due-bottom">
                <span className="due-meta">
                  <b className={days < 0 ? 'late' : days === 0 ? 'now' : ''}>
                    {days < 0 ? `καθυστέρηση ${-days} ημ.` : days === 0 ? 'σήμερα' : `σε ${days} ημ.`}
                  </b>
                  {' · '}
                  {fmtDMY(p.next_due!)} · {recurrenceLabel(p.recurrence).toLowerCase()}
                </span>
                <span className="due-actions">
                  <button
                    type="button"
                    aria-label="Παράλειψη"
                    title="Παράλειψη (χωρίς καταχώρηση εξόδου)"
                    className="due-skip"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ id: p.id, name: p.name, next_due: nextDueAfter(p.next_due!, p.recurrence!) })}
                  >
                    <SkipForward size={16} />
                  </button>
                  <button type="button" className="due-pay" onClick={() => setTarget({ product: p, kind: 'product', due: true })}>
                    <Check size={16} /> Πληρώθηκε
                  </button>
                </span>
              </div>
            </li>
          )
        })}
      </ul>
      {due.length > 3 && (
        <button type="button" className="due-more" onClick={() => setAll((v) => !v)}>
          {all ? 'Λιγότερες' : `Εμφάνιση όλων (${due.length})`}
        </button>
      )}
      <ExpenseSheet target={target} date={today()} onClose={() => setTarget(null)} />
    </section>
  )
}
