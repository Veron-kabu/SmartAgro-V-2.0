import { Svg, Path, Defs, LinearGradient, Stop, Line, G, Text as SvgText, Circle } from 'react-native-svg'
import { View } from 'react-native'

export default function SimpleLineChart({
  data = [],
  width = 180,
  height = 120,
  color = '#16a34a',
  area = false,
  strokeWidth = 2,
  padding = { top: 10, right: 12, bottom: 28, left: 36 },
  ticks = 5,
  maxY = undefined,
  axis = {}, // { yFormatter, xFormatter, xLabels }
  onPointPress = null,
}) {
  if (!Array.isArray(data) || data.length === 0) return <View style={{ width, height }} />
  const vals = data.map(v => (typeof v === 'number' ? v : v?.y ?? 0))
  const xLabels = (axis && axis.xLabels) || data.map(d => (d && d.x) || '')
  const computedMax = Math.max(...vals)
  const computedMin = Math.min(...vals)
  const yMax = typeof maxY === 'number' ? maxY : Math.ceil((computedMax) * 1.1)
  const yMin = Math.min(0, computedMin)

  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const stepX = vals.length > 1 ? innerW / (vals.length - 1) : innerW

  const xAt = (i) => padding.left + (vals.length === 1 ? innerW / 2 : i * stepX)
  const yAt = (v) => padding.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH

  const points = vals.map((v, i) => [xAt(i), yAt(v)])
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  let areaPath = ''
  if (area && points.length > 0) {
    areaPath = `${d} L ${padding.left + innerW},${padding.top + innerH} L ${padding.left},${padding.top + innerH} Z`
  }

  const gradId = `grad-${Math.random().toString(36).slice(2,8)}`

  // y ticks
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks)

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {/* grid lines and y labels */}
      <G>
        {yTicks.map((t, i) => {
          const y = yAt(t)
          const yy = Math.round(y) + 0.5
          return (
            <G key={`g-${i}`}>
              <Line x1={padding.left} y1={yy} x2={width - padding.right} y2={yy} stroke="#e5e7eb" strokeWidth={1} />
              <SvgText x={padding.left - 8} y={yy} fontSize={12} fill={axis.yColor || '#111827'} textAnchor="end" alignmentBaseline="middle">
                {(axis.yFormatter || ((n) => String(Math.round(n))))(t)}
              </SvgText>
            </G>
          )
        })}
      </G>

      {/* area */}
      {area && areaPath ? <Path d={areaPath} fill={`url(#${gradId})`} /> : null}

      {/* line */}
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />

  {/* baseline */}
  <Line x1={padding.left} y1={padding.top + innerH + 0.5} x2={padding.left + innerW} y2={padding.top + innerH + 0.5} stroke="#e5e7eb" strokeWidth={1} />

      {/* points (transparent circles) to capture presses */}
      {points.map((p, i) => (
        <Circle key={`pt-${i}`} cx={p[0]} cy={p[1]} r={12} fill="transparent" onPress={() => onPointPress && onPointPress({ index: i, value: vals[i], datum: data[i], x: p[0], y: p[1] })} />
      ))}

      {/* x labels */}
      {xLabels.map((lab, i) => (
        <SvgText key={`x-${i}`} x={xAt(i)} y={height - padding.bottom + 16} fontSize={10} fill={axis.xColor || '#6b7280'} textAnchor="middle">
          {(axis.xFormatter || ((s) => String(s)))(lab)}
        </SvgText>
      ))}
    </Svg>
  )
}
