/** Small SVG pieces shared by the design variants. Colours come from currentColor / CSS. */

/** A line through the values, scaled to its own min/max, with a dot on the last one. */
export function Spark(props: { values: number[]; className?: string }) {
  const v = props.values
  if (v.length < 2) return <div className={props.className} />
  const w = 200
  const h = 56
  const lo = Math.min(...v)
  const hi = Math.max(...v)
  const span = hi - lo || 1
  const pts = v.map((x, i) => [(i / (v.length - 1)) * (w - 8) + 4, h - 6 - ((x - lo) / span) * (h - 12)] as const)
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={props.className} preserveAspectRatio="none" aria-hidden>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <line x1={last[0]} y1={last[1]} x2={last[0]} y2={last[1]} stroke="currentColor" strokeWidth="8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** Share of the target reached, 0..1+ (0 without a target). */
export const ratio = (v: number, target: number | null) => (target ? v / target : 0)

/** The Θρεπτικά component from direction B: one concentric arc per macro, outermost first. */
export function NutRings(props: { macros: { key: string; value: number; target: number | null }[]; colors: string[]; track: string; className?: string }) {
  const radii = [62, 46, 30]
  return (
    <svg viewBox="0 0 140 140" className={props.className} aria-hidden>
      {props.macros.slice(0, 3).map((m, i) => {
        const r = radii[i]
        const c = 2 * Math.PI * r
        const p = Math.min(1, ratio(m.value, m.target))
        return (
          <g key={m.key} transform="rotate(-90 70 70)">
            <circle cx="70" cy="70" r={r} fill="none" stroke={props.track} strokeWidth="10" />
            <circle cx="70" cy="70" r={r} fill="none" stroke={props.colors[i]} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)} style={{ transition: 'stroke-dashoffset .5s ease' }} />
          </g>
        )
      })}
    </svg>
  )
}
