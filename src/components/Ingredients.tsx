import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { num } from '../lib/format'
import type { Line } from '../lib/meals'
import { NumberInput, Widget } from './ui'

/** The ingredient list shared by the calculator and the saved-meal editor. */
export function Ingredients(props: {
  lines: Line[]
  onAmount: (i: number, v: number | null) => void
  onRemove: (i: number) => void
  onAdd: () => void
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <Widget
      title="Υλικά"
      action={
        <div className="flex gap-1">
          {props.actions}
          <button
            type="button"
            className="grid size-8 place-items-center rounded-full bg-accent text-white transition hover:brightness-110 active:scale-90"
            aria-label="Προσθήκη τροφίμου"
            onClick={props.onAdd}
          >
            <Plus size={16} />
          </button>
        </div>
      }
    >
      {props.lines.length === 0 ? (
        <div className="py-4 text-center text-sm text-muted">Πρόσθεσε τρόφιμα με το +</div>
      ) : (
        <ul className="divide-y divide-line">
          {props.lines.map((l, i) => (
            <li key={i} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{l.name}</div>
                <div className="text-xs text-muted">
                  {num(l.n.kcal, 0)} kcal · Π {num(l.n.protein, 1)} · Υ {num(l.n.carbs, 1)} · Λ {num(l.n.fat, 1)}
                </div>
              </div>
              <NumberInput
                value={l.amount}
                step={l.unit === 'piece' ? 1 : 10}
                unit={l.unit === 'piece' ? 'τεμ' : 'g'}
                onChange={(v) => props.onAmount(i, v)}
              />
              <button
                type="button"
                aria-label="Αφαίρεση"
                className="text-muted transition hover:text-bad active:scale-90"
                onClick={() => props.onRemove(i)}
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {props.children}
    </Widget>
  )
}
