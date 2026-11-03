import { Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDeleteRow, useExpenseCategories, useExpenseProducts, useSaveRow } from '../lib/api'
import type { Expense, ExpenseProduct } from '../lib/database.types'
import { type ISODate } from '../lib/dates'
import { eur, nextDueAfter } from '../lib/expenses'
import { num } from '../lib/format'
import { Button, DateInput, ErrorNote, Field, NumberInput, Segmented, Sheet, TextInput } from './ui'

/** What the sheet opens for: a new/edited expense, optionally of a product; `due` also moves the product's next payment date. */
export type ExpenseTarget = { expense?: Expense; product?: ExpenseProduct; kind?: 'product' | 'free'; due?: boolean }

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function ExpenseSheet(props: { target: ExpenseTarget | null; date: ISODate; onClose: () => void }) {
  const products = useExpenseProducts().data ?? []
  const categories = useExpenseCategories().data ?? []
  const save = useSaveRow('expenses')
  const saveProduct = useSaveRow('expense_products')
  const del = useDeleteRow('expenses')
  const navigate = useNavigate()

  const [kind, setKind] = useState<'product' | 'free'>('product')
  const [date, setDate] = useState<ISODate>(props.date)
  const [product, setProduct] = useState<ExpenseProduct | null>(null)
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState<number | null>(null)
  const [amount, setAmount] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0) // highlighted row in the product picker (Enter picks it)

  const t =props.target
  useEffect(() => {
    if (!t) return
    setQ('')
    setHi(0)
    const e = t.expense
    if (e) {
      const p = products.find((x) => x.id === e.product_id) ?? null
      setKind(p ? 'product' : 'free')
      setDate(e.date)
      setProduct(p)
      setTitle(p ? '' : (e.name ?? ''))
      setQty(e.quantity)
      setAmount(e.amount)
    } else {
      const p = t.product ?? null
      setKind(t.kind ?? 'product')
      setDate(props.date)
      setProduct(p)
      setTitle('')
      setQty(p?.unit_price != null ? 1 : null)
      setAmount(p?.unit_price ?? null)
    }
    // Re-init only when the sheet opens for a new target.
  }, [t])

  const pick = (p: ExpenseProduct) => {
    setProduct(p)
    setQty(p.unit_price != null ? 1 : null)
    setAmount(p.unit_price ?? null)
  }
  const changeQty = (v: number | null) => {
    setQty(v)
    if (product?.unit_price != null && v != null) setAmount(+(v * product.unit_price).toFixed(2))
  }

  const picking = kind === 'product' && !product
  const valid = amount != null && !picking
  const list = products.filter((p) => norm(p.name).includes(norm(q)))

  const onSave = () => {
    const isProduct = kind === 'product' && product
    save.mutate(
      {
        id: t?.expense?.id,
        date,
        product_id: isProduct ? product.id : null,
        name: isProduct ? product.name : title.trim() || null,
        amount: amount!,
        quantity: isProduct && product.unit_price != null ? qty : null,
      },
      {
        onSuccess: () => {
          if (t?.due && product?.recurrence && product.next_due) {
            saveProduct.mutate(
              { id: product.id, name: product.name, next_due: nextDueAfter(product.next_due, product.recurrence) },
              { onSuccess: props.onClose },
            )
          } else props.onClose()
        },
      },
    )
  }

  const editing = t?.expense
  return (
    <Sheet
      open={!!t}
      onClose={props.onClose}
      title={editing ? 'Επεξεργασία εξόδου' : t?.due ? `Πληρωμή · ${product?.name ?? ''}` : 'Νέο έξοδο'}
      footer={
        picking ? undefined : (
          <div className="flex gap-2">
            {editing && (
              <Button variant="danger" onClick={() => del.mutate(editing.id, { onSuccess: props.onClose })}>
                <Trash2 size={16} />
              </Button>
            )}
            <Button className="flex-1" disabled={!valid || save.isPending || saveProduct.isPending} onClick={onSave}>
              Αποθήκευση
            </Button>
          </div>
        )
      }
    >
      <ErrorNote error={save.error ?? saveProduct.error ?? del.error} />
      {!t?.due && (
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'product', label: 'Από προϊόν' },
            { value: 'free', label: 'Ελεύθερο' },
          ]}
        />
      )}

      {picking ? (
        <div className="mt-3">
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
              placeholder="Αναζήτηση προϊόντος…"
              className="h-11 w-full rounded-2xl bg-surface-2 pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <ul className="mt-2 divide-y divide-line">
            {list.map((p, i) => {
              const cat = categories.find((c) => c.id === p.category_id)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    ref={i === hi ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                    onClick={() => pick(p)}
                    className={`-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2 ${i === hi ? 'bg-surface-2' : ''}`}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color ?? 'var(--muted)' }} />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                    {p.unit_price != null && <span className="text-xs text-muted">{eur(p.unit_price)}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => navigate(`/products?new=${encodeURIComponent(q)}`)}
          >
            <Plus size={16} /> Νέο προϊόν{q ? `: ${q}` : ''}
          </Button>
        </div>
      ) : (
        <>
          {kind === 'product' && product ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{product.name}</span>
              {!t?.due && !editing && (
                <button type="button" onClick={() => setProduct(null)} className="text-xs font-semibold text-accent">
                  Αλλαγή
                </button>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <TextInput value={title} onChange={setTitle} placeholder="Τίτλος (προαιρετικό)" />
            </div>
          )}
          <Field label="Ημερομηνία">
            <DateInput value={date} onChange={setDate} />
          </Field>
          {kind === 'product' && product?.unit_price != null && (
            <Field label="Ποσότητα" hint={`${eur(product.unit_price)} η μονάδα`}>
              <NumberInput value={qty} onChange={changeQty} step={1} min={0} />
            </Field>
          )}
          <Field label="Ποσό" hint={product?.unit_price != null && qty != null ? `${num(qty)} × ${eur(product.unit_price)}` : undefined}>
            <NumberInput value={amount} onChange={setAmount} unit="€" />
          </Field>
        </>
      )}
    </Sheet>
  )
}
