 

// CLEAN REACT NATIVE DETAIL SCREEN (replaces corrupted content below)
import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, Image, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Share, ScrollView } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { fetchMarkets } from '../../utils/markets'

const BASE = 'https://sokisho.com'

export default function MarketPriceDetail() {
    const { slug, title, icon, market: initialMarket } = useLocalSearchParams()
    const router = useRouter()

    const [market, setMarket] = useState(String(initialMarket || ''))
    const [latest, setLatest] = useState(null)
    const [changes, setChanges] = useState({ wholesale_change: 0, retail_change: 0 })
    const [lastUpdated, setLastUpdated] = useState('')
    const [productCountry, setProductCountry] = useState('')
    const [history, setHistory] = useState([])
    const [otherMarkets, setOtherMarkets] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('history')
    const [marketsOpen, setMarketsOpen] = useState(false)
    const [markets, setMarkets] = useState([])
    // Zoom for table text
    const [fontScale, setFontScale] = useState(0.85)
    const COLW = useMemo(() => ({ date: 110, num: 120, unit: 90, supply: 130, market: 160, county: 140 }), [])
    const widthScale = useMemo(() => Math.max(0.8, Math.min(1.6, fontScale)), [fontScale])
    const tableBaseWidth = useMemo(() => COLW.date + COLW.num * 2 + COLW.unit + COLW.supply + COLW.market + COLW.county, [COLW])
    const tableWidth = useMemo(() => Math.round(tableBaseWidth * widthScale), [tableBaseWidth, widthScale])
    const zoomIn = useCallback(() => setFontScale(f => Math.min(1.5, +(f + 0.1).toFixed(2))), [])
    const zoomOut = useCallback(() => setFontScale(f => Math.max(0.6, +(f - 0.1).toFixed(2))), [])

    const productTitle = String(title || '').trim()

    useEffect(() => {
        let mounted = true
        ;(async () => {
            try {
                const data = await fetchMarkets()
                if (!mounted) return
                setMarkets(data)
            } catch (_) {}
        })()
        return () => { mounted = false }
    }, [])

    useEffect(() => {
        if (!slug) return
        let active = true
        setLoading(true)
        ;(async () => {
            try {
                const usp = new URLSearchParams()
                usp.set('slug', String(slug))
                if (market) usp.set('market', String(market))
                usp.set('limit', '30')
                const url = `${BASE}/ajax_price_data.php?${usp.toString()}`
                const res = await fetch(url)
                const data = await res.json()
                if (!active) return
                setLatest(data.latest_price || null)
                setChanges({ wholesale_change: data.wholesale_change || 0, retail_change: data.retail_change || 0 })
                setHistory(Array.isArray(data.price_history) ? data.price_history : [])
                setProductCountry(data.product_country || '')
                setLastUpdated(data.last_update || '')
            } catch (_) {
                if (!active) return
                setLatest(null)
                setHistory([])
            } finally {
                if (active) setLoading(false)
            }
        })()

        ;(async () => {
            try {
                const usp = new URLSearchParams()
                usp.set('slug', String(slug))
                usp.set('all_markets', 'true')
                usp.set('limit', '30')
                const url = `${BASE}/ajax_price_data.php?${usp.toString()}`
                const res = await fetch(url)
                const data = await res.json()
                if (!active) return
                setOtherMarkets(Array.isArray(data.price_history) ? data.price_history : [])
            } catch (_) {}
        })()

        return () => { active = false }
    }, [slug, market])

    const shareLink = useMemo(() => `${BASE}/${slug}`, [slug])
    const onShare = useCallback(async () => {
        try {
            await Share.share({ message: `${productTitle || 'Sokisho product'} — ${shareLink}` })
        } catch (_) {}
    }, [productTitle, shareLink])

    return (
        <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color="#0f172a" />
                </TouchableOpacity>
                <Text numberOfLines={1} style={s.title}>{productTitle || 'Product'}</Text>
                <View style={{ width: 36 }} />
            </View>

            <View style={s.hero}>
                {icon ? <Image source={{ uri: icon }} style={s.heroImg} /> : null}
                <View style={{ flex: 1 }}>
                    <Text style={s.heroTitle}>{productTitle || 'Product'}</Text>
                    <Text style={s.heroMeta}>Prices in {productCountry || 'Kenya'} {lastUpdated ? `· Updated ${lastUpdated}` : ''}</Text>
                </View>
            </View>

            <View style={s.actionsRow}>
                <TouchableOpacity onPress={() => setMarketsOpen(true)} style={s.action} accessibilityLabel="Change Market">
                    <Ionicons name="storefront" size={16} color="#0f172a" />
                    <Text style={s.actionText}>{market ? market : 'Select market'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onShare} style={s.action}>
                    <Ionicons name="share-social" size={16} color="#0f172a" />
                    <Text style={s.actionText}>Share</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" /></View>
            ) : !latest ? (
                <View style={s.empty}><Text style={{ color: '#64748b' }}>No current price information for this market.</Text></View>
            ) : (
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
                    <View style={{ paddingHorizontal: 12 }}>
                        <View style={s.grid}>
                            <View style={s.box}>
                                <Text style={s.boxLabel}>Wholesale ({latest.unit || '-'})</Text>
                                <Text style={s.price}>Ksh {fmt(latest.wholesale_price)}</Text>
                                <ChangeBadge value={changes.wholesale_change} />
                            </View>
                            <View style={s.box}>
                                <Text style={s.boxLabel}>Retail ({latest.unit || '-'})</Text>
                                <Text style={s.price}>Ksh {fmt(latest.retail_price)}</Text>
                                <ChangeBadge value={changes.retail_change} />
                            </View>
                        </View>

                        <View style={s.tabs}>
                            <TouchableOpacity onPress={() => setTab('history')} style={[s.tabBtn, tab==='history' && s.tabActive]}>
                                <Text style={[s.tabText, tab==='history' && s.tabTextActive]}>Price History</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setTab('other')} style={[s.tabBtn, tab==='other' && s.tabActive]}>
                                <Text style={[s.tabText, tab==='other' && s.tabTextActive]}>Other Markets</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Zoom controls (table only) */}
                        <View style={s.zoomRow}>
                            <Text style={s.zoomLabel}>Zoom</Text>
                            <View style={s.zoomBtns}>
                                <TouchableOpacity onPress={zoomOut} style={s.zoomBtn}>
                                    <Ionicons name="remove" size={16} color="#0f172a" />
                                </TouchableOpacity>
                                <Text style={s.zoomPct}>{Math.round(fontScale * 100)}%</Text>
                                <TouchableOpacity onPress={zoomIn} style={s.zoomBtn}>
                                    <Ionicons name="add" size={16} color="#0f172a" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Whole table scrolls horizontally together (header + rows) */}
                    {(tab === 'history' ? history : otherMarkets).length === 0 ? (
                        <Text style={[s.emptyText, { paddingHorizontal: 12 }]}>{tab === 'history' ? 'No price history available' : 'No other markets data'}</Text>
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ minWidth: tableWidth }}>
                                <View style={[s.tableHeader, { minWidth: tableWidth, marginHorizontal: 12 }]}>
                                    <Text style={[s.th, s.colDate, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.date * widthScale) }]}>Date</Text>
                                    <Text style={[s.th, s.colNum, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.num * widthScale) }]}>Whole sale</Text>
                                    <Text style={[s.th, s.colNum, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.num * widthScale) }]}>Retail</Text>
                                    <Text style={[s.th, s.colUnit, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.unit * widthScale) }]}>Unit</Text>
                                    <Text style={[s.th, s.colSupply, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.supply * widthScale) }]}>Supply</Text>
                                    <Text style={[s.th, s.colMarket, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.market * widthScale) }]}>Market</Text>
                                    <Text style={[s.th, s.colCounty, { fontSize: Math.round(11 * fontScale), width: Math.round(COLW.county * widthScale) }]}>County</Text>
                                </View>

                                {(tab === 'history' ? history : otherMarkets).map((row, i) => (
                                    <View key={`${row.price_date}:${row.market || ''}:${i}`} style={[s.tableRow, { minWidth: tableWidth, marginHorizontal: 12 }]}> 
                                        <Text style={[s.td, s.colDate, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.date * widthScale) }]} numberOfLines={1}>{row.price_date}</Text>
                                        <Text style={[s.td, s.colNum, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.num * widthScale) }]} numberOfLines={1}>Ksh {fmt(row.wholesale_price)}</Text>
                                        <Text style={[s.td, s.colNum, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.num * widthScale) }]} numberOfLines={1}>Ksh {fmt(row.retail_price)}</Text>
                                        <Text style={[s.td, s.colUnit, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.unit * widthScale) }]} numberOfLines={1}>{row.unit || '-'}</Text>
                                        <Text style={[s.td, s.colSupply, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.supply * widthScale) }]} numberOfLines={1}>{row.supply_volume || '-'}</Text>
                                        <Text style={[s.td, s.colMarket, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.market * widthScale) }]} numberOfLines={1}>{row.market || '-'}</Text>
                                        <Text style={[s.td, s.colCounty, { fontSize: Math.round(12 * fontScale), width: Math.round(COLW.county * widthScale) }]} numberOfLines={1}>{row.county || '-'}</Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    )}
                </ScrollView>
            )}

            {marketsOpen ? (
                <View style={s.sheetOverlay}>
                    <View style={s.sheet}>
                        <View style={s.sheetHeader}>
                            <Text style={s.sheetTitle}>Select Market</Text>
                            <TouchableOpacity onPress={() => setMarketsOpen(false)}>
                                <Ionicons name="close" size={22} color="#0f172a" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={markets}
                            keyExtractor={(m, i) => `${m.name}:${m.county}:${i}`}
                            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#e5e7eb', marginLeft: 12 }} />}
                            renderItem={({ item: m }) => (
                                <TouchableOpacity style={s.marketRow} onPress={() => { setMarket(m.name); setMarketsOpen(false) }}>
                                    <Text style={s.marketText}>{m.name}{m.county ? ` (${m.county})` : ''}</Text>
                                    {m.featured ? <Ionicons name="star" size={16} color="#f97316" /> : null}
                                </TouchableOpacity>
                            )}
                            style={{ maxHeight: '70%' }}
                        />
                    </View>
                </View>
            ) : null}
        </View>
    )
}

