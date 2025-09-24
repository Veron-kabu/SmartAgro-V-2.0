import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native'
import { getJSON } from '../../context/api'

export default function SearchTab() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')

  // Debounced search
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        // Try a products search endpoint; fallback to mock if unavailable
        const data = await getJSON(`/api/products?search=${encodeURIComponent(q)}&limit=25`)
        if (!cancelled) {
          const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
          setResults(items)
        }
      } catch (_e) {
        if (!cancelled) {
          // Fallback mock data
          const mock = [
            { id: 'm1', title: `Result for "${q}"`, type: 'product', price: 10.5 },
            { id: 'm2', title: `${q} seller`, type: 'farmer' },
          ]
          setResults(mock)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const renderItem = useCallback(({ item }) => (
    <View style={styles.resultRow}>
      <View style={styles.thumb}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: 36, height: 36, borderRadius: 6 }} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.resultTitle}>{item.title || item.name || 'Item'}</Text>
        <Text style={styles.resultMeta}>{item.type || (item.price ? 'product' : 'result')}</Text>
      </View>
      {typeof item.price !== 'undefined' && (
        <Text style={styles.price}>${Number(item.price).toFixed(2)}</Text>
      )}
    </View>
  ), [])

  const header = useMemo(() => (
    <View style={styles.searchBar}>
      <TextInput
        placeholder="Search products or farmers"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={styles.input}
        returnKeyType="search"
      />
      {!!query && (
        <TouchableOpacity onPress={() => setQuery('')}>
          <Text style={styles.clear}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [query])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      {header}
      {loading ? (
        <View style={styles.center}> 
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : results.length === 0 ? (
        <View style={[styles.center, { paddingTop: 24 }]}> 
          <Image source={require('../../assets/images/partial-react-logo.png')} style={{ width: 96, height: 96, marginBottom: 8 }} />
          <Text style={styles.muted}>{query.trim().length < 2 ? 'Type at least 2 characters to search' : 'No results found'}</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item, index) => String(item.id ?? index)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
      {!!error && <Text style={[styles.muted, { color: '#ef4444', marginTop: 8 }]}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  clear: { color: '#16a34a', fontWeight: '700' },
  muted: { color: '#6b7280', fontSize: 12 },
  resultRow: { backgroundColor: '#fff', padding: 12, borderRadius: 10, marginVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 12 },
  resultTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  resultMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  price: { fontWeight: '700', color: '#111827' },
})
