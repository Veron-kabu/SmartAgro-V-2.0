import { useEffect, useState, useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, Image } from 'react-native'
import { getJSON } from '../../context/api'

export default function FavouritesScreen() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getJSON('/api/favorites?buyer=me')
      if (Array.isArray(data)) setItems(data)
      else setItems([])
    } catch (e) {
      setError(e?.message || 'Failed to load favourites')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }, [load])

  if (loading) return <View style={styles.center}><Text>Loading…</Text></View>
  if (error) return <View style={styles.center}><Text style={{ color: 'crimson' }}>{error}</Text></View>

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Favourites</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id || `${item.product?.id}-${item.farmer?.id}`)}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#f3f4f6' }} />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: item.product?.imageUrl || 'https://via.placeholder.com/48' }} style={styles.thumb} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{item.product?.title || 'Product'}</Text>
              <Text style={styles.muted}>Farmer: {item.farmer?.fullName || 'Unknown'}</Text>
              <Text style={styles.muted}>${item.product?.price}/{item.product?.unit}</Text>
            </View>
          </View>
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={<Text style={styles.muted}>No favourites yet.</Text>}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#e5e7eb' },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  muted: { color: '#6b7280', fontSize: 12 },
})
