import { Check, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Food } from '../lib/database.types'
import { num } from '../lib/format'
import { Button, Sheet } from './ui'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
// Phones: don't pop the keyboard when the picker opens. Mouse/trackpad: focus search right away.
const finePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

/** Stays open so several ingredients can be added in a row; ↑/↓ + Enter pick without the mouse. */
export function FoodPicker(props: {
  open: boolean
  foods: Food[]
  onClose: () => void
  onPick: (f: Food) => void
  onNewFood: (name: string) => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const [added, setAdded] = useState<string | null>(null)
  const list = props.foods.filter((f) => norm(f.name).includes(norm(q)))

  useEffect(() => {
    if (props.open) {
      setQ('')
      setAdded(null)
    }
  }, [props.open])
  useEffect(() => setActive(0), [q])

  function pick(f: Food) {
    props.onPick(f)
    setQ('')
    setAdded(f.name)
  }

  // Arrow keys work whether or not the search field has focus.
  useEffect(() => {
    if (!props.open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => {
          const n = list.length
          if (!n) return 0
          return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n
        })
      } else if (e.key === 'Enter' && list[active]) {
        e.preventDefault()
        pick(list[active])
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    document.getElementById(`food-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title="Επιλογή τροφίμου"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => props.onNewFood(q)}>
            <Plus size={16} /> Νέο τρόφιμο
          </Button>
          <Button className="flex-1" onClick={props.onClose}>
            Τέλος
          </Button>
        </div>
      }
    >
      <div className="relative mb-2">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          autoFocus={finePointer()}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      {added && (
        <div className="anim-fade mb-2 flex items-center gap-1.5 text-xs font-semibold text-good">
          <Check size={14} /> Προστέθηκε: {added}
        </div>
      )}
      <ul role="listbox" className="divide-y divide-line">
        {list.map((f, i) => (
          <li key={f.id} id={`food-opt-${i}`} role="option" aria-selected={i === active}>
            <button
              type="button"
              onClick={() => pick(f)}
              onMouseEnter={() => setActive(i)}
              className={`-mx-2 flex w-[calc(100%+1rem)] items-center justify-between rounded-xl px-2 py-3 text-left transition ${
                i === active ? 'bg-surface-2' : ''
              }`}
            >
              <span className="text-sm font-semibold">{f.name}</span>
              <span className="text-xs text-muted">
                {num(f.kcal, 0)} kcal / {f.unit === 'piece' ? `${num(f.per_amount)} τεμ` : `${num(f.per_amount)}g`}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="py-6 text-center text-sm text-muted">
            Δεν βρέθηκε.{' '}
            <button type="button" className="font-semibold text-accent hover:underline" onClick={() => props.onNewFood(q)}>
              Πρόσθεσε «{q}»
            </button>
          </li>
        )}
      </ul>
    </Sheet>
  )
}
