import { Svg, Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg'
import { View } from 'react-native'

export default function SimpleLineChart({ data = [], width = 180, height = 80, color = '#16a34a', area = false, strokeWidth = 2 }) {
  if (!Array.isArray(data) || data.length === 0) return <View style={{ width, height }} />
  const vals = data.map(v => (typeof v === 'number' ? v : v?.y ?? 0))
  const max = Math.max(...vals)
  const min = Math.min(...vals)
  const pad = 6
  const w = width - pad * 2
  const h = height - pad * 2
  const range = max - min || 1
  const stepX = w / Math.max(1, (vals.length - 1))
  const points = vals.map((v, i) => {
    const x = pad + i * stepX
    const y = pad + (1 - (v - min) / range) * h
    return [x, y]
  })
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  let areaPath = ''
  if (area) {
    areaPath = `${d} L${pad + w},${pad + h} L${pad},${pad + h} Z`
  }
  const gradId = `grad-${Math.random().toString(36).slice(2,8)}`
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <Stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      {area && <Path d={areaPath} fill={`url(#${gradId})`} />}
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {/* baseline */}
      <Rect x={pad} y={pad + h} width={w} height={1} fill="#e5e7eb" />
    </Svg>
  )
}
