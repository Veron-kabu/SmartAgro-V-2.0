import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

export default function StarRating({ value = 0, max = 5, size = 20, color = '#f59e0b', gap = 4, editable = false, onChange }) {
  const v = Math.max(0, Math.min(max, Number(value) || 0))
  const stars = []
  for (let i = 1; i <= max; i++) {
    // Determine full / half / empty for this star index
    let iconName = 'star-border'
    let iconColor = '#d1d5db'
    if (v >= i) {
      iconName = 'star'
      iconColor = color
    } else if (v >= i - 0.5) {
      iconName = 'star-half'
      iconColor = color
    }
    const starIcon = (
      <MaterialIcons name={iconName} size={size} color={iconColor} key={`t-${i}`} />
    )
    if (editable) {
      stars.push(
        <TouchableOpacity
          key={`wrap-${i}`}
          onPress={() => onChange && onChange(i)}
          activeOpacity={0.7}
          style={{ marginRight: i === max ? 0 : gap, paddingHorizontal: Math.max(2, gap/2), paddingVertical: 2 }}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>{starIcon}</View>
        </TouchableOpacity>
      )
    } else {
      stars.push(
        <View key={`s-${i}`} style={{ marginRight: i === max ? 0 : gap, alignItems: 'center', justifyContent: 'center' }}>{starIcon}</View>
      )
    }
  }
  return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{stars}</View>
}
