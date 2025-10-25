import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { View, Text, TextInput, FlatList, ActivityIndicator, RefreshControl, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import MarketPriceCard from '../../components/MarketPriceCard'
import { useRouter } from 'expo-router'
import { fetchMarketPrices } from '../../utils/marketPrices'
import { searchMarketProducts } from '../../utils/marketSearch'
import { useDebounce } from '../../hooks/useDebounce'
import { fetchMarkets } from '../../utils/markets'
import { Ionicons } from '@expo/vector-icons'

export default function MarketPricesScreen() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 350)
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState([])
  const [cursor, setCursor] = useState(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const seenIdsRef = useRef(new Set())
  const [selectedMarket, setSelectedMarket] = useState(null)

  // Markets panel state
  const [marketsOpen, setMarketsOpen] = useState(false)
  const [marketsLoading, setMarketsLoading] = useState(false)
  const [marketsError, setMarketsError] = useState(null)
  const [markets, setMarkets] = useState([])
  const [marketsQ, setMarketsQ] = useState('')

  // Prefetch markets on mount so the panel can show immediately when opened
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setMarketsLoading(true)
        const data = await fetchMarkets()
        if (!mounted) return
        setMarkets(data)
      } catch (e) {
        if (!mounted) return
        setMarketsError(e?.message || 'Failed to load markets')
      } finally {
        if (mounted) setMarketsLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  async function load() {
    setError(null)
    try {
      setLoading(true)
      const params = {}
      if (selectedMarket) { params.market = selectedMarket; params.lastId = '0'; params.country = 'Kenya' }
      const { items: first, nextCursor } = await fetchMarketPrices(params)
      const unique = dedupAppend([], first, seenIdsRef.current)
      setItems(unique)
      setCursor(nextCursor)
      setHasMore(Boolean(nextCursor) && first.length > 0)
    } catch (e) {
      setError(e?.message || 'Failed to load prices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMarket])

  // Live search effect (debounced)
  useEffect(() => {
    let active = true
    const run = async () => {
      const text = (debouncedQ || '').trim()
      if (!text) {
        setSearching(false)
        setSearchResults([])
        return
      }
      setSearching(true)
      try {
        const results = await searchMarketProducts(text)
        if (!active) return
        setSearchResults(results)
      } catch (_e) {
        if (!active) return
        setSearchResults([])
      } finally {
        if (active) setSearching(false)
      }
    }
    run()
    return () => { active = false }
  }, [debouncedQ])

  const isSearchMode = debouncedQ.trim().length > 0
  const filtered = useMemo(() => {
    if (isSearchMode) return uniqByComposite(searchResults)
    const term = q.trim().toLowerCase()
    if (!term) return items
    return uniqByComposite(items.filter(i => (i.title || '').toLowerCase().includes(term) || (i.market || '').toLowerCase().includes(term) || (i.county || '').toLowerCase().includes(term)))
  }, [q, items, isSearchMode, searchResults])

  const renderItem = useCallback(({ item }) => (
    <MarketPriceCard
      item={item}
      onPress={() => {
        const slug = item.slug
        const title = item.title
        const icon = item.icon
        const market = item.market || selectedMarket || ''
        router.push({ pathname: '/market-prices/detail', params: { slug, title, icon, market } })
      }}
    />
  ), [router, selectedMarket])
  const keyExtractor = useCallback((i, idx) => `${String(i.id)}:${String(i.market || '')}:${idx}`, [])

  async function loadMoreSequential() {
    if (isLoadingMore || !hasMore) return
    setIsLoadingMore(true)
    try {
      // Sequentially fetch pages until we add at least 1 new unique item or run out
      let next = cursor
      let localItems = items
      let loops = 0
      let nextCursorLocal = next
      const MAX_LOOPS = 5
      while (loops < MAX_LOOPS && nextCursorLocal !== null) {
  const params = next ? { lastId: next } : {}
  if (selectedMarket) { params.market = selectedMarket; params.country = 'Kenya' }
        const { items: page, nextCursor } = await fetchMarketPrices(params)
        const before = localItems.length
        localItems = dedupAppend(localItems, page, seenIdsRef.current)
        const added = localItems.length - before
        next = nextCursor
        nextCursorLocal = nextCursor
        loops += 1
        if (added > 0 || !nextCursor) break
      }
      setItems(localItems)
      setCursor(next)
      setHasMore(Boolean(next))
    } catch (e) {
      setError(e?.message || 'Failed to load more')
    } finally {
      setIsLoadingMore(false)
    }
  }

  async function openMarkets() {
    // If we already prefetched markets show immediately, otherwise fetch first
    setMarketsOpen(true)
    if (markets.length > 0) return
    setMarketsLoading(true)
    setMarketsError(null)
    try {
      const data = await fetchMarkets()
      setMarkets(data)
    } catch (e) {
      setMarketsError(e?.message || 'Failed to load markets')
    } finally {
      setMarketsLoading(false)
    }
  }

  function dedupAppend(existing, incoming, seen) {
    const out = existing.slice()
    for (const it of incoming || []) {
      const id = String(it.id)
      const mk = String(it.market || '')
      const key = `${id}::${mk}`
      if (!seen.has(key)) {
        seen.add(key)
        out.push(it)
      }
    }
    return out
  }
  function uniqByComposite(arr) {
    const seen = new Set()
    const out = []
    for (const it of arr || []) {
      const k = `${String(it.id)}::${String(it.market || '')}`
      if (!seen.has(k)) { seen.add(k); out.push(it) }
    }
    return out
  }

  function filterMarkets(list, q) {
    const term = (q || '').trim().toLowerCase()
    if (!term) return list
    return list.filter(m =>
      (m.name || '').toLowerCase().includes(term) ||
      (m.county || '').toLowerCase().includes(term)
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      <View style={s.topBar}>
        <Text style={s.title}>Market Prices</Text>
        <View style={s.searchRow}>
          <TextInput
            placeholder={selectedMarket ? `Search (filter: ${selectedMarket})` : "Search commodity / market / county"}
            value={q}
            onChangeText={setQ}
            style={s.search}
            placeholderTextColor="#94a3b8"
          />
          <TouchableOpacity onPress={openMarkets} activeOpacity={0.8} style={s.storeBtn}>
            <Ionicons name="storefront" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {selectedMarket ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderBottomColor: '#e5e7eb', borderBottomWidth: StyleSheet.hairlineWidth }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '800', color: '#0f172a' }}>Products in {selectedMarket}</Text>
            <TouchableOpacity onPress={() => { setSelectedMarket(null); setCursor(null); seenIdsRef.current = new Set(); }}>
              <Text style={{ color: '#f97316', fontWeight: '700' }}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" /></View>
      ) : error ? (
        <View style={s.center}><Text style={{ color: '#991b1b' }}>{error}</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={{ padding: 12 }}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={loading && !isSearchMode} onRefresh={load} />}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (isSearchMode) return
            if (!loading && !isLoadingMore && hasMore) {
              loadMoreSequential()
            }
          }}
          windowSize={7}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={12}
          scrollEventThrottle={16}
          ListFooterComponent={
            searching ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" />
              </View>
            ) : isSearchMode ? null : isLoadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            isSearchMode && !searching
              ? <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 20 }}>No products found for your search.</Text>
              : <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 20 }}>No results</Text>
          }
        />
      )}
      {/* Markets Filter Panel */}
      <Modal visible={marketsOpen} animationType="slide" transparent onRequestClose={() => setMarketsOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="filter" size={18} color="#0f172a" />
                <Text style={s.modalTitle}> Filter Markets</Text>
              </View>
              <TouchableOpacity onPress={() => setMarketsOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
              <TextInput
                placeholder="Search markets..."
                value={marketsQ}
                onChangeText={setMarketsQ}
                style={s.marketSearch}
                placeholderTextColor="#94a3b8"
              />
            </View>

            {marketsLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: '#64748b' }}>Loading markets...</Text>
              </View>
            ) : marketsError ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#991b1b' }}>{marketsError}</Text>
              </View>
            ) : (
              <FlatList
                data={filterMarkets(markets, marketsQ)}
                keyExtractor={(m, i) => `${m.name}:${m.county}:${i}`}
                ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#e5e7eb', marginLeft: 12 }} />}
                ListHeaderComponent={null}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setSelectedMarket(`${item.name}`); setMarketsOpen(false); setCursor(null); seenIdsRef.current = new Set(); }}
                    style={s.marketRow}
                  >
                    <Text style={s.marketText}>{item.name}{item.county ? ` (${item.county})` : ''}</Text>
                    {item.featured ? <Ionicons name="star" size={16} color="#f97316" /> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#64748b', padding: 16 }}>No markets found</Text>}
                contentContainerStyle={{ paddingBottom: 10 }}
                keyboardShouldPersistTaps="handled"
                style={{ flex: 1 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  topBar: { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  search: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, height: 40, backgroundColor: '#f8fafc', color: '#0f172a' },
  storeBtn: { marginLeft: 10, width: 40, height: 40, backgroundColor: '#f97316', borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', paddingTop: 50 },
  modalSheet: { height: '75%', width: '100%', backgroundColor: '#fff', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginLeft: 6 },
  marketSearch: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, height: 40, backgroundColor: '#f8fafc', color: '#0f172a' },
  marketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12 },
  marketText: { fontSize: 16, color: '#0f172a' },
})
