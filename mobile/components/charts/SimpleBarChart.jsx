import { Svg, Rect, Line, G, Text as SvgText } from 'react-native-svg'
import { View } from 'react-native'

// Enhanced SimpleBarChart: draws axes, grid, labels and emits onBarPress
export default function SimpleBarChart({
  data = [],
  width = 300,
  height = 200,
  color = '#0ea5e9',
  gap = 6,
  padding = { top: 12, right: 12, bottom: 36, left: 60 },
  ticks = 5,
  maxY = undefined,
  yFormatter = undefined,
  xFormatter = undefined,
  xLabels = [],
  onBarPress = undefined,
}) {
  if (!Array.isArray(data) || data.length === 0) return <View style={{ width, height }} />

  const vals = data.map(v => (typeof v === 'number' ? v : v?.y ?? 0))
  const n = vals.length

  // nice max if not provided
  const rawMax = maxY ?? Math.max(1, ...vals)
  const niceMax = (() => {
    const base = Math.max(1, rawMax * 1.1)
    const pow10 = Math.pow(10, Math.floor(Math.log10(base)))
    const norm = base / pow10
    const niceNorm = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
    return niceNorm * pow10
  })()

  const innerW = Math.max(16, width - padding.left - padding.right)
  const innerH = Math.max(16, height - padding.top - padding.bottom)
  const barW = Math.max(4, Math.min(40, (innerW - gap * (n - 1)) / n))

  const yAt = (v) => padding.top + (1 - (v / (niceMax || 1))) * innerH
  const xAt = (i) => padding.left + i * (barW + gap)

  const fmtY = (v) => (typeof yFormatter === 'function' ? yFormatter(v) : String(v))
  const fmtX = (i) => {
    const label = xLabels && xLabels[i] != null ? xLabels[i] : (data[i]?.x ?? '')
    return typeof xFormatter === 'function' ? xFormatter(label) : String(label)
  }

  // prepare ticks
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => Math.round((niceMax * (i / ticks)) * 100) / 100)

  return (
    <Svg width={width} height={height}>
      {/* grid lines and y labels */}
      <G>
        {yTicks.map((t, i) => {
          const y = yAt(t)
          const yy = Math.round(y) + 0.5
          return (
            <G key={`g-${i}`}>
              <Line x1={padding.left} y1={yy} x2={width - padding.right} y2={yy} stroke="#e5e7eb" strokeWidth={1} />
              <SvgText x={padding.left - 12} y={yy} fontSize={12} fill="#111827" textAnchor="end" alignmentBaseline="middle">{fmtY(t)}</SvgText>
            </G>
          )
        })}
      </G>

      {/* axes */}
      <Line x1={padding.left} y1={Math.round(padding.top + innerH) + 0.5} x2={width - padding.right} y2={Math.round(padding.top + innerH) + 0.5} stroke="#111827" strokeWidth={1.2} />
      <Line x1={Math.round(padding.left) + 0.5} y1={padding.top} x2={Math.round(padding.left) + 0.5} y2={padding.top + innerH} stroke="#111827" strokeWidth={1.2} />

      {/* bars */}
      <G>
        {vals.map((v, i) => {
          const x = xAt(i)
          const h = ((v) / (niceMax || 1)) * innerH
          const y = padding.top + (innerH - h)
          return (
            <Rect
              key={`b-${i}`}
              x={x}
              y={Math.round(y)}
              width={barW}
              height={Math.max(0, Math.round(h))}
              rx={4}
              fill={color}
              opacity={0.95}
              onPress={() => {
                if (typeof onBarPress === 'function') {
                  // approximate center of bar for tooltip positioning
                  const cx = x + barW / 2
                  const cy = y + (h / 2)
                  onBarPress({ index: i, value: v, datum: data[i], x: cx, y: cy })
                }
              }}
            />
          )
        })}
      </G>

      {/* x labels */}
      <G>
        {Array.from({ length: n }).map((_, i) => {
          const lx = padding.left + i * (barW + gap) + barW / 2
          return (
            <SvgText key={`x-${i}`} x={Math.round(lx)} y={height - padding.bottom + 18} fontSize={11} fill="#6b7280" textAnchor="middle">{fmtX(i)}</SvgText>
          )
        })}
      </G>
    </Svg>
  )
}
