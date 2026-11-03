import clsx from 'clsx'
import { ChevronRight, Plus, Repeat, Search, Tags, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, DateInput, ErrorNote, Field, Hero, NumberInput, QuickAction, QuickActions, Segmented, Select, Sheet, TextInput, Widget } from '../components/ui'
import { useDeleteRow, useExpenseCategories, useExpenseProducts, useSaveRow } from '../lib/api'
import type { ExpenseCategory, ExpenseProduct, Recurrence } from '../lib/database.types'
import { fmtDMY, today } from '../lib/dates'
import { eur, RECURRENCES, recurrenceLabel } from '../lib/expenses'
import { num } from '../lib/format'

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const PALETTE = ['#1baf7a', '#eb6834', '#8b5cf6', '#eda100', '#2a78d6', '#e5484d', '#14b8c4', '#d6409f', '#6b7bff', '#8a8f98']

export function Products() {
  const products = useExpenseProducts()
  const categories = useExpenseCategories().data ?? []
  const [q, setQ] = useState('')
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Partial<ExpenseProduct> | null>(() =>
    params.has('new') ? { name: params.get('new') ?? '' } : null,
  )
  const [catsOpen, setCatsOpen] = useState(false)
  // '' = all, 'none' = uncategorised, otherwise a category id.
  const [cat, setCat] = useState('')
  const list = (products.data ?? []).filter(
    (p) =>
      norm(p.name).includes(norm(q)) && (cat === '' || (cat === 'none' ? p.category_id == null : p.category_id === cat)),
  )
  const chips = [{ id: '', name: 'Όλα', color: '' }, ...categories, { id: 'none', name: 'Χωρίς κατηγορία', color: '' }]

  return (
    <div className="space-y-3">
      <Hero label="ΠΡΟΪΟΝΤΑ" value={num(products.data?.length ?? 0, 0)} sub="για καταχώρηση εξόδων">
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Νέο" onClick={() => setEditing({})} />
          <QuickAction icon={<Tags size={20} />} label="Κατηγορίες" onClick={() => setCatsOpen(true)} />
        </QuickActions>
      </Hero>
      <ErrorNote error={products.error} />

      <div className="relative">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-2xl bg-surface pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={clsx(
              'flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition active:scale-95',
              cat === c.id ? 'bg-accent text-white' : 'bg-surface text-muted hover:text-text',
            )}
          >
            {c.color && <span className="size-2 rounded-full" style={{ background: c.color }} />}
            {c.name}
          </button>
        ))}
      </div>

      <Widget title={`${list.length} προϊόντα`}>
        <ul className="divide-y divide-line">
          {list.map((p) => {
            const cat = categories.find((c) => c.id === p.category_id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setEditing(p)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat?.color ?? 'var(--muted)' }} />
                  <div className="min-w-0 flex-1">
                    <div className={clsx('truncate text-sm font-semibold', p.recurrence && !p.active && 'text-muted line-through')}>
                      {p.name}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {cat?.name ?? 'Χωρίς κατηγορία'}
                      {p.recurrence && (
                        <>
                          {' · '}
                          <Repeat size={11} className="inline -translate-y-px" /> {recurrenceLabel(p.recurrence).toLowerCase()}
                          {p.next_due && ` · επόμενη ${fmtDMY(p.next_due)}`}
                        </>
                      )}
                    </div>
                  </div>
                  {p.unit_price != null && <div className="text-sm font-bold">{eur(p.unit_price)}</div>}
                </button>
              </li>
            )
          })}
        </ul>
      </Widget>

      <ProductSheet product={editing} categories={categories} onClose={() => setEditing(null)} />
      <CategoriesSheet open={catsOpen} categories={categories} onClose={() => setCatsOpen(false)} />
    </div>
  )
}

