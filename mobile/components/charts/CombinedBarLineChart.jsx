import { Svg, Rect, Path, Defs, LinearGradient, Stop, G, Text as SvgText } from 'react-native-svg'
import { View } from 'react-native'

// A combined bar + smoothed line chart with optional area fill and axes/grid
export default function CombinedBarLineChart({
  width = 360,
  height = 220,
  barData = [],
  lineData = [],
  xLabels = [],
  barColor = '#8b5cf6', // violet
  lineColor = '#60a5fa', // sky
  area = true,
  padding = { top: 20, right: 16, bottom: 44, left: 36 },
  yTicks = 5,
  legend,
}) {
  const n = Math.max(barData.length, lineData.length)
  if (n === 0) return <View style={{ width, height }} />

  const vals = []
  for (let i = 0; i < n; i++) {
    const bv = typeof barData[i] === 'number' ? barData[i] : 0
    const lv = typeof lineData[i] === 'number' ? lineData[i] : 0
    vals.push(bv, lv)
  }
  const max = Math.max(1, ...vals)
  const min = 0

  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const stepX = n > 1 ? innerW / (n - 1) : innerW
  const barW = Math.max(4, Math.min(28, innerW / (n * 1.75)))

  const scaleY = (v) => padding.top + (1 - (v - min) / (max - min || 1)) * innerH
  const xAt = (i) => padding.left + i * stepX

  // Smoothed line path (Catmull-Rom to Bezier approximation)
  const points = lineData.map((v, i) => [xAt(i), scaleY(typeof v === 'number' ? v : 0)])
  const curve = (pts) => {
    if (pts.length <= 1) return ''
    let d = `M ${pts[0][0]},${pts[0][1]}`
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i === 0 ? pts[0] : pts[i - 1]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = i + 2 < pts.length ? pts[i + 2] : p2
      const cp1x = p1[0] + (p2[0] - p0[0]) / 6
      const cp1y = p1[1] + (p2[1] - p0[1]) / 6
      const cp2x = p2[0] - (p3[0] - p1[0]) / 6
      const cp2y = p2[1] - (p3[1] - p1[1]) / 6
      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
    }
    return d
  }
  const linePath = curve(points)

  const gradId = `g-${Math.random().toString(36).slice(2, 8)}`

  // y ticks
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i)

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {/* Grid and Y axis labels */}
      <G>
        {ticks.map((t, i) => {
          const y = scaleY(t)
          return (
            <G key={`gt-${i}`}>
              <Rect x={padding.left} y={y} width={innerW} height={1} fill="#e5e7eb" />
              <SvgText x={padding.left - 6} y={y + 4} fontSize={10} fill="#6b7280" textAnchor="end">{Math.round(t)}</SvgText>
            </G>
          )
        })}
      </G>

      {/* Bars */}
      <G>
        {barData.map((v, i) => {
          const x = xAt(i) - barW / 2
          const h = ((typeof v === 'number' ? v : 0) / (max || 1)) * innerH
          const y = padding.top + (innerH - h)
          return <Rect key={`b-${i}`} x={x} y={y} width={barW} height={h} rx={4} fill={barColor} opacity={0.8} />
        })}
      </G>

      {/* Area under line */}
      {area && points.length > 1 ? (
        <Path d={`${linePath} L ${xAt(n - 1)},${padding.top + innerH} L ${xAt(0)},${padding.top + innerH} Z`} fill={`url(#${gradId})`} />
      ) : null}

      {/* Smoothed line */}
      {points.length > 1 ? (
        <Path d={linePath} stroke={lineColor} strokeWidth={3} fill="none" />
      ) : null}

      {/* X axis labels */}
      <G>
        {xLabels.slice(0, n).map((label, i) => (
          <SvgText key={`x-${i}`} x={xAt(i)} y={height - padding.bottom + 16} fontSize={10} fill="#6b7280" textAnchor="middle" transform={`rotate(40 ${xAt(i)} ${height - padding.bottom + 16})`}>
            {label}
          </SvgText>
        ))}
      </G>

      {/* Legend (bottom center) */}
      {Array.isArray(legend) && legend.length === 2 ? (
        <G>
          <Rect x={width/2 - 70} y={height - 22} width={8} height={8} rx={4} fill={barColor} opacity={0.9} />
          <SvgText x={width/2 - 56} y={height - 15} fontSize={12} fill="#111827">{legend[0]}</SvgText>
          <Rect x={width/2 + 20} y={height - 22} width={8} height={8} rx={4} fill={lineColor} />
          <SvgText x={width/2 + 34} y={height - 15} fontSize={12} fill="#111827">{legend[1]}</SvgText>
        </G>
      ) : null}
    </Svg>
  )
}
