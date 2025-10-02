import React from 'react'
import { View, StyleSheet } from 'react-native'
import Shimmer from './Shimmer'

/**
 * SkeletonCard
 * Reusable loading placeholder for market product list items.
 * Props:
 *  - style: optional container style overrides
 *  - showActions (default: true): whether to render action pill placeholders
 */
export default function SkeletonCard({ style, showActions = true }) {
  return (
    <View style={[styles.container, style]}>
      <Shimmer style={styles.image} />
      <View style={styles.lines}>
        <Shimmer style={styles.lineShort} />
        <Shimmer style={styles.lineLong} />
        {showActions && (
          <View style={styles.actionRow}>
            <Shimmer style={styles.pill} />
            <Shimmer style={styles.pillAlt} />
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e5e7eb', borderRadius: 28, padding: 12, marginVertical: 10, gap: 14 },
  image: { width: 88, height: 88, borderRadius: 16 },
  lines: { flex: 1 },
  lineShort: { width: '50%', height: 14, borderRadius: 8, marginBottom: 10 },
  lineLong: { width: '70%', height: 12, borderRadius: 8 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  pill: { height: 24, width: 70, borderRadius: 16 },
  pillAlt: { height: 24, width: 60, borderRadius: 16 },
})
