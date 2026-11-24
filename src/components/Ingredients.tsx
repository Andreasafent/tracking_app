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
            className="ui-plus grid size-8 place-items-center rounded-full bg-accent text-white transition hover:brightness-110 active:scale-90"
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
        // Each ingredient is a compact tile (the same as in the calculator).
        <ul className="ca-lines">
          {props.lines.map((l, i) => (
            <li key={i} className="ca-line">
              <span className="ca-line-text">
                <span className="ca-line-name">{l.name}</span>
                <span className="ca-line-sub">
                  {num(l.n.kcal, 0)} kcal · Π {num(l.n.protein, 1)} · Υ {num(l.n.carbs, 1)} · Λ {num(l.n.fat, 1)}
                </span>
              </span>
              <span className="ca-line-amt">
                <NumberInput
                  value={l.amount}
                  step={l.unit === 'piece' ? 1 : 10}
                  unit={l.unit === 'piece' ? 'τεμ' : 'g'}
                  onChange={(v) => props.onAmount(i, v)}
                />
              </span>
              <button type="button" aria-label="Αφαίρεση" className="ma-del" onClick={() => props.onRemove(i)}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      
      )}
      {props.children}
    </Widget>
  )
}
