import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, FlatList } from 'react-native'
import { getJSON } from '../../context/api'
import { earningsStyles as styles } from '../../assets/styles/dashboard.styles'
import EmptyState from '../../components/EmptyState'

export default function TransactionsScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        setLoading(true)
        // Placeholder endpoint; replace when backend exposes transactions
        const data = await getJSON('/api/earnings/farmer/summary')
        if (cancelled) return
        // Derive a basic transactions list from earnings listing stats for now
        const rows = (data?.listings || []).map((l, i) => ({ id: String(i+1), type: 'sale', title: l.title, amount: l.revenue || 0 }))
        setItems(rows)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load transactions')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator size="small" /><Text style={styles.muted}> Loading transactions...</Text></View>
  if (error) return <View style={styles.center}><Text style={styles.muted}>{error}</Text></View>

  if (!items.length) return <View style={styles.center}><EmptyState context="funds" /></View>

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.listRow}>
          <Text style={styles.metricLabel}>{item.title}</Text>
          <Text style={styles.metricValue}>KES {Number(item.amount||0).toLocaleString()}</Text>
        </View>
      )}
      contentContainerStyle={{ padding: 16 }}
    />
  )
}
