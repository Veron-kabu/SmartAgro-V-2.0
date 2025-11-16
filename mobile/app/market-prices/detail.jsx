// CLEAN REACT NATIVE DETAIL SCREEN
import { useEffect, useMemo, useState, useCallback } from 'react'
import { View, Text, Image, FlatList, ActivityIndicator, TouchableOpacity, Share, ScrollView, TextInput } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { fetchMarkets } from '../../utils/markets'
import { marketStyles as s } from '../../assets/styles/market-prices.styles'
import { COLORS } from '../../constants/colors'

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
    const [marketsQ, setMarketsQ] = useState('')
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
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <Text numberOfLines={1} style={s.detailTitle}>{productTitle || 'Product'}</Text>
                <View style={s.headerSpacer} />
            </View>

                <View style={s.hero}>
                {icon ? <Image source={{ uri: icon }} style={s.heroImg} /> : null}
                <View style={s.heroContent}>
                    <Text style={s.heroTitle}>{productTitle || 'Product'}</Text>
                    <Text style={s.heroMarketText}>Prices in {productCountry || 'Kenya'}</Text>
                    {lastUpdated ? <Text style={s.heroUpdatedLeft}>Updated {lastUpdated}</Text> : null}
                </View>
            </View>

            <View style={s.actionsRow}>
                <TouchableOpacity onPress={() => setMarketsOpen(true)} style={s.action} accessibilityLabel="Change Market">
                    <Ionicons name="storefront" size={16} color={COLORS.primary} />
                    <Text style={s.actionText}>{market ? market : 'Select market'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onShare} style={s.circleBtn} accessibilityLabel="Share">
                    <Ionicons name="share-social-outline" size={18} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={s.center}><ActivityIndicator size="large" /></View>
            ) : !latest ? (
                <View style={s.empty}><Text style={s.emptyText}>No current price information for this market.</Text></View>
            ) : (
                <ScrollView style={s.scrollFlex} contentContainerStyle={s.contentContainer}>
                    <View style={s.contentPadding}>
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
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setTab('history')} style={[s.tabBtn, tab==='history' && s.tabActive]}>
                                <Text style={[s.tabText, tab==='history' && s.tabTextActive]}>Price History</Text>
                            </TouchableOpacity>
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setTab('other')} style={[s.tabBtn, tab==='other' && s.tabActive]}>
                                <Text style={[s.tabText, tab==='other' && s.tabTextActive]}>Other Markets</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.zoomRow}>
                            <Text style={s.zoomLabel}>Zoom</Text>
                            <View style={s.zoomBtns}>
                                <TouchableOpacity onPress={zoomOut} style={s.zoomBtn}>
                                    <Ionicons name="remove" size={16} color={COLORS.primary} />
                                </TouchableOpacity>
                                <Text style={s.zoomPct}>{Math.round(fontScale * 100)}%</Text>
                                <TouchableOpacity onPress={zoomIn} style={s.zoomBtn}>
                                    <Ionicons name="add" size={16} color={COLORS.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

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
                                    <View key={`${row.price_date}:${row.market || ''}:${i}`} style={[s.tableRow, { minWidth: tableWidth, marginHorizontal: 12, backgroundColor: (i % 2 === 1) ? s.tableRowAlt.backgroundColor : s.tableRow.backgroundColor }]}>
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
                        <FlatList
                            data={markets}
                            keyExtractor={(m, i) => `${m.name}:${m.county}:${i}`}
                            ItemSeparatorComponent={() => <View style={s.itemSeparator} />}
                            renderItem={({ item: m }) => (
                                <TouchableOpacity style={s.marketRow} onPress={() => { setMarket(m.name); setMarketsOpen(false) }}>
                                    <Text style={s.marketText}>{m.name}{m.county ? ` (${m.county})` : ''}</Text>
                                    {m.featured ? <Ionicons name="star" size={16} color={COLORS.warning} /> : null}
                                </TouchableOpacity>
                            )}
                            style={s.marketListMaxHeight}
                        />
                    </View>
                </View>
            ) : null}
        </View>
    )
}

function ChangeBadge({ value }) {
    if (value == null) return <View style={s.badgeNeutral}><Text style={s.badgeTextNeutral}>0.0%</Text></View>
    const v = Number(value)
    const up = v >= 0
    const icon = up ? 'arrow-up' : 'arrow-down'
    // color only the arrow icon and the percentage/text (green for up, red for down)
    const textColor = up ? '#065f46' : '#991b1b'
    return (
        <View style={s.badge}> 
            <Ionicons name={icon} size={12} color={textColor} />
            <Text style={[s.badgeText, { color: textColor }]}>{Math.abs(v).toFixed(1)}%</Text>
        </View>
    )
}

function fmt(n) { return n == null ? '0.00' : Number(n).toFixed(2) }

// styling now comes from ../../assets/styles/market-prices.styles.js
