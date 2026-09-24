import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { num } from '../lib/format'

// Chart conventions: one y-axis, 2px lines, recessive grid, text in text tokens,
// hover tooltip on every chart, legend for ≥2 series.

export interface Series {
  key: string
  label: string
  color: string // a --series-N var
  digits?: number
  unit?: string
}

const axis = { fontSize: 11, fill: 'var(--muted)' }

function Tip(props: { active?: boolean; label?: string; payload?: { dataKey: string; value: number | null }[]; series: Series[] }) {
  if (!props.active || !props.payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold">{props.label}</div>
      {props.series.map((s) => {
        const p = props.payload!.find((x) => x.dataKey === s.key)
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            <span className="text-muted">{s.label}</span>
            <b className="ml-auto pl-3">
              {num(p?.value ?? null, s.digits ?? 0)}
              {s.unit ? ` ${s.unit}` : ''}
            </b>
          </div>
        )
      })}
    </div>
  )
}

export function Legend(props: { series: Series[] }) {
  if (props.series.length < 2) return null
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted">
      {props.series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

export function TrendChart(props: {
  data: Record<string, unknown>[]
  x: string
  series: Series[]
  kind?: 'line' | 'bar'
  height?: number
  reference?: { y: number; label: string }
  domain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax']
  footer?: ReactNode
}) {
  const h = props.height ?? 200
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--line)" />
      <XAxis dataKey={props.x} tick={axis} tickLine={false} axisLine={false} minTickGap={16} />
      <YAxis
        tick={axis}
        tickLine={false}
        axisLine={false}
        width={44}
        domain={props.domain ?? ['auto', 'auto']}
        tickFormatter={(v: number) => num(v, 1)}
      />
      <Tooltip
        cursor={props.kind === 'bar' ? { fill: 'var(--surface-2)' } : { stroke: 'var(--muted)', strokeDasharray: '3 3' }}
        content={<Tip series={props.series} />}
      />
      {props.reference && (
        <ReferenceLine
          y={props.reference.y}
          stroke="var(--muted)"
          strokeDasharray="4 4"
          label={{ value: props.reference.label, position: 'insideTopRight', fontSize: 10, fill: 'var(--muted)' }}
        />
      )}
    </>
  )
  return (
    <div>
      <Legend series={props.series} />
      <div style={{ height: h }}>
        <ResponsiveContainer width="100%" height="100%">
          {props.kind === 'bar' ? (
            <BarChart data={props.data} barGap={2} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              {common}
              {props.series.map((s) => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={props.data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
              {common}
              {props.series.map((s) => (
                <Line
                  key={s.key}
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      {props.footer}
    </div>
  )
}
