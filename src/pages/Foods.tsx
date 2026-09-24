import { Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, ErrorNote, Field, Hero, NumberInput, QuickAction, QuickActions, Segmented, Sheet, TextInput, Widget } from '../components/ui'
import { useDeleteRow, useFoods, useSaveRow } from '../lib/api'
import type { Food } from '../lib/database.types'
import { num } from '../lib/format'

export function Foods() {
  const foods = useFoods()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Partial<Food> | null>(null)
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const list = (foods.data ?? []).filter((f) => norm(f.name).includes(norm(q)))

  return (
    <div className="space-y-3">
      <Hero label="ΤΡΟΦΙΜΑ" value={num(foods.data?.length ?? 0, 0)} sub="στη βάση του calculator">
        <QuickActions>
          <QuickAction icon={<Plus size={20} />} label="Νέο" onClick={() => setEditing({ unit: 'g', per_amount: 100 })} />
        </QuickActions>
      </Hero>
      <ErrorNote error={foods.error} />

      <div className="relative">
        <Search size={16} className="absolute top-3.5 left-3 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Αναζήτηση…"
          className="h-11 w-full rounded-2xl bg-surface pr-3 pl-9 text-base outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      <Widget title={`${list.length} τρόφιμα`}>
        <ul className="divide-y divide-line">
          {list.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => setEditing(f)} className="-mx-2 flex w-[calc(100%+1rem)] items-center rounded-xl px-2 py-3 text-left transition hover:bg-surface-2 gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{f.name}</div>
                  <div className="text-xs text-muted">
                    ανά {f.unit === 'piece' ? `${num(f.per_amount)} τεμ` : `${num(f.per_amount)}g`} · Π {num(f.protein)} · Υ{' '}
                    {num(f.carbs)} · Λ {num(f.fat)}
                  </div>
                </div>
                <div className="text-right text-sm font-bold">
                  {num(f.kcal, 0)} <span className="text-xs font-medium text-muted">kcal</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Widget>

      <FoodSheet food={editing} onClose={() => setEditing(null)} />
    </div>
  )
}

function FoodSheet(props: { food: Partial<Food> | null; onClose: () => void }) {
  const save = useSaveRow('foods')
  const del = useDeleteRow('foods')
  const [f, setF] = useState<Partial<Food>>({})
  useEffect(() => {
    if (props.food) setF(props.food)
  }, [props.food])
  const set = <K extends keyof Food>(k: K, v: Food[K] | null) => setF((x) => ({ ...x, [k]: v }))
  const valid = !!f.name && f.kcal != null && !!f.per_amount

  return (
    <Sheet
      open={!!props.food}
      onClose={props.onClose}
      title={f.id ? 'Επεξεργασία τροφίμου' : 'Νέο τρόφιμο'}
      footer={
        <div className="flex gap-2">
          {f.id && (
            <Button variant="danger" onClick={() => del.mutate(f.id!, { onSuccess: props.onClose })}>
              <Trash2 size={16} />
            </Button>
          )}
          <Button
            className="flex-1"
            disabled={!valid || save.isPending}
            onClick={() =>
              save.mutate(
                {
                  id: f.id,
                  name: f.name!,
                  kcal: f.kcal!,
                  protein: f.protein ?? 0,
                  carbs: f.carbs ?? 0,
                  fat: f.fat ?? 0,
                  iron: f.iron ?? null,
                  omega3: f.omega3 ?? null,
                  per_amount: f.per_amount!,
                  unit: f.unit ?? 'g',
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
      <TextInput value={f.name ?? ''} onChange={(v) => set('name', v)} placeholder="Όνομα" />
      <div className="mt-3">
        <Segmented
          value={(f.unit ?? 'g') as 'g' | 'piece'}
          onChange={(v) => setF((x) => ({ ...x, unit: v, per_amount: v === 'piece' ? 1 : 100 }))}
          options={[
            { value: 'g', label: 'Ανά γραμμάρια' },
            { value: 'piece', label: 'Ανά τεμάχιο' },
          ]}
        />
      </div>
      <Field label="Τιμές ανά">
        <NumberInput value={f.per_amount} onChange={(v) => set('per_amount', v)} unit={f.unit === 'piece' ? 'τεμ' : 'g'} />
      </Field>
      <Field label="Θερμίδες">
        <NumberInput value={f.kcal} onChange={(v) => set('kcal', v)} unit="kcal" />
      </Field>
      <Field label="Πρωτεΐνη">
        <NumberInput value={f.protein} onChange={(v) => set('protein', v)} unit="g" />
      </Field>
      <Field label="Υδατάνθρακες">
        <NumberInput value={f.carbs} onChange={(v) => set('carbs', v)} unit="g" />
      </Field>
      <Field label="Λιπαρά">
        <NumberInput value={f.fat} onChange={(v) => set('fat', v)} unit="g" />
      </Field>
      <Field label="Σίδηρος">
        <NumberInput value={f.iron} onChange={(v) => set('iron', v)} unit="mg" />
      </Field>
      <Field label="Ω3">
        <NumberInput value={f.omega3} onChange={(v) => set('omega3', v)} unit="g" />
      </Field>
    </Sheet>
  )
}
