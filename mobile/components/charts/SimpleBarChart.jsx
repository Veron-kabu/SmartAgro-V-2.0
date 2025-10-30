import { Svg, Rect } from 'react-native-svg'
import { View } from 'react-native'

export default function SimpleBarChart({ data = [], width = 180, height = 80, color = '#0ea5e9', gap = 2 }) {
  if (!Array.isArray(data) || data.length === 0) return <View style={{ width, height }} />
  const vals = data.map(v => (typeof v === 'number' ? v : v?.y ?? 0))
  const max = Math.max(...vals) || 1
  const pad = 6
  const w = width - pad * 2
  const h = height - pad * 2
  const barW = (w - gap * (vals.length - 1)) / vals.length
  return (
    <Svg width={width} height={height}>
      {vals.map((v, i) => {
        const x = pad + i * (barW + gap)
        const bh = (v / max) * h
        const y = pad + (h - bh)
        return <Rect key={i} x={x} y={y} width={barW} height={bh} rx={3} fill={color} />
      })}
    </Svg>
  )
}