function ChangeBadge({ value }) {
    if (value == null) return <View style={s.badgeNeutral}><Text style={s.badgeNeutralText}>0.0%</Text></View>
    const v = Number(value)
    const up = v >= 0
    const color = up ? '#065f46' : '#991b1b'
    const bg = up ? '#d1fae5' : '#fee2e2'
    const icon = up ? 'arrow-up' : 'arrow-down'
    return (
        <View style={[s.badge, { backgroundColor: bg }]}>
            <Ionicons name={icon} size={12} color={color} />
            <Text style={[s.badgeText, { color }]}>{Math.abs(v).toFixed(1)}%</Text>
        </View>
    )
}

function fmt(n) { return n == null ? '0.00' : Number(n).toFixed(2) }

const s = StyleSheet.create({
    header: { paddingTop: 12, paddingHorizontal: 8, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#0f172a' },
    hero: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: '#fff', borderBottomColor: '#e5e7eb', borderBottomWidth: StyleSheet.hairlineWidth, alignItems: 'center' },
    heroImg: { width: 56, height: 56, borderRadius: 12 },
    heroTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    heroMeta: { color: '#64748b', marginTop: 4 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: '#fff', paddingVertical: 10, borderBottomColor: '#e5e7eb', borderBottomWidth: StyleSheet.hairlineWidth },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#f8fafc' },
    actionText: { fontWeight: '700', color: '#0f172a' },
    center: { padding: 20, alignItems: 'center' },
    empty: { padding: 20, alignItems: 'center' },
    emptyText: { textAlign: 'center', color: '#64748b', paddingVertical: 12 },
    grid: { flexDirection: 'row', gap: 10, marginTop: 12 },
    box: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
    boxLabel: { fontSize: 12, color: '#475569', marginBottom: 6 },
    price: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
    badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: '700' },
    badgeNeutral: { alignSelf: 'flex-start', backgroundColor: '#e5e7eb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeNeutralText: { color: '#374151', fontSize: 12, fontWeight: '700' },
    tabs: { flexDirection: 'row', backgroundColor: '#fff', marginTop: 12, borderRadius: 12, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
    tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
    tabActive: { backgroundColor: '#fff7ed' },
    tabText: { color: '#64748b', fontWeight: '700' },
    tabTextActive: { color: '#f97316', fontWeight: '800' },
    row: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
    rowLeft: { width: 88, color: '#0f172a', fontWeight: '700' },
    rowRight: { flex: 1 },
    rowPrice: { color: '#0f172a', fontWeight: '700' },
    rowMeta: { color: '#64748b', marginTop: 4 },
    // Removed more-from-market card styles (no longer used)
    sheetOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-start', paddingTop: 50 },
    sheet: { height: '75%', backgroundColor: '#fff', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
    marketRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 12 },
    marketText: { fontSize: 16, color: '#0f172a' },
        // Table styles
    tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', marginTop: 10 },
        th: { fontSize: 12, fontWeight: '800', color: '#334155' },
    tableRow: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb', marginTop: 6 },
    td: { fontSize: 11, color: '#0f172a' },
        colDate: { flex: 1.1, paddingRight: 6 },
        colNum: { flex: 1, paddingRight: 6 },
        colUnit: { flex: 0.8, paddingRight: 6 },
        colSupply: { flex: 1, paddingRight: 6 },
        colMarket: { flex: 1, paddingRight: 6 },
        colCounty: { flex: 1, paddingRight: 0 },
    // Zoom controls
    zoomRow: { marginTop: 10, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
    zoomLabel: { color: '#64748b', marginRight: 6 },
    zoomBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    zoomBtn: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
    zoomPct: { color: '#0f172a', fontWeight: '700', minWidth: 36, textAlign: 'center' },
})
