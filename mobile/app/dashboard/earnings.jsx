import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { getJSON } from '../../context/api'
import { earningsStyles as styles } from '../../assets/styles/dashboard.styles'
// import { router } from 'expo-router'
import SimplePieChart from '../../components/charts/SimplePieChart'
import { COLORS } from '../../constants/colors'

// Simple in-memory cache (resets on app reload)
const earningsCache = { data: null, fetchedAt: 0 }
const STALE_MS = 5 * 1000 // 5 seconds for fresher "current" data

export default function EarningsScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)
  // Listing metrics (for pie charts) and totals for summary card
  const [listingCharts, setListingCharts] = useState([])
  // const [totals, setTotals] = useState({ delivered: 0, paid: 0, revenue: 0 })
  const [recentPaid, setRecentPaid] = useState([])
  const [expanded, setExpanded] = useState(new Set())

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

  // Build listing pie charts when summary changes (use delivered vs paid vs available units)
  useEffect(() => {
    if (!summary) { setListingCharts([]); return }
    const charts = (summary.listings || []).map(l => ({
      title: l.title,
      total: Number(l.revenue || 0),
      data: [ Number(l.deliveredQuantity||0), Number(l.paidQuantity||0), Number(l.availableQuantity||0) ]
    }))
    setListingCharts(charts)
  }, [summary])

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

  if (loading) return <View style={styles.center}><ActivityIndicator size="small"/><Text style={styles.muted}> Loading earnings...</Text></View>
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Earnings Overview</Text>
        <TouchableOpacity onPress={() => fetchEarnings(true)} style={styles.refreshBtn}><Text style={styles.refreshText}>↻</Text></TouchableOpacity>
      </View>
      {/* Hero summary */}
      <View style={styles.heroCard}>
        <Text style={styles.metricLabel}>Total Revenue (paid)</Text>
        <Text style={styles.heroValue}>{formatCurrency(summary?.totalRevenue)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroItem}>
            <Text style={styles.heroLabel}>Delivered units</Text>
            <Text style={styles.heroMetric}>{totalDeliveredUnits}</Text>
          </View>
        </View>
      </View>

      {/* Listings Performance with pie charts */}
      <Text style={styles.sectionHeading}>Listings Performance</Text>
      {listingCharts.length === 0 ? (
        <Text style={styles.muted}>No data yet</Text>
      ) : (
        listingCharts.map((c, idx) => {
          const isOpen = expanded.has(idx)
          const delivered = c.data[0] || 0
          const pending = c.data[1] || 0
          const notPurchased = c.data[2] || 0
          return (
            <TouchableOpacity
              key={idx}
              activeOpacity={0.8}
              onPress={() => {
                const next = new Set(expanded)
                if (next.has(idx)) next.delete(idx); else next.add(idx)
                setExpanded(next)
              }}
              style={{ backgroundColor: COLORS.card, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: COLORS.text }} numberOfLines={1}>{c.title}</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: COLORS.text, marginTop: 6 }}>{formatCurrency(c.total)}</Text>
                </View>
                <Text style={{ color: COLORS.textLight, fontSize: 20 }}>{isOpen ? '▾' : '▸'}</Text>
              </View>
              {isOpen && (
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SimplePieChart width={140} height={140} stroke={'none'} data={c.data} colors={[ '#10b981', '#f59e0b', '#9ca3af' ]} />
                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                        <LegendDot color="#10b981" label="Delivered" />
                        <Text style={{ color: COLORS.text, fontWeight: '800' }}>{delivered}</Text>
                      </View>
                      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 6 }}>
                        <LegendDot color="#f59e0b" label="Pending" />
                        <Text style={{ color: COLORS.text, fontWeight: '800' }}>{pending}</Text>
                      </View>
                      <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                        <LegendDot color="#9ca3af" label="Not purchased" />
                        <Text style={{ color: COLORS.text, fontWeight: '800' }}>{notPurchased}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          )
        })
      )}

      <Text style={[styles.sectionHeading,{ marginTop: 8 }]}>Transactions</Text>
      <View style={{ backgroundColor: COLORS.card, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, padding: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.text }}>{formatCurrency(summary?.totalRevenue)}</Text>
        {recentPaid.length === 0 ? (
          <Text style={[styles.muted,{ marginTop: 6 }]}>No paid transactions yet</Text>
        ) : (
          <View style={{ marginTop: 10 }}>
            {recentPaid.map((o, i) => (
              <View key={o.id || i} style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical: 8, borderTopWidth: i===0?0:1, borderColor: COLORS.border }}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.text }} numberOfLines={1}>{o?.buyer?.fullName || 'Buyer'}</Text>
                  <Text style={{ fontSize: 11, color: COLORS.textLight }} numberOfLines={1}>{o?.product?.title || 'Product'}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.text }}>{formatCurrency(o.totalAmount)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={{ height: 60 }} />
    </ScrollView>
  )
}

function LegendDot({ color, label }) {
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ color: COLORS.text, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}
