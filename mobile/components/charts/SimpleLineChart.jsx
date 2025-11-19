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
  smooth = false,
  tension = 0.4, // 0..1, higher = curvier
}) {
  if (!Array.isArray(data) || data.length === 0) return <View style={{ width, height }} />
  // Read raw values and clamp them to >= 0 so the chart never goes below the baseline
  const rawVals = data.map(v => (typeof v === 'number' ? v : v?.y ?? 0))
  const vals = rawVals.map(v => Math.max(0, Number(v || 0)))
  const xFracArr = data.map(v => (v && typeof v === 'object' && typeof v.xFrac === 'number') ? v.xFrac : null)
  const xLabels = (axis && axis.xLabels) || data.map(d => (d && d.x) || '')
  const computedMax = Math.max(...vals)
  // Force yMin to 0 to avoid plotting below the baseline
  const yMax = typeof maxY === 'number' ? maxY : Math.ceil((computedMax) * 1.1)
  const yMin = 0

  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const stepX = vals.length > 1 ? innerW / (vals.length - 1) : innerW

  const xAt = (i) => {
    // If this point provides an explicit fractional x position (0..1), use it.
    if (xFracArr[i] != null) return padding.left + xFracArr[i] * innerW
    return padding.left + (vals.length === 1 ? innerW / 2 : i * stepX)
  }

  // Label positions should be evenly spaced across the inner width regardless of
  // per-point fractional x positions. This keeps axis ticks evenly distributed
  // (e.g., Sep, Oct, Nov, Dec) while points can be positioned between ticks.
  const xLabelAt = (i) => padding.left + (vals.length === 1 ? innerW / 2 : i * stepX)
  const yAt = (v) => padding.top + (1 - (v - yMin) / (yMax - yMin || 1)) * innerH

  const points = vals.map((v, i) => [xAt(i), yAt(v)])

  const toPath = (pts) => {
    if (pts.length === 0) return ''
    if (!smooth || pts.length < 3) {
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
    }
    // Catmull-Rom to cubic Bezier conversion
    const path = []
    path.push(`M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`)
    const s = Math.max(0, Math.min(1, tension))
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] || p2
      const c1x = p1[0] + (p2[0] - p0[0]) / 6 * s
      const c1y = p1[1] + (p2[1] - p0[1]) / 6 * s
      const c2x = p2[0] - (p3[0] - p1[0]) / 6 * s
      const c2y = p2[1] - (p3[1] - p1[1]) / 6 * s
      path.push(`C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`)
    }
    return path.join(' ')
  }

  const d = toPath(points)
  let areaPath = ''
  if (area && points.length > 0) {
    // Close the area path at the x coordinate of the last point so the shaded
    // area stops where the line stops (does not extend to the full chart width).
    const firstX = points[0][0]
    const lastX = points[points.length - 1][0]
    const baseY = padding.top + innerH
    areaPath = `${d} L ${lastX.toFixed(2)},${baseY.toFixed(2)} L ${firstX.toFixed(2)},${baseY.toFixed(2)} Z`
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
  {/* baseline - stop at last plotted x so baseline matches the filled area */}
  <Line x1={padding.left} y1={padding.top + innerH + 0.5} x2={points.length ? points[points.length - 1][0] : (padding.left + innerW)} y2={padding.top + innerH + 0.5} stroke="#e5e7eb" strokeWidth={1} />

      {/* points (transparent circles) to capture presses */}
      {points.map((p, i) => (
        <Circle key={`pt-${i}`} cx={p[0]} cy={p[1]} r={12} fill="transparent" onPress={() => onPointPress && onPointPress({ index: i, value: vals[i], datum: data[i], x: p[0], y: p[1] })} />
      ))}

      {/* x labels - align first to left edge and last to right edge so months line up with y-axis baseline */}
      {xLabels.map((lab, i) => {
        const isFirst = i === 0
        const isLast = i === xLabels.length - 1
        const xPos = isFirst ? padding.left : (isLast ? padding.left + innerW : xLabelAt(i))
        const anchor = isFirst ? 'start' : (isLast ? 'end' : 'middle')
        return (
          <SvgText key={`x-${i}`} x={xPos} y={height - padding.bottom + 16} fontSize={10} fill={axis.xColor || '#6b7280'} textAnchor={anchor}>
            {(axis.xFormatter || ((s) => String(s)))(lab)}
          </SvgText>
        )
      })}
    </Svg>
  )
}
