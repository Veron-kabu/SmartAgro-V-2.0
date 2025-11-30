import { useEffect, useState, useCallback, useLayoutEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { VictoryPie, VictoryLabel } from 'victory-native'
import { getJSON } from '../../context/api'
import { earningsStyles as styles } from '../../assets/styles/dashboard.styles'
// import { router } from 'expo-router'
import { COLORS } from '../../constants/colors'
import LoadingSpinner from '../../components/LoadingSpinner'

// Simple in-memory cache (resets on app reload)
const earningsCache = { data: null, fetchedAt: 0 }
const STALE_MS = 5 * 1000 // 5 seconds for fresher "current" data

export default function EarningsScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  // const [totals, setTotals] = useState({ delivered: 0, paid: 0, revenue: 0 })
  const [recentPaid, setRecentPaid] = useState([])
  const [selectedSlice, setSelectedSlice] = useState(null)

  const fetchEarnings = useCallback(async (force=false) => {
    try {
      setError(null)
      const now = Date.now()
      if (!force && earningsCache.data && (now - earningsCache.fetchedAt) < STALE_MS) {
        setSummary(earningsCache.data)
        setLoading(false)
        return
      }
      const data = await getJSON(`/api/earnings/farmer/summary`)
      earningsCache.data = data
      earningsCache.fetchedAt = now
      setSummary(data)
    } catch (e) {
      setError(e?.message || 'Failed to load earnings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEarnings() }, [fetchEarnings])

  const router = useRouter()
  const navigation = useNavigation()

  useLayoutEffect(() => {
    try { navigation.setOptions({ headerShown: false }) } catch (_e) {}
  }, [navigation])

  // Fetch transactions (orders for this farmer) for recent paid list
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getJSON('/api/orders?farmer=me&limit=100')
        if (cancelled) return
        const items = Array.isArray(data?.items) ? data.items : []
        const paidRows = items.filter(o => ['paid','shipped','delivered'].includes(String(o.status||'').toLowerCase()))
        // Use summary for totals; only recent list here
  // totals handled by summary
        // Recent paid transactions (limit 10, newest first)
        paidRows.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
        setRecentPaid(paidRows.slice(0, 10))
      } catch {
  // totals handled by summary
        setRecentPaid([])
      }
    })()
    return () => { cancelled = true }
  }, [summary])

  const formatCurrency = useCallback((v) => {
    const num = Number(v||0)
    return `Ksh ${num.toLocaleString('en-KE',{maximumFractionDigits:2})}`
  }, [])

  if (loading) return <LoadingSpinner message="Loading earnings..." />
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchEarnings(true) }}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  )

  // const listings = summary?.listings || []
  const totalDeliveredUnits = (summary?.listings || []).reduce((acc, l) => acc + Number(l?.deliveredQuantity || 0), 0)
  const screenWidth = Dimensions.get('window').width || 360
  // Use most of the horizontal space and ensure a sensible minimum
  const pieWidth = Math.max(340, screenWidth - 64)
  const pieData = (summary?.listings || []).map(l => ({ x: l.title || 'Item', y: Number(l.revenue || 0) }))
  const pieTotal = pieData.reduce((s, it) => s + (Number(it.y) || 0), 0)
  const pieColors = ["#10b981", "#EF4444", "#F59E0B", "#60A5FA", "#FB7185", "#34D399", "#8B5CF6", "#F472B6"]
  const pieRadius = Math.min(pieWidth, 320) / 2
  // Move labels slightly inward so percentages sit closer to the pie center
  const labelRadius = Math.max(20, Math.floor(pieRadius - 90))

  return (
      <ScrollView style={{ flex: 1, backgroundColor: '#10b981' }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero summary wrapper: green background with white inner card */}
        <View style={{ backgroundColor: '#10b981', paddingHorizontal: 16, paddingBottom: 16, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={[{ fontSize: 18, fontWeight: '800', color: '#fff', textAlign: 'center', flex: 1 }]}>Earnings</Text>
          <TouchableOpacity onPress={() => {}} style={{ padding: 4 }}>
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.heroCard, { backgroundColor: '#fff', borderColor: 'rgba(0,0,0,0.04)', padding: 14, elevation: 2, shadowOpacity: 0.04, shadowRadius: 4 }] }>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: '#6b7280', fontSize: 12, fontWeight: '700' }}>Total Revenue</Text>
              <Text style={{ color: '#111827', fontSize: 28, fontWeight: '900', marginTop: 6 }}>{formatCurrency(summary?.totalRevenue)}</Text>
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width:8, height:8, borderRadius:4, backgroundColor: '#10b981', marginRight:8 }} />
                  <Text style={{ color: '#10b981', fontSize: 12 }}>Paid</Text>
                </View>
              </View>
            </View>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="wallet" size={20} color="#10b981" />
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: 'rgba(0,0,0,0.04)', marginVertical: 12 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>Delivered Units</Text>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', marginTop: 6 }}>{totalDeliveredUnits}</Text>
            </View>
            <View style={{ width: 1, height: 40, backgroundColor: 'rgba(0,0,0,0.04)', marginHorizontal: 12 }} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '700' }}>Products</Text>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', marginTop: 6 }}>{(summary?.listings || []).length}</Text>
            </View>
          </View>
        </View>
        </View>

        {/* Main content container with page background */}
        <View style={{ backgroundColor: COLORS.background, padding: 16 }}>

        {/* Revenue Distribution */}
        <Text style={styles.sectionHeading}>Revenue Distribution</Text>
        <View style={{ backgroundColor: COLORS.card, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, alignItems: 'center' }}>
        {(!pieData || pieData.length === 0 || pieData.every(d => d.y === 0)) ? (
          <Text style={styles.muted}>No revenue distribution data</Text>
        ) : (
          <>
          <VictoryPie
            width={pieWidth}
            height={320}
            data={pieData}
            colorScale={pieColors}
            innerRadius={0}
            labelRadius={labelRadius}
            events={[{
              target: 'data',
              eventHandlers: {
                onPressIn: (evt, props) => {
                  try { setSelectedSlice(props.index) } catch {};
                  return []
                },
                onPressOut: () => {
                  try { setSelectedSlice(null) } catch {};
                  return []
                }
              }
            }]}
            style={{
              labels: {
                fontSize: 14,
                fontWeight: '700',
                fill: ({ index }) => (selectedSlice === index ? '#ffffff' : pieColors[index % pieColors.length]),
                stroke: ({ index }) => (selectedSlice === index ? undefined : '#ffffff'),
                strokeWidth: ({ index }) => (selectedSlice === index ? 0 : 1)
              },
              data: {
                stroke: ({ index }) => (index === selectedSlice ? '#ffffff' : undefined),
                strokeWidth: ({ index }) => (index === selectedSlice ? 3 : 0),
              }
            }}
            labels={({ datum, index }) => {
              if (pieTotal <= 0) return ''
              const pct = Math.round((Number(datum.y) / pieTotal) * 100)
              // hide labels for tiny slices (<3%) unless selected
              if (pct < 3 && selectedSlice !== index) return ''
              if (selectedSlice !== null && index === selectedSlice) return formatCurrency(datum.y)
              return `${pct}%`
            }}
            labelComponent={<VictoryLabel />}
          />
          {/* Legend: product color swatch + name + percentage (or absolute when selected) */}
          <View style={{ width: pieWidth, marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {pieData.map((d, i) => {
              const color = pieColors[i % pieColors.length]
              const percent = pieTotal > 0 ? Math.round((Number(d.y) / pieTotal) * 100) : 0
              const isSel = selectedSlice === i
              return (
                <TouchableOpacity key={i} onPress={() => setSelectedSlice(isSel ? null : i)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, margin: 4, backgroundColor: isSel ? '#f3f4f6' : 'transparent', borderRadius: 8 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, marginRight: 8 }} />
                  <View style={{ maxWidth: 140 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: COLORS.text }}>{d.x}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textLight }}>{isSel ? formatCurrency(d.y) : `${percent}%`}</Text>
                  </View>
                </TouchableOpacity>
              )
            })}
          </View>
          </>
        )}
        </View>



        {/* Listings Performance */}
        <Text style={styles.sectionHeading}>Listings Performance</Text>
      {(summary?.listings || []).length === 0 ? (
        <Text style={styles.muted}>No data yet</Text>
      ) : (
        (summary.listings || []).map((listing, idx) => {
          const delivered = Number(listing.deliveredQuantity || 0)
          const paid = Number(listing.paidQuantity || 0)
          const available = listing.availableQuantity == null ? '-' : String(listing.availableQuantity)
          const revenue = Number(listing.revenue || 0)
          const isActive = (listing?.status && String(listing.status).toLowerCase() === 'active') || listing?.active === true || listing?.isActive === true
          const iconBg = idx % 3 === 0 ? '#FFF1F2' : idx % 3 === 1 ? '#ECFDF5' : '#EFF6FF'
          return (
            <View
              key={idx}
              style={{ backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="leaf" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }} numberOfLines={1}>{listing.title}</Text>
                    <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: 6 }}>Revenue: {formatCurrency(revenue)}</Text>
                  </View>
                </View>
                <View style={{ marginLeft: 8 }}>
                  <View style={{ backgroundColor: isActive ? '#DCFCE7' : '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: isActive ? '#047857' : '#6B7280', fontWeight: '700', fontSize: 12 }}>{isActive ? 'Active' : 'Inactive'}</Text>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', marginTop: 12 }}>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingVertical: 12, marginRight: 8 }}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Delivered</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.text, marginTop: 6 }}>{delivered}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: (paid && paid > 0) ? '#ECFDF5' : '#FFFBEB', borderRadius: 10, paddingVertical: 12, marginRight: 8 }}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Paid</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: (paid && paid > 0) ? '#047857' : '#B45309', marginTop: 6 }}>{paid}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 12 }}>
                  <Text style={{ color: COLORS.textLight, fontWeight: '700' }}>Available</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: '#1D4ED8', marginTop: 6 }}>{available}</Text>
                </View>
              </View>
            </View>
          )
        })
      )}

      <Text style={[styles.sectionHeading, { marginTop: 8 }]}>Recent Transactions</Text>
      <View style={{ backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12 }}>
        {recentPaid.length === 0 ? (
          <Text style={[styles.muted,{ marginTop: 6 }]}>No paid transactions yet</Text>
        ) : (
          <View style={{ marginTop: 4 }}>
            {recentPaid.map((o, i) => (
              <View key={o.id || i} style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical: 12, borderTopWidth: i===0?0:1, borderColor: COLORS.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Ionicons name="person" size={20} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }} numberOfLines={1}>{o?.buyer?.fullName || 'Buyer'}</Text>
                    <Text style={{ fontSize: 11, color: COLORS.textLight }} numberOfLines={1}>{o?.product?.title || ''}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.text }}>{formatCurrency(o.totalAmount)}</Text>
                  <Ionicons name="checkmark-circle" size={18} color="#10b981" style={{ marginTop: 6 }} />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
        <View style={{ height: 60 }} />
        </View>
      </ScrollView>
  )
}
