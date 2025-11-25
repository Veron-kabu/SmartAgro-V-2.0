import { View, Text } from 'react-native'
import { COLORS } from '../../constants/colors'

export default function MetricCard({ title, value, trend = 0, hint }) {
  const trendColor = trend > 0 ? '#16a34a' : trend < 0 ? '#ef4444' : '#6b7280'
  const trendSign = trend > 0 ? '+' : ''
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 14, padding: 12, flex: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 }}>
      <Text style={{ fontSize: 12, color: '#6b7280', fontWeight: '600' }}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>{value}</Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: trendColor + '22' }}>
          <Text style={{ color: trendColor, fontSize: 12, fontWeight: '700' }}>{trendSign}{trend}%</Text>
        </View>
      </View>
      {hint ? <Text style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>{hint}</Text> : null}
    </View>
  )
}
