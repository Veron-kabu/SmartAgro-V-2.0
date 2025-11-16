import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { View, Text, TextInput, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Modal } from 'react-native'
import MarketPriceCard from '../../components/MarketPriceCard'
import { useRouter } from 'expo-router'
import { fetchMarketPrices } from '../../utils/marketPrices'
import { searchMarketProducts } from '../../utils/marketSearch'
import { useDebounce } from '../../hooks/useDebounce'
import { fetchMarkets } from '../../utils/markets'
import { Ionicons } from '@expo/vector-icons'
import { marketStyles as s } from '../../assets/styles/market-prices.styles'
import { COLORS } from '../../constants/colors'

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
    <View style={s.container}>
      <View style={s.topBar}>
        <Text style={s.titleLarge}>Market Prices</Text>
        <View style={s.searchRow}>
            <TextInput
            placeholder={selectedMarket ? `Search (filter: ${selectedMarket})` : "Search commodity / market / county"}
            value={q}
            onChangeText={setQ}
              style={s.search}
              placeholderTextColor={COLORS.textLight}
          />
          <TouchableOpacity onPress={openMarkets} activeOpacity={0.8} style={s.storeBtn}>
            <Ionicons name="storefront" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {selectedMarket ? (
        <View style={s.selectedMarketBar}>
          <View style={s.selectedMarketRow}>
            <Text style={s.sheetTitle}>Products in {selectedMarket}</Text>
            <TouchableOpacity onPress={() => { setSelectedMarket(null); setCursor(null); seenIdsRef.current = new Set(); }}>
              <Text style={s.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" /></View>
      ) : error ? (
      <View style={s.center}><Text style={{ color: COLORS.error }}>{error}</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          contentContainerStyle={s.listContent}
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
              <View style={s.footerLoader}>
                <ActivityIndicator size="small" />
              </View>
            ) : isSearchMode ? null : isLoadingMore ? (
              <View style={s.footerLoader}>
                <ActivityIndicator size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            isSearchMode && !searching ? <Text style={s.emptyMessage}>No products found for your search.</Text> : null
          }
        />
      )}
      {/* Markets Filter Panel */}
      <Modal visible={marketsOpen} animationType="slide" transparent onRequestClose={() => setMarketsOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
              <View style={s.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="filter" size={18} color={COLORS.primary} />
                <Text style={s.modalTitle}> Filter Markets</Text>
              </View>
              <TouchableOpacity onPress={() => setMarketsOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={s.contentPadding}>
                <TextInput
                placeholder="Search markets..."
                value={marketsQ}
                onChangeText={setMarketsQ}
                style={s.marketSearch}
                  placeholderTextColor={COLORS.textLight}
              />
            </View>

            {marketsLoading ? (
              <View style={s.center}>
                <ActivityIndicator />
                <Text style={s.emptyText}>Loading markets...</Text>
              </View>
            ) : marketsError ? (
              <View style={s.center}>
                <Text style={{ color: COLORS.error }}>{marketsError}</Text>
              </View>
            ) : (
              <FlatList
                data={filterMarkets(markets, marketsQ)}
                keyExtractor={(m, i) => `${m.name}:${m.county}:${i}`}
                ItemSeparatorComponent={() => <View style={s.itemSeparator} />}
                ListHeaderComponent={null}
                renderItem={({ item }) => (
                    <TouchableOpacity
                    onPress={() => { setSelectedMarket(`${item.name}`); setMarketsOpen(false); setCursor(null); seenIdsRef.current = new Set(); }}
                    style={s.marketRow}
                  >
                    <Text style={s.marketText}>{item.name}{item.county ? ` (${item.county})` : ''}</Text>
                    {item.featured ? <Ionicons name="star" size={16} color={COLORS.warning} /> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={s.emptyMessage}>No markets found</Text>}
                contentContainerStyle={s.modalListContent}
                keyboardShouldPersistTaps="handled"
                style={s.scrollFlex}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

// styling moved to ../../assets/styles/market-prices.styles.js
