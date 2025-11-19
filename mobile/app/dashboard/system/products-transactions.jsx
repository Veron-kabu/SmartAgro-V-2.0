import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Image, Dimensions } from 'react-native'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import { Ionicons } from '@expo/vector-icons'
import { getJSON } from '../../../context/api'

// Module-level cache so the UI can render instantly on repeated opens
let cachedProductsData = global.__cached_products_data__
let cachedTransactions = global.__cached_transactions__

const DEFAULT_PRODUCTS_DATA = { products: { total: 0 }, topCategories: [], topFarmers: [], revenueTrend: [] }
const DEFAULT_TRANSACTIONS = { totals: { completed: 0, pending: 0, failed: 0, revenue: 0, averageValue: 0 }, perDay: [] }

export default function ProductsTransactions() {
  const [productsData, setProductsData] = useState(cachedProductsData || DEFAULT_PRODUCTS_DATA) // formerly marketplace
  const [transactions, setTransactions] = useState(cachedTransactions || DEFAULT_TRANSACTIONS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [prod, t] = await Promise.all([
        // Backend endpoint name still /analytics/marketplace, treating it as products aggregator
        getJSON(`/api/analytics/marketplace`),
        getJSON(`/api/analytics/transactions`),
      ])
      setProductsData(prod || DEFAULT_PRODUCTS_DATA)
      setTransactions(t || DEFAULT_TRANSACTIONS)
      // persist to global cache to speed up subsequent opens in this process
      try { global.__cached_products_data__ = prod || DEFAULT_PRODUCTS_DATA } catch {}
      try { global.__cached_transactions__ = t || DEFAULT_TRANSACTIONS } catch {}
    } catch (e) {
      setError(e?.body || e?.message || 'Failed to load analytics')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  

  // Prepare KPI rows for rendering (2 per row)
  const _t = transactions?.totals || {}
  const kpiCards = [
    { key: 'completed', label: 'Completed', value: _t.completed || 0 },
    { key: 'pending', label: 'Pending', value: _t.pending || 0 },
    { key: 'failed', label: 'Failed', value: _t.failed || 0 },
    { key: 'avg', label: 'Avg Value', value: Math.round(Number(_t.averageValue || 0)) },
  ]
  const kpiRows = []
  for (let i = 0; i < kpiCards.length; i += 2) kpiRows.push(kpiCards.slice(i, i + 2))

  // Products helpers for the Overview section
  const topCategories = productsData?.topCategories || []
  const maxCat = Math.max(...(topCategories.map(tc => Number(tc.c || 0))), 1)
  const categoryColors = ['#FB7185', '#34D399', '#F59E0B', '#60A5FA']
  const topFarmers = productsData?.topFarmers || []

  return (
    <ScrollView contentContainerStyle={{ padding:16 }} style={{ backgroundColor:'#f3f4f6' }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <Text style={{ fontSize:20, fontWeight:'800' }}>Products & Transactions</Text>
        <View />
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : error ? (
        <Text style={{ color:'#dc2626' }}>{error}</Text>
      ) : (
        <React.Fragment>
          {/* Transactions KPIs — styled cards */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Order Metrics</Text>
            <View>
              {/* Small KPI cards arranged explicitly in a 2x2 grid */}
              {kpiRows.map((pair, ridx) => (
                <View key={`row-${ridx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                  {pair.map((it, idx) => (
                    <View key={it.key} style={{ width: '48%', backgroundColor:'#fff', borderRadius:10, padding:8, borderWidth:1, borderColor:'#f3f4f6', marginBottom:8 }}>
                      <View style={{ flexDirection:'row', alignItems:'center' }}>
                        <View style={{ width:32, height:32, borderRadius:8, backgroundColor:'#f3f4f6', alignItems:'center', justifyContent:'center', marginRight:8 }}>
                          <Ionicons name={ridx*2+idx===0 ? 'checkmark-done' : ridx*2+idx===1 ? 'time-outline' : ridx*2+idx===2 ? 'close-circle-outline' : 'cash-outline'} size={16} color={ridx*2+idx===2 ? '#ef4444' : '#10b981'} />
                        </View>
                        <View>
                          <Text style={{ color:'#6b7280', fontSize:11 }}>{it.label}</Text>
                          <Text style={{ fontSize:16, fontWeight:'800', marginTop:2 }}>{it.key==='avg' ? `KSh ${it.value.toLocaleString()}` : String(it.value)}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>

            {/* Large revenue card */}
            <View style={{ marginTop:8, backgroundColor:'#059669', borderRadius:12, padding:16 }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <View>
                  <Text style={{ color:'#ECFDF5', fontSize:12, fontWeight:'700' }}>Total Revenue</Text>
                  <Text style={{ color:'#FFFFFF', fontSize:22, fontWeight:'900', marginTop:8 }}>KSh {Math.round(Number(transactions?.totals?.revenue || 0)).toLocaleString()}</Text>
                </View>
                <View style={{ width:44, height:44, borderRadius:10, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="cash-outline" size={20} color="#fff" />
                </View>
              </View>
            </View>
          </View>
          {/* Products KPIs */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Products Overview</Text>

            {/* Total products card */}
            <View style={{ backgroundColor:'#fff', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'#f3f4f6' }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <View>
                  <Text style={{ color:'#6b7280', fontSize:12 }}>Total Products</Text>
                  <Text style={{ fontSize:26, fontWeight:'900', marginTop:6 }}>{productsData?.products?.total ?? 0}</Text>
                </View>
                <View style={{ width:52, height:52, borderRadius:12, backgroundColor:'#F0DBFF', alignItems:'center', justifyContent:'center' }}>
                  <Ionicons name="cube" size={22} color="#7C3AED" />
                </View>
              </View>

              <View style={{ marginTop:12, flexDirection:'row', alignItems:'center' }}>
                <View style={{ flex:1, height:8, backgroundColor:'#f3f4f6', borderRadius:8, overflow:'hidden', marginRight:8 }}>
                  <View style={{ width: `${productsData?.activePercent ?? 78}%`, height:8, backgroundColor:'#A78BFA' }} />
                </View>
                <Text style={{ color:'#6b7280', fontSize:12 }}>{String(productsData?.activePercent ?? 78)}% Active</Text>
              </View>
            </View>

            {/* Top Categories */}
            <View style={{ marginTop:4 }}>
              <Text style={{ fontWeight:'600', marginBottom:8 }}>Top Categories</Text>
              {topCategories.length === 0 ? (
                <Text style={{ color:'#6b7280' }}>No category data</Text>
              ) : (
                topCategories.map((c, idx) => {
                  const count = Number(c.c || 0)
                  const pct = Math.round((count / maxCat) * 100)
                  const color = categoryColors[idx % categoryColors.length]
                  return (
                    <View key={`cat-${c?.category ?? idx}`} style={{ marginBottom:12, backgroundColor:'#fff' }}>
                      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                        <View style={{ flexDirection:'row', alignItems:'center' }}>
                          <View style={{ width:40, height:40, borderRadius:10, backgroundColor: color + '20', alignItems:'center', justifyContent:'center', marginRight:10 }}>
                            <Ionicons name="leaf" size={18} color={color} />
                          </View>
                          <Text style={{ fontWeight:'600' }}>{c.category || 'Uncategorized'}</Text>
                        </View>
                        <Text style={{ color:'#374151', fontWeight:'700' }}>{count}</Text>
                      </View>
                      <View style={{ marginTop:8, height:8, backgroundColor:'#f3f4f6', borderRadius:8, overflow:'hidden' }}>
                        <View style={{ width: `${pct}%`, height:8, backgroundColor: color }} />
                      </View>
                    </View>
                  )
                })
              )}
            </View>

            {/* Top Farmers */}
            <View style={{ marginTop:12 }}>
              <Text style={{ fontWeight:'600', marginBottom:8 }}>Top Farmers</Text>
              {topFarmers.length === 0 ? (
                <Text style={{ color:'#6b7280' }}>No farmer data</Text>
              ) : (
                topFarmers.map((f, idx) => {
                  const name = f.full_name || f.username || f.email || `Farmer #${f.farmerId ?? idx}`
                  const subtitle = `${f.productsCount || f.product_count || f.products || f.sales || 0} Products`
                  const revenue = f.revenue || f.revenue_total || f.sales_revenue || f.sales || 0
                  const key = `farmer-${f.farmerId ?? f.id ?? f.username ?? idx}`
                  const initials = (name || '').split(' ').map(s => s[0]).slice(0,2).join('')
                  return (
                    <View key={key} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8 }}>
                      <View style={{ flexDirection:'row', alignItems:'center' }}>
                        {f.avatar || f.image ? (
                          <Image source={{ uri: f.avatar || f.image }} style={{ width:44, height:44, borderRadius:22, marginRight:10 }} />
                        ) : (
                          <View style={{ width:44, height:44, borderRadius:22, marginRight:10, backgroundColor:'#EEF2FF', alignItems:'center', justifyContent:'center' }}>
                            <Text style={{ color:'#4C1D95', fontWeight:'700' }}>{initials}</Text>
                          </View>
                        )}
                        <View>
                          <Text style={{ fontWeight:'700' }}>{name}</Text>
                          <Text style={{ color:'#6b7280', fontSize:12 }}>{subtitle}</Text>
                        </View>
                      </View>
                      <Text style={{ color:'#10B981', fontWeight:'700' }}>KSh {Math.round(Number(revenue || 0)).toLocaleString()}</Text>
                    </View>
                  )
                })
              )}
            </View>
          </View>
          {/* Revenue Trend chart (7 days) */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:12, marginBottom:16 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <Text style={{ fontSize:16, fontWeight:'700' }}>Revenue Trend</Text>
            </View>
            {(!productsData?.revenueTrend || productsData.revenueTrend.length===0) ? (
              <Text style={{ color:'#6b7280' }}>No revenue data</Text>
            ) : (
              (() => {
                // Aggregate revenue into 4 weekly buckets for November (1-7,8-14,15-21,22-end)
                const raw = (productsData.revenueTrend || [])
                // Use current year for November; if you want a specific year, change this.
                const year = new Date().getFullYear()
                const novStart = new Date(year, 10, 1) // November monthIndex=10
                const novEnd = new Date(year, 11, 0) // last day of November
                const weeks = [
                  { start: new Date(year, 10, 1), end: new Date(year, 10, 7) },
                  { start: new Date(year, 10, 8), end: new Date(year, 10, 14) },
                  { start: new Date(year, 10, 15), end: new Date(year, 10, 21) },
                  { start: new Date(year, 10, 22), end: novEnd },
                ]
                const sums = weeks.map(() => 0)
                raw.forEach(r => {
                  try {
                    const d = new Date(r.d)
                    if (isNaN(d)) return
                    // Only consider dates in November of chosen year
                    if (d < novStart || d > novEnd) return
                    for (let i = 0; i < weeks.length; i++) {
                      if (d >= weeks[i].start && d <= weeks[i].end) {
                        sums[i] += Number(r.revenue || 0)
                        break
                      }
                    }
                  } catch (_e) {}
                })
                const labels = weeks.map((w, i) => {
                  const sDay = w.start.getDate()
                  const eDay = w.end.getDate()
                  return `${sDay}-${eDay}`
                })
                const vals = sums.map(v => Math.round(v))
                const chartWidth = Math.min(Dimensions.get('window').width - 64, 360)
                const axis = {
                  yFormatter: (n) => String(Math.round(n)),
                  xLabels: labels,
                  yColor: '#9CA3AF',
                  xColor: '#9CA3AF',
                }
                const data = vals.map((v, i) => ({ x: labels[i], y: v }))
                return (
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 36, alignItems: 'flex-end', marginRight: 6 }}>
                        <Text style={{ color: '#6b7280', fontSize: 12 }}>KSh</Text>
                      </View>
                      <SimpleBarChart data={data} width={chartWidth} height={160} color="#10B981" ticks={5} maxY={90} xLabels={labels} yFormatter={axis.yFormatter} />
                    </View>
                    <Text style={{ color:'#6b7280', fontSize:12, marginTop:6 }}>November</Text>
                  </View>
                )
              })()
            )}
          </View>
          
        </React.Fragment>
      )}
    </ScrollView>
  )
}
