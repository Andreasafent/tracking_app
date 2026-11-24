import clsx from 'clsx'
import { Apple, Check, Plus, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Button, ErrorNote, Sheet, Widget } from '../components/ui'
import { useClearChecked, useDeleteRow, useFoods, useSaveRow, useShoppingItems, useToggleShopping } from '../lib/api'
import type { Food } from '../lib/database.types'
import { num } from '../lib/format'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function Shopping() {
  const items = useShoppingItems()
  const add = useSaveRow('shopping_items')
  const toggle = useToggleShopping()
  const del = useDeleteRow('shopping_items')
  const clear = useClearChecked()
  const [text, setText] = useState('')
  const [picking, setPicking] = useState(false)

  const rows = items.data ?? []
  // Ticked items sink to the bottom, otherwise the order they were added in.
  const sorted = [...rows.filter((r) => !r.checked), ...rows.filter((r) => r.checked)]
  const done = rows.filter((r) => r.checked).length

  const submit = () => {
    const name = text.trim()
    if (!name) return
    add.mutate({ name }, { onSuccess: () => setText('') })
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title="Λίστα αγορών"
        sub={rows.length ? `${num(rows.length - done, 0)} απομένουν · ${done} από ${rows.length} αγορασμένα` : 'η λίστα είναι άδεια'}
      />
    

      <ErrorNote error={items.error ?? add.error ?? toggle.error ?? del.error ?? clear.error} />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Νέο είδος…"
          enterKeyHint="done"
          className="ui-search h-11 min-w-0 flex-1 rounded-2xl bg-surface px-4 text-base outline-none focus:ring-2 focus:ring-accent"
        />
        <Button type="submit" disabled={!text.trim() || add.isPending} className="ui-btn-sq shrink-0 px-4">
          <Plus size={18} />
        </Button>
        <Button variant="ghost" className="ui-btn-compact shrink-0 px-4" onClick={() => setPicking(true)}>
          <Apple size={18} /> Τρόφιμα
        </Button>
      </form>

      {rows.length > 0 && (
        <Widget title="Είδη">
          <ul className="divide-y divide-line">
            {sorted.map((r) => (
              <li key={r.id} className="anim-fade flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={r.checked}
                  onClick={() => toggle.mutate({ id: r.id, checked: !r.checked })}
                  className="ui-row -ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2"
                >
                  <span
                    className={clsx(
                      'grid size-6 shrink-0 place-items-center rounded-full border-2 transition',
                      r.checked ? 'border-accent bg-accent text-white' : 'border-line',
                    )}
                  >
                    {r.checked && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className={clsx('min-w-0 flex-1 truncate text-base transition', r.checked && 'text-muted line-through')}>
                    {r.name}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Διαγραφή"
                  onClick={() => del.mutate(r.id)}
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-bad/15 hover:text-bad active:scale-90"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          {done > 0 && (
            <Button variant="ghost" className="mt-3 w-full" disabled={clear.isPending} onClick={() => clear.mutate(undefined)}>
              <Trash2 size={16} /> Καθαρισμός αγορασμένων ({done})
            </Button>
          )}
        </Widget>
      )}

      <FoodPickerSheet
        open={picking}
        onClose={() => setPicking(false)}
        inList={new Set(rows.filter((r) => !r.checked && r.food_id).map((r) => r.food_id!))}
        onPick={(f) => add.mutate({ name: f.name, food_id: f.id })}
        busy={add.isPending}
      />
    </div>
  )
}

/** Foods to add to the list. Stays open for several picks; ↑/↓ and Enter work like in the expense picker. */
function FoodPickerSheet(props: { open: boolean; onClose: () => void; inList: Set<string>; onPick: (f: Food) => void; busy: boolean }) {
  const foods = useFoods().data ?? []
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const list = foods.filter((f) => norm(f.name).includes(norm(q)))

  const pick = (f: Food) => {
    if (props.inList.has(f.id) || props.busy) return
    props.onPick(f)
  }

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Από τα τρόφιμα">
      <div className="relative">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          autoFocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setHi(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault()
              if (list.length) setHi((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length)
            } else if (e.key === 'Enter' && list[hi]) {
              e.preventDefault()
              pick(list[hi])
            }
          }}
          placeholder="Αναζήτηση…"
          className="ui-search h-11 w-full rounded-2xl bg-surface-2 pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
      <ul className="ui-opts mt-2 divide-y divide-line">
        {list.map((f, i) => {
          const added = props.inList.has(f.id)
          return (
            <li key={f.id}>
              <button
                type="button"
                ref={i === hi ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                disabled={added}
                onClick={() => pick(f)}
                onMouseMove={() => hi !== i && setHi(i)}
                className={clsx(
                  'ui-opt -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2',
                  i === hi && 'on bg-surface-2',
                )}
              >
                <span className={clsx('min-w-0 flex-1 truncate text-sm font-semibold', added && 'text-muted')}>{f.name}</span>
                {added ? <Check size={16} className="text-good" /> : <Plus size={16} className="text-muted" />}
                {!added && <kbd className="ui-opt-hint">↵</kbd>}
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
