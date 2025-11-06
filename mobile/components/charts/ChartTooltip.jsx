import React from 'react'
import { View, Text } from 'react-native'

export default function ChartTooltip({ visible = false, left = 0, top = 0, width = 140, label, value, formatValue = (v) => String(v) }) {
  if (!visible) return null
  return (
    <View style={{ position: 'absolute', left, top, width, padding: 8, backgroundColor: 'white', borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 }}>
      {label && <Text style={{ fontSize: 12, color: '#6b7280' }}>{label}</Text>}
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{formatValue(value)}</Text>
    </View>
  )
}
