import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Image } from 'react-native'
import SkeletonCard from '../../components/SkeletonCard'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import BlurhashImage from '../../components/BlurhashImage'
import { getJSON } from '../../context/api'
import { useProfile } from '../../context/profile'

export default function SearchTab() {
  const { profile } = useProfile()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const CATEGORY_KEY = 'market:lastCategory'
  const SORT_KEY = 'market:lastSort'
  const [activeCategory, setActiveCategory] = useState(null)
  const [sortField, setSortField] = useState('price') // price | title
  const [sortOpen, setSortOpen] = useState(false)
  const [cursor, setCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [initialized, setInitialized] = useState(false)

  // Expanded category taxonomy
  const categoryGroups = useMemo(() => ([
    { label: 'Fresh', categories: ['Fruits','Vegetables','Dairy','Eggs'], defaultOpen: true },
    { label: 'Meat & Seafood', categories: ['Meat','Seafood'], defaultOpen: false },
    { label: 'Staples', categories: ['Grains','Root','Herbs'] },
  ]), [])
  const [openGroups, setOpenGroups] = useState(() => new Set(categoryGroups.filter(g=>g.defaultOpen).map(g=>g.label)))
  const categoriesFlat = useMemo(() => categoryGroups.flatMap(g => g.categories), [categoryGroups])

  const toggleGroup = useCallback((label) => {
    setOpenGroups(prev => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n })
  }, [])

  // Debounced search
  // Restore persisted selections
  useEffect(() => {
    (async () => {
      try {
        const [c, s] = await Promise.all([
          AsyncStorage.getItem(CATEGORY_KEY),
          AsyncStorage.getItem(SORT_KEY)
        ])
        if (c && categoriesFlat.includes(c)) setActiveCategory(c)
        if (s && (s === 'price' || s === 'title')) setSortField(s)
      } catch { /* ignore */ }
      setInitialized(true)
    })()
  }, [categoriesFlat])

  // Persist on change
  useEffect(() => { if (initialized) AsyncStorage.setItem(CATEGORY_KEY, activeCategory || '') }, [activeCategory, initialized])
  useEffect(() => { if (initialized) AsyncStorage.setItem(SORT_KEY, sortField) }, [sortField, initialized])

  useEffect(() => {
    const q = query.trim()
    // Always allow listing with filters even if no query (fetch trending/all limited)
    const baseUrl = '/api/products'
    const params = new URLSearchParams()
    if (q.length >= 2) params.set('search', q)
    if (activeCategory) params.set('category', activeCategory.toLowerCase())
    params.set('limit','15')
    if (cursor) params.set('cursor', cursor)
    const url = `${baseUrl}?${params.toString()}`
    let cancelled = false
    setLoading(true)
    setError('')
    const timer = setTimeout(async () => {
      try {
        const data = await getJSON(url)
        if (!cancelled) {
          const isPaged = data && typeof data === 'object' && Array.isArray(data.items)
          const items = isPaged ? data.items : (Array.isArray(data) ? data : [])
          // client sort
          items.sort((a,b) => {
            if (sortField === 'price') return (Number(a.price)||0) - (Number(b.price)||0)
            return String(a.title||'').localeCompare(String(b.title||''))
          })
          setResults(items)
          if (isPaged) {
            setHasMore(!!data.nextCursor)
            setCursor(data.nextCursor || null)
          } else {
            setHasMore(false)
          }
        }
      } catch (_e) {
        if (!cancelled) {
          // Fallback mock data
          const mock = [
            { id: 'm1', title: `Result for "${q}"`, type: 'product', price: 10.5 },
            { id: 'm2', title: `${q} seller`, type: 'farmer' },
          ]
          setResults(mock)
          setHasMore(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 350)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, activeCategory, sortField, cursor])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return
    if (!cursor) return
    try {
      setLoadingMore(true)
      const baseUrl = '/api/products'
      const params = new URLSearchParams()
      if (activeCategory) params.set('category', activeCategory.toLowerCase())
      const q = query.trim(); if (q.length >= 2) params.set('search', q)
      params.set('limit','15'); params.set('cursor', cursor)
      const url = `${baseUrl}?${params.toString()}`
      const data = await getJSON(url)
      const isPaged = data && typeof data === 'object' && Array.isArray(data.items)
      const items = isPaged ? data.items : (Array.isArray(data) ? data : [])
      items.sort((a,b) => { if (sortField === 'price') return (Number(a.price)||0)-(Number(b.price)||0); return String(a.title||'').localeCompare(String(b.title||'')) })
      setResults(prev => [...prev, ...items])
      if (isPaged) {
        setHasMore(!!data.nextCursor)
        setCursor(data.nextCursor || null)
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }, [hasMore, loadingMore, loading, cursor, activeCategory, query, sortField])

  const renderItem = useCallback(({ item }) => {
    const thumbUrl = Array.isArray(item.images) && item.images.length > 0 ? item.images[0] : null
    const blurhash = Array.isArray(item.imageBlurhashes) && item.imageBlurhashes.length > 0 ? item.imageBlurhashes[0] : null
    const organic = item.isOrganic
    const qty = item.quantityAvailable
    const isOwner = profile?.id && item.farmerId === profile.id && profile.role === 'farmer'
    const onPressCard = () => {
      if (isOwner) {
        router.push(`/products/edit/${item.id}`)
      } else {
        router.push(`/products/${item.id}`)
      }
    }
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPressCard} style={styles.card}>
        <View style={styles.cardImageWrap}>
          {thumbUrl ? (
            <BlurhashImage uri={thumbUrl} blurhash={blurhash} style={styles.cardImage} contentFit="cover" />
          ) : (
            <Image source={require('../../assets/images/icon.png')} style={styles.cardImage} />
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title || item.name || 'Item'}</Text>
          {typeof item.price !== 'undefined' && (
            <Text style={styles.cardPrice}>${Number(item.price).toFixed(2)} / {item.unit || 'unit'}</Text>
          )}
          <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:4, gap:4 }}>
            {(() => {
              const status = (item.status || '').toLowerCase()
              const qty = Number(item.quantityAvailable||0)
              let label = 'Active'
              let bg = '#dcfce7'; let fg = '#065f46'
              if (status && status !== 'active') {
                if (status === 'sold') { label='Sold'; bg='#fee2e2'; fg='#991b1b' }
                else if (status === 'expired') { label='Expired'; bg='#e5e7eb'; fg='#374151' }
                else if (status === 'inactive') { label='Inactive'; bg='#fef3c7'; fg='#92400e' }
                else { label = status }
              }
              if (qty === 0) { label='Out of Stock'; bg='#fee2e2'; fg='#991b1b' }
              return <Text style={{ backgroundColor:bg, color:fg, fontSize:10, fontWeight:'700', paddingHorizontal:8, paddingVertical:3, borderRadius:8 }}>{label}</Text>
            })()}
          </View>
          <View style={styles.badgesRow}>
            {organic && <View style={[styles.badge, styles.badgeOrganic]}><Text style={styles.badgeOrganicText}>Organic</Text></View>}
            {typeof qty === 'number' && <View style={[styles.badge, styles.badgeQty]}><Text style={styles.badgeQtyText}>{qty} left</Text></View>}
            {isOwner && <View style={[styles.badge, styles.badgeOwner]}><Text style={styles.badgeOwnerText}>Yours</Text></View>}
          </View>
          {!isOwner && (
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.orderBtn} activeOpacity={0.85} onPress={() => router.push(`/orders/new?product=${item.id}`)}><Text style={styles.orderBtnText}>Order</Text></TouchableOpacity>
              <TouchableOpacity style={styles.chatBtn} activeOpacity={0.85} onPress={() => router.push(`/dashboard/messages?to=${item.farmerId}`)}><Text style={styles.chatBtnText}>Chat</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }, [profile])

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

  const categoryBar = (
    <View style={styles.catBar}>
      <Text style={styles.catFilterLabel}>Categories</Text>
      {categoryGroups.map(group => {
        const open = openGroups.has(group.label)
        return (
          <View key={group.label} style={{ marginBottom: 10 }}>
            <TouchableOpacity onPress={() => toggleGroup(group.label)} activeOpacity={0.7} style={styles.groupHeaderRow}>
              <Text style={styles.groupHeader}>{group.label}</Text>
              <Text style={styles.groupChevron}>{open ? '▾' : '▸'}</Text>
            </TouchableOpacity>
            {open && (
              <View style={styles.catChipsRowWrap}>
                {group.categories.map(cat => {
                  const active = activeCategory === cat
                  return (
                    <TouchableOpacity key={cat} style={[styles.catChip, active && styles.catChipActive]} onPress={() => setActiveCategory(active ? null : cat)} activeOpacity={0.85}>
                      <Text style={[styles.catChipText, active && styles.catChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </View>
        )
      })}
      <View style={[styles.sortRow, { marginTop: 4 }]}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <TouchableOpacity style={styles.sortSelect} onPress={() => setSortOpen(o=>!o)} activeOpacity={0.85}>
          <Text style={styles.sortSelectText}>{sortField === 'price' ? 'Price' : 'Name'}</Text>
        </TouchableOpacity>
        {sortOpen && (
          <View style={styles.sortDropdown}>
            <TouchableOpacity style={styles.sortOption} onPress={() => { setSortField('price'); setSortOpen(false) }}><Text style={styles.sortOptionText}>Price</Text></TouchableOpacity>
            <TouchableOpacity style={styles.sortOption} onPress={() => { setSortField('title'); setSortOpen(false) }}><Text style={styles.sortOptionText}>Name</Text></TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Market</Text>
      {header}
      {categoryBar}
      {loading ? (
        <View style={{ marginTop: 16 }}>
          {[...Array(5)].map((_,i)=>(<SkeletonCard key={i} />))}
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
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#16a34a" /> : null}
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
  catBar: { backgroundColor: '#fff', padding: 12, borderRadius: 16, marginTop: 12, marginBottom: 8 },
  catFilterLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
  catChipsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  catChip: { backgroundColor: '#f1f5f9', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  catChipActive: { backgroundColor: '#111827' },
  catChipText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  catChipTextActive: { color: '#fff' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sortSelect: { flexDirection: 'row', backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  sortSelectText: { fontSize: 12, color: '#111827', fontWeight: '600' },
  sortDropdown: { position: 'absolute', top: 34, right: 0, backgroundColor: '#fff', borderRadius: 12, elevation: 4, paddingVertical: 4, minWidth: 120 },
  sortOption: { paddingHorizontal: 12, paddingVertical: 8 },
  sortOptionText: { fontSize: 12, color: '#111827' },
  card: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 28, padding: 12, marginVertical: 10, gap: 14, alignItems: 'center' },
  cardImageWrap: { width: 88, height: 88, borderRadius: 16, overflow: 'hidden', backgroundColor: '#d1d5db' },
  cardImage: { width: '100%', height: '100%' },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  cardPrice: { fontSize: 12, color: '#111827', marginTop: 4, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  orderBtn: { backgroundColor: '#000', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 18 },
  orderBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  chatBtn: { backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 6, borderRadius: 18 },
  chatBtnText: { color: '#111827', fontSize: 12, fontWeight: '600' },
  badgesRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeOrganic: { backgroundColor: '#dcfce7' },
  badgeOrganicText: { fontSize: 10, color: '#166534', fontWeight: '700' },
  badgeQty: { backgroundColor: '#e0f2fe' },
  badgeQtyText: { fontSize: 10, color: '#075985', fontWeight: '700' },
  badgeOwner: { backgroundColor: '#fef3c7' },
  badgeOwnerText: { fontSize: 10, color: '#92400e', fontWeight: '700' },
  groupHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  groupHeader: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  groupChevron: { fontSize: 12, color: '#6b7280' },
  catChipsRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  // (Skeleton styles moved to SkeletonCard component)
})
