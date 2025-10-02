import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ORDER_STATUS_FLOW } from '../utils/orders'

/**
 * OrderTimeline
 * Lightweight visual representation of where an order sits in the status flow.
 * Props:
 *  - status: current status string
 *  - style: optional container style
 *  - compact: boolean for tighter layout
 */
export function OrderTimeline({ status, style, compact = false }) {
  const flow = ORDER_STATUS_FLOW
  const s = (status || '').toLowerCase()
  return (
    <View style={[styles.row, style]}>
      {flow.map((step, idx) => {
        const reached = flow.indexOf(s) >= idx
        const isCurrent = step === s
        return (
          <React.Fragment key={step}>
            <View style={styles.col}>
              <View style={[styles.dot, reached && styles.dotReached, isCurrent && styles.dotCurrent]} />
              <Text style={[styles.label, reached ? styles.labelReached : styles.labelPending, compact && styles.labelCompact]}>{step}</Text>
            </View>
            {idx < flow.length - 1 && <View style={[styles.line, flow.indexOf(s) > idx && styles.lineReached]} />}
          </React.Fragment>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  col: { alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#d1d5db' },
  dotReached: { backgroundColor: '#60a5fa' },
  dotCurrent: { backgroundColor: '#16a34a', transform: [{ scale: 1.15 }] },
  line: { width: 32, height: 2, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  lineReached: { backgroundColor: '#60a5fa' },
  label: { fontSize: 10, textTransform: 'uppercase', marginTop: 4, color: '#6b7280' },
  labelReached: { color: '#1f2937' },
  labelPending: { color: '#9ca3af' },
  labelCompact: { fontSize: 9 },
})

export default OrderTimeline
