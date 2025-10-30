import { Svg, Path, Defs, LinearGradient, Stop, G, Text as SvgText, Rect } from 'react-native-svg'
import { View } from 'react-native'

export default function DualAreaLineChart({
  width = 360,
  height = 240,
  seriesA = [],
  seriesB = [],
  colorA = '#2563eb', // blue
  colorB = '#60a5fa', // sky
  xLabels = [],
  padding = { top: 20, right: 16, bottom: 44, left: 36 },
  yTicks = 5,
  legend = ['Page views', 'Sessions'],
}) {
  const n = Math.max(seriesA.length, seriesB.length)
  if (n === 0) return <View style={{ width, height }} />
  const vals = []
  for (let i = 0; i < n; i++) {
    vals.push(typeof seriesA[i] === 'number' ? seriesA[i] : 0)
    vals.push(typeof seriesB[i] === 'number' ? seriesB[i] : 0)
  }
  const max = Math.max(1, ...vals)
  const min = 0
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom
  const stepX = n > 1 ? innerW / (n - 1) : innerW
  const xAt = (i) => padding.left + i * stepX
  const scaleY = (v) => padding.top + (1 - (v - min) / (max - min || 1)) * innerH

  const toPoints = (arr) => arr.map((v, i) => [xAt(i), scaleY(typeof v === 'number' ? v : 0)])
  const smooth = (pts) => {
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

  const ptsA = toPoints(seriesA)
  const ptsB = toPoints(seriesB)
  const pathA = smooth(ptsA)
  const pathB = smooth(ptsB)
  const ga = `ga-${Math.random().toString(36).slice(2,8)}`
  const gb = `gb-${Math.random().toString(36).slice(2,8)}`
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (max / yTicks) * i)

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={ga} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colorA} stopOpacity={0.25} />
          <Stop offset="100%" stopColor={colorA} stopOpacity={0.02} />
        </LinearGradient>
        <LinearGradient id={gb} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={colorB} stopOpacity={0.2} />
          <Stop offset="100%" stopColor={colorB} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>

      {/* Grid and Y labels */}
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

      {/* Areas */}
      {ptsA.length>1 && (
        <Path d={`${pathA} L ${xAt(n - 1)},${padding.top + innerH} L ${xAt(0)},${padding.top + innerH} Z`} fill={`url(#${ga})`} />
      )}
      {ptsB.length>1 && (
        <Path d={`${pathB} L ${xAt(n - 1)},${padding.top + innerH} L ${xAt(0)},${padding.top + innerH} Z`} fill={`url(#${gb})`} />
      )}

      {/* Lines */}
      {ptsA.length>1 && <Path d={pathA} stroke={colorA} strokeWidth={3} fill="none" />}
      {ptsB.length>1 && <Path d={pathB} stroke={colorB} strokeWidth={3} fill="none" />}

      {/* X labels */}
      <G>
        {xLabels.slice(0, n).map((label, i) => (
          <SvgText key={`x-${i}`} x={xAt(i)} y={height - padding.bottom + 16} fontSize={10} fill="#6b7280" textAnchor="middle">
            {label}
          </SvgText>
        ))}
      </G>

      {/* Legend */}
      {Array.isArray(legend) && legend.length >= 2 ? (
        <G>
          {/* Dot A */}
          <Rect x={width/2 - 70} y={height - 20} width={8} height={8} rx={4} fill={colorA} />
          <SvgText x={width/2 - 56} y={height - 13} fontSize={12} fill="#111827">{legend[0]}</SvgText>
          {/* Dot B */}
          <Rect x={width/2 + 25} y={height - 20} width={8} height={8} rx={4} fill={colorB} />
          <SvgText x={width/2 + 39} y={height - 13} fontSize={12} fill="#111827">{legend[1]}</SvgText>
        </G>
      ) : null}
    </Svg>
  )
}
