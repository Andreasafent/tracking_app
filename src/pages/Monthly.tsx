import { CalendarDays, Salad } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { TrendChart } from '../components/Charts'
import { ErrorNote, Grid, Hero, Stepper, Widget } from '../components/ui'
import { useSummaries } from '../lib/api'
import { eachDay, fmtShort, MONTHS, monthBlocks, monthRange, parseISO, today } from '../lib/dates'
import { num, signed } from '../lib/format'
import { METRIC_GROUPS } from '../lib/metrics'
import { avg, blockStats, inRange } from '../lib/stats'

export function Monthly() {
  const [params, setParams] = useSearchParams()
  const m = params.get('m') ?? today().slice(0, 7)
  const [year, month] = m.split('-').map(Number)
  const prevM = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const range = monthRange(year, month)
  const prevRange = monthRange(prevM.y, prevM.m)
  const blocks = monthBlocks(year, month)

  const summaries = useSummaries(prevRange.from, range.to)
  const rows = summaries.data ?? []
  const total = blockStats(rows, range)
  const prevTotal = blockStats(rows, prevRange)
  const blockStatsList = blocks.map((b) => blockStats(rows, b))

  const go = (y: number, mo: number) => setParams({ m: `${y}-${String(mo).padStart(2, '0')}` }, { replace: true })
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  const days = eachDay(range.from, range.to).filter((d) => d <= today())
  const monthRows = inRange(rows, range)
  const daily = days.map((d) => {
    const r = monthRows.find((x) => x.date === d)
    return { label: String(parseISO(d).getDate()), weight: r?.weight ?? null, kcal: r?.kcal ?? null }
  })
  const avgTarget = avg(monthRows, 'target_intake')

  return (
    <div className="space-y-3">
      <Hero
        top={
          <Stepper
            label={`${MONTHS[month - 1]} ${year}`}
            onPrev={() => go(prevM.y, prevM.m)}
            onNext={() => go(next.y, next.m)}
          />
        }
        label="ΜΕΣΟΣ ΟΡΟΣ ΒΑΡΟΥΣ"
        value={num(total.weight, 2)}
        unit="kg"
        sub={
          <>
            <b className="text-text">
              {signed(total.weight != null && prevTotal.weight != null ? total.weight - prevTotal.weight : null, 2)} kg
            </b>{' '}
            από {MONTHS[prevM.m - 1]} · έλλειμμα/μέρα <b className="text-text">{signed(total.deficit, 0)}</b>
          </>
        }
      />

      <ErrorNote error={summaries.error} />

      <Grid>
        <Widget title="Βάρος ανά ημέρα" icon={<CalendarDays size={16} />}>
          <TrendChart
            data={daily}
            x="label"
            series={[{ key: 'weight', label: 'Βάρος', color: 'var(--series-1)', digits: 2, unit: 'kg' }]}
          />
        </Widget>
        <Widget title="Θερμίδες ανά ημέρα" icon={<Salad size={16} />}>
          <TrendChart
            kind="bar"
            data={daily}
            x="label"
            series={[{ key: 'kcal', label: 'Θερμίδες', color: 'var(--series-1)', unit: 'kcal' }]}
            reference={avgTarget != null ? { y: avgTarget, label: `στόχος ${num(avgTarget, 0)}` } : undefined}
          />
        </Widget>
      </Grid>

      {/* The sheet's table: monthly total + the 7-day blocks. Scrolls sideways on phones. */}
      <Widget title="Ανάλυση μήνα">
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-[11px] text-muted">
                <th className="sticky left-0 bg-surface py-2 pr-3 text-left font-medium" />
                <th className="px-2 py-2 text-right font-semibold text-accent">ΜΗΝΑΣ</th>
                {blocks.map((b) => (
                  <th key={b.from} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                    {fmtShort(b.from).split(' ')[0]}–{fmtShort(b.to)}
                  </th>
                ))}
              </tr>
            </thead>
            {METRIC_GROUPS.map((g) => (
              <tbody key={g.title}>
                <tr>
                  <td colSpan={blocks.length + 2} className="pt-4 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">
                    {g.title}
                  </td>
                </tr>
                {g.metrics.map((mt) => (
                  <tr key={mt.label} className="border-t border-line">
                    <td className="sticky left-0 bg-surface py-2 pr-3 whitespace-nowrap">{mt.label}</td>
                    <td className="px-2 py-2 text-right font-semibold">{mt.value(total, prevTotal)}</td>
                    {blockStatsList.map((s, i) => (
                      <td key={i} className="px-2 py-2 text-right text-muted">
                        {mt.value(s, i > 0 ? blockStatsList[i - 1] : undefined)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </Widget>
    </div>
  )
}
