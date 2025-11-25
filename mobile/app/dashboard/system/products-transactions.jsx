import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, ScrollView, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { getJSON } from '../../../context/api'
import { VictoryBar, VictoryChart, VictoryAxis } from 'victory-native'

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
  const [chartWidth, setChartWidth] = useState(0)
  

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
    { key: 'totalProducts', label: 'Total Products', value: productsData?.products?.total ?? 0 },
  ]
  const kpiRows = []
  for (let i = 0; i < kpiCards.length; i += 2) kpiRows.push(kpiCards.slice(i, i + 2))

  // Products helpers for the Overview section
  const topCategories = productsData?.topCategories || []
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
            
            {/* Compact Total Revenue card (matches attachment) */}
            <View style={{ marginTop:12 }}>
              {(() => {
                const totalRevenue = Math.round(Number(transactions?.totals?.revenue || 0))
                const prevRevenue = Number(transactions?.totals?.prevRevenue ?? NaN)
                const hasPrev = !isNaN(prevRevenue) && prevRevenue > 0
                const changePct = hasPrev ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null
                const formattedAmount = `KSh ${totalRevenue.toLocaleString()}`
                return (
                  <View style={{ backgroundColor:'#10b981', borderRadius:12, padding:14, marginBottom:8, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <View style={{ flex:1, paddingRight:12 }}>
                      <Text style={{ color:'#ECFDF5', fontSize:12, fontWeight:'700' }}>Total Revenue</Text>
                      <Text style={{ color:'#FFFFFF', fontSize:22, fontWeight:'900', marginTop:6 }}>{formattedAmount}</Text>
                      <View style={{ height:1, backgroundColor:'rgba(255,255,255,0.12)', marginVertical:10 }} />
                      {changePct !== null ? (
                        <View style={{ flexDirection:'row', alignItems:'center' }}>
                          <Ionicons name={changePct >= 0 ? 'arrow-up' : 'arrow-down'} size={14} color={changePct >= 0 ? '#D1FAE5' : '#FEE2E2'} />
                          <Text style={{ color:'#D1FAE5', marginLeft:8, fontSize:12 }}>{`${Math.abs(changePct).toFixed(1)}% from last month`}</Text>
                        </View>
                      ) : (
                        <Text style={{ color:'#D1FAE5', fontSize:12 }}>No prior data</Text>
                      )}
                    </View>
                    <View style={{ width:44, height:44, borderRadius:10, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' }}>
                      <Ionicons name="cash-outline" size={20} color="#fff" />
                    </View>
                  </View>
                )
              })()}
            </View>

            {/* Removed original large Total Revenue card — compact card remains below */}
          </View>
          {/* Products KPIs */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Products Overview</Text>

            {/* Total Products card removed per request */}

            {/* Top Categories Bar Chart */}
            <View style={{ marginTop:4 }} onLayout={(e)=> setChartWidth(e?.nativeEvent?.layout?.width || 0)}>
              <Text style={{ fontWeight:'600', marginBottom:8 }}>Top Categories (Delivered Products)</Text>
              {topCategories.length === 0 ? (
                <Text style={{ color:'#6b7280' }}>No category data</Text>
              ) : chartWidth <= 0 ? (
                <Text style={{ color:'#6b7280' }}>Loading chart…</Text>
              ) : (
                <View style={{ alignItems:'center' }}>
                  <VictoryChart
                    width={Math.max(0, chartWidth)}
                    height={300}
                    padding={{ top: 20, bottom: 80, left: 50, right: 20 }}
                    domainPadding={{ x: 25 }}
                  >
                    <VictoryAxis
                      tickFormat={(t) => {
                        const cat = topCategories[t - 1]?.category || ''
                        return cat.length > 8 ? cat.substring(0, 8) + '...' : cat
                      }}
                      style={{
                        tickLabels: { fontSize: 10, fill: '#374151', angle: -45, textAnchor: 'end', padding: 5 },
                        grid: { stroke: 'transparent' },
                        axis: { stroke: '#d1d5db', strokeWidth: 1 }
                      }}
                    />
                    <VictoryAxis
                      dependentAxis
                      tickValues={[0, 1, 2, 3, 4, 5, 6]}
                      tickFormat={(v) => Math.round(v)}
                      label="Delivered"
                      style={{
                        grid: { stroke: '#e5e7eb', strokeWidth: 1 },
                        tickLabels: { fontSize: 10, fill: '#374151' },
                        axis: { stroke: '#d1d5db', strokeWidth: 1 },
                        axisLabel: { padding: 35, fontSize: 11, fill: '#374151', fontWeight: '600', angle: -90 }
                      }}
                    />
                    <VictoryBar
                      data={topCategories.map((c, i) => ({
                        x: i + 1,
                        y: Number(c.c || 0),
                        fill: categoryColors[i % categoryColors.length]
                      }))}
                      style={{
                        data: {
                          fill: ({ datum }) => datum.fill
                        }
                      }}
                      cornerRadius={{ top: 6 }}
                      barWidth={28}
                    />
                  </VictoryChart>
                </View>
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
                  const key = `farmer-${f.farmerId ?? f.id ?? f.username ?? idx}`
                  const initials = (name || '').split(' ').map(s => s[0]).slice(0,2).join('')
                  // determine revenue from multiple possible fields
                  const revenueVal = Number(f.revenue || f.revenue_total || f.totalRevenue || f.earnings || f.salesRevenue || 0)
                  const formattedRevenue = revenueVal ? `KSh ${Math.round(revenueVal).toLocaleString()}` : 'KSh 0'
                  return (
                    <View key={key} style={{ flexDirection:'row', alignItems:'center', paddingVertical:8, justifyContent:'space-between' }}>
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
                      <View style={{ alignItems:'flex-end' }}>
                        <Text style={{ color:'#10b981', fontWeight:'800', fontSize:14 }}>{formattedRevenue}</Text>
                        <Text style={{ color:'#6b7280', fontSize:11 }}>Revenue</Text>
                      </View>
                    </View>
                  )
                })
              )}
            </View>
          </View>
          
        </React.Fragment>
      )}
    </ScrollView>
  )
}
