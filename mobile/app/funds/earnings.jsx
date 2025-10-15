import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native'
import { getJSON } from '../../context/api'
import { earningsStyles as styles } from '../../assets/styles/dashboard.styles'

// Simple in-memory cache (resets on app reload)
const earningsCache = { data: null, fetchedAt: 0 }
const STALE_MS = 60 * 1000 // 1 minute

export default function EarningsScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  const fetchEarnings = useCallback(async (force=false) => {
    try {
      setError(null)
      const now = Date.now()
      if (!force && earningsCache.data && (now - earningsCache.fetchedAt) < STALE_MS) {
        setSummary(earningsCache.data)
        setLoading(false)
        return
      }
      const data = await getJSON('/api/earnings/farmer/summary')
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

  const formatCurrency = useCallback((v) => {
    const num = Number(v||0)
    return `${summary?.currency || 'KES'} ${num.toLocaleString('en-KE',{maximumFractionDigits:2})}`
  }, [summary?.currency])

  if (loading) return <View style={styles.center}><ActivityIndicator size="small"/><Text style={styles.muted}> Loading earnings...</Text></View>
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); fetchEarnings(true) }}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  )

  const listings = summary?.listings || []
  const trend = summary?.trend || []

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Earnings Overview</Text>
        <TouchableOpacity onPress={() => fetchEarnings(true)} style={styles.refreshBtn}><Text style={styles.refreshText}>↻</Text></TouchableOpacity>
      </View>
      {/* Hero summary */}
      <View style={styles.heroCard}>
        <Text style={styles.metricLabel}>Total Revenue</Text>
        <Text style={styles.heroValue}>{formatCurrency(summary?.totalRevenue)}</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroItem}>
            <Text style={styles.heroLabel}>Delivered</Text>
            <Text style={styles.heroMetric}>{summary?.deliveredOrders}</Text>
          </View>
          <View style={styles.heroItem}>
            <Text style={styles.heroLabel}>Active</Text>
            <Text style={styles.heroMetric}>{summary?.activeOrders}</Text>
          </View>
          <View style={styles.heroItem}>
            <Text style={styles.heroLabel}>Active Listings</Text>
            <Text style={styles.heroMetric}>{summary?.activeListings ?? (summary?.listings||[]).filter(l=>l.status==='active').length}</Text>
          </View>
        </View>
      </View>
      <View style={styles.metricsGrid}>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Total Revenue</Text><Text style={styles.metricValue}>{formatCurrency(summary?.totalRevenue)}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Delivered Orders</Text><Text style={styles.metricValue}>{summary?.deliveredOrders}</Text></View>
        <View style={styles.metricCard}><Text style={styles.metricLabel}>Active Orders</Text><Text style={styles.metricValue}>{summary?.activeOrders}</Text></View>
  <View style={styles.metricCard}><Text style={styles.metricLabel}>Listings (Active)</Text><Text style={styles.metricValue}>{summary?.activeListings ?? listings.filter(l=>l.status==='active').length}</Text></View>
      </View>

  <Text style={styles.sectionHeading}>7-Day Revenue Trend</Text>
      <View style={styles.chartRow}>
        {trend.map(day => {
          const max = Math.max(...trend.map(t=>t.revenue||0),1)
          const h = (day.revenue / max) * 100
          return (
            <View key={day.date} style={styles.barWrapper}>
              <View style={[styles.bar,{ height: 4 + h }]} />
              <Text style={styles.barLabel}>{day.date.slice(5)}</Text>
            </View>
          )
        })}
      </View>

      <Text style={styles.sectionHeading}>Listings Performance</Text>
      {listings
        .slice()
        .sort((a,b)=> (b.revenue||0)-(a.revenue||0))
        .map(l => (
          <View key={l.id} style={styles.listingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listingTitle}>{l.title}</Text>
              <Text style={styles.listingSub}>{l.delivered} delivered · {formatCurrency(l.revenue)} · Avg {formatCurrency(l.avgUnitPrice)}</Text>
              {l.lastOrderAt && <Text style={styles.lastOrder}>Last: {new Date(l.lastOrderAt).toLocaleDateString()}</Text>}
            </View>
            <View style={styles.qtyBlock}>
              <Text style={styles.qtyValue}>{l.deliveredQuantity || 0}</Text>
              <Text style={styles.qtyLabel}>Qty</Text>
            </View>
          </View>
        ))}
      <View style={{ height: 60 }} />
    </ScrollView>
  )
}
