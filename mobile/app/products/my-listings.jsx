import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, ScrollView, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getJSON, patchJSON, deleteJSON } from '../../context/api'
import { emitAppEvent, subscribeAppEvents } from '../../context/favorites'
import { useProfile } from '../../context/profile'
import EmptyState from '../../components/EmptyState'
import { router } from 'expo-router'
import BlurhashImage from '../../components/BlurhashImage'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import { myListingsStyles as styles } from '../../assets/styles/listings.styles'

export default function MyListings() {
	const { profile } = useProfile()
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const [error, setError] = useState('')
	const [items, setItems] = useState([])
	const [nextCursor, setNextCursor] = useState(null)
	const [hasMore, setHasMore] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const [sortKey, setSortKey] = useState('newest') // newest | price-asc | price-desc | qty-desc
	const [selectionMode, setSelectionMode] = useState(false)
	const [selected, setSelected] = useState(new Set())
	const [loadingBulk, setLoadingBulk] = useState(false)
	const prefsSaveTimer = useRef(null)
	const [query, setQuery] = useState('')
	const [activeFilter, setActiveFilter] = useState('all') // all | in-stock | discounted | low-stock

	const load = useCallback(async ({ reset = false } = {}) => {
		if (!profile?.id) return
		if (reset) {
			setNextCursor(null)
			setHasMore(true)
			setItems([])
		}
		if (reset) setLoading(true)
		setError('')
		try {
			const cursorParam = reset || !nextCursor ? '' : `&cursor=${encodeURIComponent(nextCursor)}`
			const res = await getJSON(`/api/products?limit=50${cursorParam}`)
			const payloadItems = Array.isArray(res) ? res : (Array.isArray(res.items) ? res.items : [])
			const fetchedNextCursor = res?.nextCursor || null
			// Filter to farmer owned
			const mine = payloadItems.filter(p => p.farmerId === profile.id)
			setItems(prev => {
				if (reset) return mine
				// de-dupe by id
				const map = new Map()
				;[...prev, ...mine].forEach(p => { map.set(p.id, p) })
				return Array.from(map.values())
			})
			setNextCursor(fetchedNextCursor)
			if (!fetchedNextCursor || payloadItems.length === 0) setHasMore(false)
		} catch (_e) {
			setError(_e?.message || 'Failed to load listings')
			setHasMore(false)
		} finally {
			if (reset) setLoading(false)
			setLoadingMore(false)
		}
	}, [profile?.id, nextCursor])

	useEffect(() => { load({ reset: true }) }, [load])

	// Insert newly created product instantly if it belongs to current farmer
	useEffect(() => {
		const unsub = subscribeAppEvents(evt => {
			if (evt.type !== 'product:created') return
			const { productId, product } = evt.payload || {}
			const id = productId || product?.id
			if (!id) return
			// Only handle if owned by this farmer
			const ownerId = product?.farmerId
			if (profile?.id && ownerId && ownerId !== profile.id) return
			if (product && (!ownerId || ownerId === profile?.id)) {
				setItems(prev => {
					if (prev.some(p => p.id === id)) return prev
					return [product, ...prev]
				})
			} else if (id) {
				// If no snapshot, fallback to loading latest page and filtering (simple and robust)
				load({ reset: true })
			}
		})
		return () => { unsub && unsub() }
	}, [profile?.id, load])

	const onRefresh = useCallback(async () => {
		setRefreshing(true)
		try { await load({ reset: true }) } finally { setRefreshing(false) }
	}, [load])

	const loadMore = useCallback(async () => {
		if (loadingMore || loading || !hasMore) return
		setLoadingMore(true)
		await load({ reset: false })
	}, [loadingMore, loading, hasMore, load])

	const filteredItems = useMemo(() => {
		let list = items
		if (query.trim()) {
			const q = query.trim().toLowerCase()
			list = list.filter(i => (i.title || '').toLowerCase().includes(q))
		}
		if (activeFilter === 'in-stock') list = list.filter(i => i.quantityAvailable > 0)
		else if (activeFilter === 'discounted') list = list.filter(i => i.discountPercent > 0)
		else if (activeFilter === 'low-stock') list = list.filter(i => i.quantityAvailable > 0 && i.quantityAvailable <= 10)
		return list
	}, [items, query, activeFilter])

	const sortedItems = useMemo(() => {
		const arr = [...filteredItems]
		switch (sortKey) {
			case 'price-asc':
				arr.sort((a,b) => Number(a.price) - Number(b.price))
				break
			case 'price-desc':
				arr.sort((a,b) => Number(b.price) - Number(a.price))
				break
			case 'qty-desc':
				arr.sort((a,b) => b.quantityAvailable - a.quantityAvailable)
				break
			case 'newest':
			default:
				arr.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
		}
		return arr
	}, [filteredItems, sortKey])

	// Persist preferences (query, filter, sort)
	useEffect(() => {
		(async () => {
			try {
				const raw = await AsyncStorage.getItem('myListingsPrefs')
				if (raw) {
					const prefs = JSON.parse(raw)
					if (typeof prefs.query === 'string') setQuery(prefs.query)
					if (typeof prefs.activeFilter === 'string') setActiveFilter(prefs.activeFilter)
					if (typeof prefs.sortKey === 'string') setSortKey(prefs.sortKey)
				}
			} catch {}
		})()
	}, [])

	useEffect(() => {
		if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current)
		prefsSaveTimer.current = setTimeout(() => {
			AsyncStorage.setItem('myListingsPrefs', JSON.stringify({ query, activeFilter, sortKey })).catch(() => {})
		}, 400)
		return () => { if (prefsSaveTimer.current) clearTimeout(prefsSaveTimer.current) }
	}, [query, activeFilter, sortKey])

	const toggleSelectionMode = useCallback(() => {
		setSelectionMode(m => {
			if (m) setSelected(new Set())
			return !m
		})
	}, [])

	const toggleSelect = useCallback((id) => {
		setSelected(prev => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}, [])

	const bulkHide = useCallback(async () => {
		if (selected.size === 0 || loadingBulk) return
		setLoadingBulk(true)
		try {
			const ids = Array.from(selected)
			// Limit concurrency to 4
			const queue = [...ids]
			const workers = Array.from({ length: Math.min(4, queue.length) }, () => (async () => {
				while (queue.length) {
					const id = queue.shift()
					try { await patchJSON(`/api/products/${id}`, { status: 'inactive' }) } catch {}
				}
			})())
			await Promise.all(workers)
			setItems(prev => prev.filter(p => !selected.has(p.id)))
			setSelected(new Set())
			setSelectionMode(false)
		} finally {
			setLoadingBulk(false)
		}
	}, [selected, loadingBulk])

	const deleteListing = useCallback(async (id) => {
		try {
			await deleteJSON(`/api/products/${id}`)
			setItems(prev => prev.filter(p => p.id !== id))
			emitAppEvent('product:deleted', { productId: id })
		} catch (_e) {
			if (_e?.status === 409) {
				Alert.alert('Cannot delete', 'This product has existing orders and cannot be permanently deleted.')
			} else if (_e?.status === 404) {
				setItems(prev => prev.filter(p => p.id !== id))
			} else {
				Alert.alert('Delete failed', _e?.message || 'Unexpected error')
			}
		}
	}, [])

	const confirmDelete = useCallback((id, title) => {
		Alert.alert(
			'Delete listing',
			`Delete "${title || 'this listing'}"?\nThis will hide it from buyers (soft delete).`,
			[
				{ text: 'Cancel', style: 'cancel' },
				{ text: 'Delete', style: 'destructive', onPress: () => deleteListing(id) }
			]
		)
	}, [deleteListing])

	function ResolvedThumb({ uri, blurhash, style }) {
		const [resolved] = useResolvedUrls(uri ? [uri] : [])
		return <BlurhashImage uri={resolved || uri} blurhash={blurhash} style={style} />
	}

	const renderItem = ({ item }) => {
		const outOfStock = item.quantityAvailable <= 0
		const discounted = item.discountPercent > 0
		const recentlyEdited = item.updatedAt && (new Date(item.updatedAt) - new Date(item.createdAt) > 5000) && (Date.now() - new Date(item.updatedAt).getTime() < 10 * 60 * 1000)
		const isSelected = selected.has(item.id)
		return (
			<TouchableOpacity
				style={[styles.card, isSelected && styles.cardSelected]}
				activeOpacity={0.85}
				onPress={() => selectionMode ? toggleSelect(item.id) : router.push(`/products/${item.id}`)}
				onLongPress={() => { if (!selectionMode) { setSelectionMode(true); toggleSelect(item.id) } }}
			>
				<View style={styles.imageWrapper}>
					<ResolvedThumb uri={item.images?.[0]} blurhash={item.imageBlurhashes?.[0]} style={styles.image} />
					{discounted && (
						<View style={[styles.badge, styles.badgeDiscount]}>
							<Text style={styles.badgeText}>-{item.discountPercent}%</Text>
						</View>
					)}
					{outOfStock && (
						<View style={[styles.badge, styles.badgeOut]}>
							<Text style={styles.badgeText}>OUT</Text>
						</View>
					)}
					{recentlyEdited && (
						<View style={[styles.badge, styles.badgeEdited]}>
							<Text style={styles.badgeText}>Updated</Text>
						</View>
					)}
					{selectionMode && (
						<View style={[styles.selectOverlay]}>
							<View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
								{isSelected && <Text style={styles.checkboxMark}>✓</Text>}
							</View>
						</View>
					)}
				</View>
				<View style={styles.meta}>
					<Text style={styles.title} numberOfLines={1}>{item.title}</Text>
					<Text style={styles.price}>Ksh {Number(item.price).toFixed(2)}</Text>
					<Text style={[styles.qty, outOfStock && styles.qtyOut]}>Qty: {item.quantityAvailable}</Text>
					<View style={styles.actionsRow}>
						{!selectionMode && (
							<>
								<TouchableOpacity style={styles.smallBtn} onPress={() => router.push(`/products/edit/${item.id}`)}>
									<Text style={styles.smallBtnText}>Edit</Text>
								</TouchableOpacity>
								<TouchableOpacity style={[styles.smallBtn, { backgroundColor:'#fee2e2' }]} onPress={() => confirmDelete(item.id, item.title)}>
									<Text style={[styles.smallBtnText, { color:'#b91c1c' }]}>Delete</Text>
								</TouchableOpacity>
							</>
						)}
					</View>
				</View>
			</TouchableOpacity>
		)
	}

	if (loading) {
		return <View style={styles.center}><ActivityIndicator /><Text style={styles.loadingTxt}>Loading listings…</Text></View>
	}
	if (error) {
		return <View style={styles.center}><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={load} style={styles.retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>
	}

	const showEmptyBase = items.length === 0
	const showNoMatches = !showEmptyBase && sortedItems.length === 0
	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => router.back()}><Text style={styles.back}>{'<'} Back</Text></TouchableOpacity>
				<Text style={styles.headerTitle}>My Listings</Text>
				<View style={styles.headerActions}>
					<TouchableOpacity onPress={toggleSelectionMode} style={styles.headerBtn} activeOpacity={0.7}>
						<Text style={styles.headerBtnText}>{selectionMode ? `Done (${selected.size})` : 'Select'}</Text>
					</TouchableOpacity>
				</View>
			</View>
			<View style={styles.searchBarWrapper}>
				<TextInput
					value={query}
					onChangeText={setQuery}
					placeholder="Search listings..."
					placeholderTextColor="#9ca3af"
					style={styles.searchInput}
					returnKeyType="search"
				/>
			</View>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
				{[
					{ key: 'all', label: 'All' },
					{ key: 'in-stock', label: 'In Stock' },
					{ key: 'discounted', label: 'Discounted' },
					{ key: 'low-stock', label: 'Low Stock' },
				].map(f => (
					<TouchableOpacity
						key={f.key}
						style={[styles.filterChip, activeFilter === f.key && styles.filterChipActive]}
						onPress={() => setActiveFilter(f.key)}
						activeOpacity={0.75}
					>
						<Text style={[styles.filterChipText, activeFilter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortScroll} contentContainerStyle={styles.sortRow}>
				{[
					{ key: 'newest', label: 'Newest' },
					{ key: 'price-asc', label: 'Price ↑' },
					{ key: 'price-desc', label: 'Price ↓' },
					{ key: 'qty-desc', label: 'Qty' },
				].map(s => (
					<TouchableOpacity
						key={s.key}
						style={[styles.sortChip, sortKey === s.key && styles.sortChipActive]}
						onPress={() => setSortKey(s.key)}
						activeOpacity={0.75}
					>
						<Text style={[styles.sortChipText, sortKey === s.key && styles.sortChipTextActive]}>{s.label}</Text>
					</TouchableOpacity>
				))}
			</ScrollView>
			<FlatList
				data={sortedItems}
				keyExtractor={i => String(i.id)}
				contentContainerStyle={(showEmptyBase || showNoMatches) && { flexGrow: 1, justifyContent:'center', alignItems:'center', paddingHorizontal:16 }}
				renderItem={renderItem}
				refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
				ListEmptyComponent={showEmptyBase ? (
					<View style={{ paddingHorizontal:16, paddingTop: 12 }}>
						<EmptyState context="listings" />
					</View>
				) : (
					<Text style={styles.empty}>No matches – adjust your filters.</Text>
				)}
				onEndReachedThreshold={0.4}
				onEndReached={() => loadMore()}
				ListFooterComponent={loadingMore ? <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View> : null}
			/>
			<TouchableOpacity style={styles.fab} onPress={() => router.push('/products/post-listing')} activeOpacity={0.85}>
				<Text style={styles.fabText}>＋</Text>
			</TouchableOpacity>
			{selectionMode && (
				<View style={styles.bulkBar}>
					<TouchableOpacity style={[styles.bulkBtn, styles.bulkCancel]} onPress={toggleSelectionMode} activeOpacity={0.7}>
						<Text style={styles.bulkCancelText}>Cancel</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.bulkBtn, selected.size === 0 && { opacity: 0.5 }, loadingBulk && { opacity: 0.5 }]}
						disabled={selected.size === 0 || loadingBulk}
						onPress={bulkHide}
						activeOpacity={0.75}
					>
						<Text style={styles.bulkBtnText}>{loadingBulk ? 'Hiding…' : `Hide (${selected.size})`}</Text>
					</TouchableOpacity>
				</View>
			)}
		</View>
	)
}

