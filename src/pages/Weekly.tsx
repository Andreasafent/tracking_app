import { BarChart3, Brain, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, Salad } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { TrendChart } from '../components/Charts'
import { PageHeader } from '../components/PageHeader'
import { ErrorNote, Grid, Hero, Widget } from '../components/ui'
import { useSummaries } from '../lib/api'
import { addDays, fmtRange, fmtShort, statsWeek, statsWeeksOfYear, today } from '../lib/dates'
import { num, signed } from '../lib/format'
import { METRIC_GROUPS } from '../lib/metrics'
import { blockStats } from '../lib/stats'

const ICONS = [<Salad size={16} />, <HeartPulse size={16} />, <Dumbbell size={16} />, <Brain size={16} />]

export function Weekly() {
  const [params, setParams] = useSearchParams()
  const week = statsWeek(params.get('w') ?? today())
  const weeks = useMemo(() => statsWeeksOfYear(week.year), [week.year])
  const summaries = useSummaries(addDays(weeks[0].from, -7), weeks[weeks.length - 1].to)
  const rows = summaries.data ?? []

  const stats = useMemo(() => weeks.map((w) => ({ ...w, s: blockStats(rows, w) })), [rows, weeks])
  const idx = week.no - 1
  const cur = stats[idx]?.s ?? blockStats(rows, week)
  const prev = idx > 0 ? stats[idx - 1].s : blockStats(rows, { from: addDays(week.from, -7), to: addDays(week.to, -7) })
  const first = stats.find((x) => x.s.weight != null)?.s

  const go = (from: string) => setParams({ w: from }, { replace: true })
  const thisWeek = statsWeek(today()).from
  const upTo = stats.filter((x) => x.from <= today())
  const chartData = upTo.map((x) => ({
    label: fmtShort(x.from),
    weight: x.s.weight,
    kcal: x.s.kcal,
    burned: x.s.burned,
    run: x.s.runKm,
  }))

  return (
    <div className="space-y-3">
      <PageHeader
        title={`Εβδομάδα ${week.no}`}
        sub={fmtRange(week)}
        actions={
          <>
            <button type="button" className="da-today" disabled={week.from === thisWeek} onClick={() => go(thisWeek)}>
              Τώρα
            </button>
            <button type="button" aria-label="Προηγούμενη εβδομάδα" onClick={() => go(addDays(week.from, -7))}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Επόμενη εβδομάδα" onClick={() => go(addDays(week.from, 7))}>
              <ChevronRight size={18} />
            </button>
          </>
        }
      />
    
      <Hero
        label="ΜΕΣΟΣ ΟΡΟΣ ΒΑΡΟΥΣ"
        value={num(cur.weight, 2)}
        unit="kg"
        sub={
          <>
            <b className="text-text">{signed(cur.weight != null && prev.weight != null ? cur.weight - prev.weight : null, 2)} kg</b>{' '}
            από προηγ. εβδομάδα ·{' '}
            <b className="text-text">
              {signed(cur.weight != null && first?.weight != null ? cur.weight - first.weight : null, 2)} kg
            </b>{' '}
            από αρχή έτους
          </>
        }
      />

      <ErrorNote error={summaries.error} />

      <Grid>
        {METRIC_GROUPS.map((g, i) => (
          <Widget key={g.title} title={g.title} icon={ICONS[i]}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {g.metrics.map((m) => (
                <div key={m.label} className="ui-stat">
                  <dt className="ui-stat-label text-[11px] font-medium text-muted">{m.label}</dt>
                  <dd className="ui-stat-value text-base font-semibold">
                    {m.value(cur, prev)}
                    {m.unit && <span className="ml-0.5 text-xs font-medium text-muted">{m.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </Widget>
        ))}
      </Grid>

      <Widget title={`Βάρος ανά εβδομάδα · ${week.year}`} icon={<BarChart3 size={16} />}>
        <TrendChart
          data={chartData}
          x="label"
          series={[{ key: 'weight', label: 'Μ.Ο. βάρους', color: 'var(--series-1)', digits: 2, unit: 'kg' }]}
        />
      </Widget>
      <Grid>
        <Widget title="Θερμίδες vs καύση (Μ.Ο./μέρα)" icon={<Salad size={16} />}>
          <TrendChart
            data={chartData}
            x="label"
            series={[
              { key: 'kcal', label: 'Φαγητό', color: 'var(--series-1)', unit: 'kcal' },
              { key: 'burned', label: 'Καύση', color: 'var(--series-2)', unit: 'kcal' },
            ]}
          />
        </Widget>
        <Widget title="Τρέξιμο ανά εβδομάδα" icon={<Dumbbell size={16} />}>
          <TrendChart
            kind="bar"
            data={chartData}
            x="label"
            series={[{ key: 'run', label: 'Χιλιόμετρα', color: 'var(--series-1)', digits: 1, unit: 'km' }]}
          />
        </Widget>
      </Grid>
    </div>
  )
}
