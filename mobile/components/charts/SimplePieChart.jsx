import { Svg, G, Path } from 'react-native-svg'
import { View } from 'react-native'

function arcPath(cx, cy, r, startAngle, endAngle, innerR = 0) {
  const toXY = (ang, rad) => [cx + rad * Math.cos(ang), cy + rad * Math.sin(ang)]
  const large = endAngle - startAngle > Math.PI ? 1 : 0
  const outerStart = toXY(startAngle, r)
  const outerEnd = toXY(endAngle, r)
  if (innerR > 0) {
    const innerEnd = toXY(endAngle, innerR)
    const innerStart = toXY(startAngle, innerR)
    return [
      `M ${outerStart[0]} ${outerStart[1]}`,
      `A ${r} ${r} 0 ${large} 1 ${outerEnd[0]} ${outerEnd[1]}`,
      `L ${innerEnd[0]} ${innerEnd[1]}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${innerStart[0]} ${innerStart[1]}`,
      'Z',
    ].join(' ')
  }
  return [
    `M ${cx} ${cy}`,
    `L ${outerStart[0]} ${outerStart[1]}`,
    `A ${r} ${r} 0 ${large} 1 ${outerEnd[0]} ${outerEnd[1]}`,
    'Z',
  ].join(' ')
}

export default function SimplePieChart({ data = [], width = 120, height = 120, colors = [], donut = false, stroke = '#fff' }) {
  if (!Array.isArray(data) || data.length === 0) return <View style={{ width, height }} />
  const total = data.reduce((a, b) => a + (typeof b === 'number' ? b : b?.value ?? 0), 0) || 1
  const vals = data.map((v) => (typeof v === 'number' ? v : v?.value ?? 0))
  const cx = width / 2, cy = height / 2
  const r = Math.min(width, height) / 2
  const innerR = donut ? r * 0.55 : 0
  let angle = -Math.PI / 2 // start at top
  const palette = colors.length ? colors : ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
  const slices = []
  vals.forEach((v, i) => {
    const slice = (v / total) * Math.PI * 2
    const end = angle + slice
    const path = arcPath(cx, cy, r, angle, end, innerR)
    slices.push({ path, fill: palette[i % palette.length] })
    angle = end
  })
  return (
    <Svg width={width} height={height}>
      <G>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.fill} stroke={stroke} />
        ))}
      </G>
    </Svg>
  )
}
