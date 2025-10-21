import React from 'react';
import { View, Text } from 'react-native';

export default function CountBadge({
  count = 0,
  max = 99,
  backgroundColor = '#ef4444',
  textColor = '#fff',
  size = 18,
  minWidth = 18,
  fontSize = 10,
  fontWeight = '700',
  style,
  textStyle,
}) {
  if (!count || count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  const height = size;
  const borderRadius = Math.round(size / 2);
  const containerStyle = {
    backgroundColor,
    borderRadius,
    minWidth: Math.max(minWidth, size),
    height,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <View style={[containerStyle, style]} accessibilityRole="text" accessibilityLabel={`Count ${label}`}>
      <Text style={[{ color: textColor, fontSize, fontWeight }, textStyle]}>{label}</Text>
    </View>
  );
}
