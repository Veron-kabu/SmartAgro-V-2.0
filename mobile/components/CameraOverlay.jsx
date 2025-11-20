import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

export default function CameraOverlay({ step, total = 3 }) {
  const safeTotal = Number(total) || 3
  const parsedStep = Number(step)
  const rawStep = Number.isFinite(parsedStep) ? parsedStep : 0
  const displayStep = Math.min(Math.max(0, rawStep), safeTotal)
  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* code badge removed */}
      <View style={styles.progress}>
        <Text style={styles.progressText}>Photo {displayStep}/{safeTotal}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    justifyContent: 'space-between', padding: 16,
  },
  // code badge styles removed
  progress: { alignItems: 'center', marginBottom: 24 },
  progressText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  hint: { color: '#fff', opacity: 0.9, marginTop: 6, fontWeight: '600' },
  hintSmall: { color: '#fff', opacity: 0.85, marginTop: 4, fontSize: 12 },
})
