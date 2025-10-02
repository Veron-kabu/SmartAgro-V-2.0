import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput, ScrollView, Alert } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getJSON, patchJSON, deleteJSON } from '../../context/api'
import { emitAppEvent } from '../../context/favorites'
import { useProfile } from '../../context/profile'
import { router } from 'expo-router'
import BlurhashImage from '../../components/BlurhashImage'

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
					<BlurhashImage uri={item.images?.[0]} blurhash={item.imageBlurhashes?.[0]} style={styles.image} />
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
				ListEmptyComponent={<Text style={styles.empty}>{showEmptyBase ? 'No listings yet. Post one!' : 'No matches – adjust your filters.'}</Text>}
				onEndReachedThreshold={0.4}
				onEndReached={() => loadMore()}
				ListFooterComponent={loadingMore ? <View style={{ paddingVertical: 24 }}><ActivityIndicator /></View> : null}
			/>
			<TouchableOpacity style={styles.fab} onPress={() => router.push('/dashboard/post-listing')} activeOpacity={0.85}>
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

const styles = StyleSheet.create({
	container:{ flex:1, backgroundColor:'#f9fafb' },
	header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingTop: 52, paddingHorizontal:16, paddingBottom:12, backgroundColor:'#fff', borderBottomWidth:1, borderColor:'#e5e7eb' },
	headerTitle:{ fontSize:16, fontWeight:'700', color:'#111827' },
	back:{ color:'#111827', fontWeight:'600', fontSize:14 },
	card:{ flexDirection:'row', backgroundColor:'#fff', marginHorizontal:16, marginTop:12, borderRadius:16, overflow:'hidden', elevation:2, borderWidth:1, borderColor:'#e5e7eb' },
	image:{ width:110, height:110, backgroundColor:'#e5e7eb' },
	imageWrapper:{ position:'relative', width:110, height:110 },
	meta:{ flex:1, padding:12 },
	title:{ fontSize:13, fontWeight:'700', color:'#111827' },
	price:{ fontSize:12, fontWeight:'600', color:'#16a34a', marginTop:4 },
	discount:{ fontSize:11, fontWeight:'600', color:'#dc2626' },
	qty:{ fontSize:11, color:'#64748b', marginTop:4 },
	qtyOut:{ color:'#dc2626' },
	actionsRow:{ flexDirection:'row', marginTop:'auto', gap:8 },
	smallBtn:{ backgroundColor:'#f1f5f9', paddingHorizontal:12, paddingVertical:6, borderRadius:14 },
	smallBtnText:{ fontSize:11, fontWeight:'600', color:'#111827' },
	center:{ flex:1, justifyContent:'center', alignItems:'center' },
	loadingTxt:{ marginTop:8, fontSize:12, color:'#6b7280' },
	error:{ color:'#dc2626', fontSize:12 },
	retry:{ marginTop:12, backgroundColor:'#111827', paddingHorizontal:16, paddingVertical:10, borderRadius:24 },
	retryText:{ color:'#fff', fontWeight:'600' },
	empty:{ fontSize:12, color:'#6b7280' },
	fab:{ position:'absolute', right:16, bottom:24, backgroundColor:'#111827', width:52, height:52, borderRadius:26, alignItems:'center', justifyContent:'center', elevation:4 },
	fabText:{ color:'#fff', fontSize:24, fontWeight:'700', marginTop:-2 },
	searchBarWrapper:{ paddingHorizontal:16, paddingTop:12 },
	searchInput:{ backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb', borderRadius:24, paddingHorizontal:16, paddingVertical:10, fontSize:13, color:'#111827' },
	filtersScroll:{ marginTop:8, maxHeight:44 },
	filtersRow:{ paddingHorizontal:12, alignItems:'center' },
	filterChip:{ backgroundColor:'#f1f5f9', paddingHorizontal:14, paddingVertical:8, borderRadius:18, marginHorizontal:4 },
	filterChipActive:{ backgroundColor:'#111827' },
	filterChipText:{ fontSize:12, fontWeight:'600', color:'#374151' },
	filterChipTextActive:{ color:'#fff' },
	sortScroll:{ marginTop:4, maxHeight:40 },
	sortRow:{ paddingHorizontal:12, alignItems:'center' },
	sortChip:{ backgroundColor:'#f3f4f6', paddingHorizontal:14, paddingVertical:6, borderRadius:16, marginHorizontal:4 },
	sortChipActive:{ backgroundColor:'#16a34a' },
	sortChipText:{ fontSize:11, fontWeight:'600', color:'#374151' },
	sortChipTextActive:{ color:'#fff' },
	badge:{ position:'absolute', top:6, left:6, backgroundColor:'#111827', paddingHorizontal:6, paddingVertical:2, borderRadius:12 },
	badgeDiscount:{ backgroundColor:'#16a34a' },
	badgeOut:{ backgroundColor:'#dc2626', top:6, right:6, left:'auto' },
	badgeEdited:{ backgroundColor:'#3b82f6', top:'auto', bottom:6, left:6 },
	badgeText:{ fontSize:10, fontWeight:'700', color:'#fff' },
	headerActions:{ flexDirection:'row', alignItems:'center' },
	headerBtn:{ paddingHorizontal:12, paddingVertical:6, backgroundColor:'#f1f5f9', borderRadius:16 },
	headerBtnText:{ fontSize:12, fontWeight:'600', color:'#111827' },
	selectOverlay:{ position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.15)', justifyContent:'flex-start', alignItems:'flex-end', padding:6 },
	checkbox:{ width:22, height:22, borderRadius:12, borderWidth:2, borderColor:'#fff', backgroundColor:'rgba(255,255,255,0.4)', alignItems:'center', justifyContent:'center' },
	checkboxChecked:{ backgroundColor:'#16a34a', borderColor:'#16a34a' },
	checkboxMark:{ color:'#fff', fontSize:12, fontWeight:'700' },
	cardSelected:{ borderColor:'#16a34a', borderWidth:2 },
	bulkBar:{ position:'absolute', left:0, right:0, bottom:0, flexDirection:'row', padding:12, backgroundColor:'#ffffffee', gap:12, borderTopWidth:1, borderColor:'#e5e7eb' },
	bulkBtn:{ flex:1, backgroundColor:'#16a34a', paddingVertical:12, borderRadius:24, alignItems:'center' },
	bulkBtnText:{ color:'#fff', fontWeight:'700', fontSize:13 },
	bulkCancel:{ backgroundColor:'#f3f4f6' },
	bulkCancelText:{ color:'#111827', fontWeight:'600', fontSize:13 }
})