function ProductSheet(props: { product: Partial<ExpenseProduct> | null; categories: ExpenseCategory[]; onClose: () => void }) {
  const save = useSaveRow('expense_products')
  const del = useDeleteRow('expense_products')
  const [p, setP] = useState<Partial<ExpenseProduct>>({})
  const [fixed, setFixed] = useState(false)
  useEffect(() => {
    if (!props.product) return
    setP(props.product)
    setFixed(props.product.unit_price != null)
    save.reset()
    del.reset()
  }, [props.product])
  const set = <K extends keyof ExpenseProduct>(k: K, v: ExpenseProduct[K] | null) => setP((x) => ({ ...x, [k]: v }))

  const repeating = !!p.recurrence
  const valid = !!p.name?.trim() && (!fixed || p.unit_price != null) && (!repeating || !!p.next_due)

  return (
    <Sheet
      open={!!props.product}
      onClose={props.onClose}
      title={p.id ? 'Επεξεργασία προϊόντος' : 'Νέο προϊόν'}
      footer={
        <div className="flex gap-2">
          {p.id && (
            <Button variant="danger" onClick={() => del.mutate(p.id!, { onSuccess: props.onClose })}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: p.id,
                  name: p.name!.trim(),
                  category_id: p.category_id ?? null,
                  unit_price: fixed ? p.unit_price! : null,
                  recurrence: p.recurrence ?? null,
                  next_due: repeating ? p.next_due! : null,
                  active: p.active ?? true,
                },
                { onSuccess: props.onClose },
              )
            }
          >
            Αποθήκευση
          </Button>
        </div>
      }
    >
      <ErrorNote error={save.error ?? del.error} />
      <TextInput value={p.name ?? ''} onChange={(v) => set('name', v)} placeholder="Όνομα" />
      <Field label="Κατηγορία">
        <Select
          value={p.category_id ?? ''}
          onChange={(v) => set('category_id', v || null)}
          options={[{ value: '', label: 'Χωρίς κατηγορία' }, ...props.categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </Field>

      <div className="mt-3">
        <Segmented
          value={fixed ? 'fixed' : 'free'}
          onChange={(v) => {
            setFixed(v === 'fixed')
            if (v === 'free') set('unit_price', null)
          }}
          options={[
            { value: 'free', label: 'Ελεύθερη τιμή' },
            { value: 'fixed', label: 'Σταθερή τιμή' },
          ]}
        />
      </div>
      {fixed && (
        <Field label="Τιμή μονάδας" hint="Στην καταχώρηση βάζεις μόνο ποσότητα">
          <NumberInput value={p.unit_price} onChange={(v) => set('unit_price', v)} unit="€" />
        </Field>
      )}

      <div className="mt-4">
        <div className="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Επανάληψη πληρωμής</div>
        <Field label="Συχνότητα">
          <Select
            value={(p.recurrence ?? '') as Recurrence | ''}
            onChange={(v) =>
              setP((x) => ({ ...x, recurrence: v || null, next_due: v ? (x.next_due ?? today()) : null }))
            }
            options={[{ value: '', label: 'Καμία' }, ...RECURRENCES]}
          />
        </Field>
        {repeating && (
          <>
            <Field label="Επόμενη πληρωμή">
              <DateInput value={p.next_due} onChange={(v) => set('next_due', v)} />
            </Field>
            <div className="mt-3">
              <Segmented
                value={p.active === false ? 'off' : 'on'}
                onChange={(v) => set('active', v === 'on')}
                options={[
                  { value: 'on', label: 'Ενεργό' },
                  { value: 'off', label: 'Σε παύση' },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

function CategoriesSheet(props: { open: boolean; categories: ExpenseCategory[]; onClose: () => void }) {
  const save = useSaveRow('expense_categories')
  const del = useDeleteRow('expense_categories')
  const [edit, setEdit] = useState<Partial<ExpenseCategory> | null>(null)
  useEffect(() => {
    if (!props.open) setEdit(null)
  }, [props.open])
  const done = () => setEdit(null)

  return (
    <Sheet
      open={props.open}
      onClose={props.onClose}
      title={edit ? (edit.id ? 'Επεξεργασία κατηγορίας' : 'Νέα κατηγορία') : 'Κατηγορίες'}
      footer={
        edit ? (
          <div className="flex gap-2">
            {edit.id && (
              <Button variant="danger" onClick={() => del.mutate(edit.id!, { onSuccess: done })}>
                <Trash2 size={16} />
              </Button>
            )}
            <Button variant="ghost" onClick={done}>
              Πίσω
            </Button>
            <Button
              className="flex-1"
              disabled={!edit.name?.trim() || save.isPending}
              onClick={() =>
                save.mutate(
                  {
                    id: edit.id,
                    name: edit.name!.trim(),
                    color: edit.color ?? PALETTE[0],
                    sort: edit.sort ?? props.categories.length + 1,
                  },
                  { onSuccess: done },
                )
              }
            >
              Αποθήκευση
            </Button>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setEdit({ color: PALETTE[props.categories.length % PALETTE.length] })}>
            <Plus size={16} /> Νέα κατηγορία
          </Button>
        )
      }
    >
      <ErrorNote error={save.error ?? del.error} />
      {edit ? (
        <>
          <TextInput value={edit.name ?? ''} onChange={(v) => setEdit((x) => ({ ...x, name: v }))} placeholder="Όνομα" />
          <div className="mt-4 flex flex-wrap gap-3">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => setEdit((x) => ({ ...x, color: c }))}
                className={clsx('size-9 rounded-full transition active:scale-90', edit.color === c && 'ring-2 ring-text ring-offset-2 ring-offset-surface')}
                style={{ background: c }}
              />
            ))}
          </div>
          {edit.id && <p className="mt-4 text-xs text-muted">Αν διαγράψεις την κατηγορία, τα προϊόντα της μένουν χωρίς κατηγορία και μετράνε στα «Άλλα έξοδα».</p>}
        </>
      ) : (
        <ul className="divide-y divide-line">
          {props.categories.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setEdit(c)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface-2"
              >
                <span className="size-3 rounded-full" style={{ background: c.color }} />
                <span className="flex-1 text-sm font-semibold">{c.name}</span>
                <ChevronRight size={16} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
