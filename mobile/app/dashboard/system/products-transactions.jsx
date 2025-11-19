import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native'
import { getJSON } from '../../../context/api'

export default function ProductsTransactions() {
  const [productsData, setProductsData] = useState(null) // formerly marketplace
  const [transactions, setTransactions] = useState(null)
  const [loading, setLoading] = useState(true)
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
      setProductsData(prod)
      setTransactions(t)
    } catch (e) {
      setError(e?.body || e?.message || 'Failed to load analytics')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  

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
        <>
          {/* Transactions KPIs */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Order Metrics</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
              {[
                { label:'Completed', value: transactions?.totals?.completed },
                { label:'Pending', value: transactions?.totals?.pending },
                { label:'Failed', value: transactions?.totals?.failed },
                { label:'Revenue', value: transactions ? `KSh ${Number(transactions.totals.revenue||0).toLocaleString()}` : '' },
                { label:'Avg Value', value: transactions ? `KSh ${Math.round(Number(transactions.totals.averageValue||0)).toLocaleString()}` : '' },
              ].map(k => (
                <View key={k.label} style={{ width:'50%', marginBottom:12 }}>
                  <Text style={{ color:'#6b7280' }}>{k.label}</Text>
                  <Text style={{ fontSize:18, fontWeight:'700', marginTop:4 }}>{k.value ?? 0}</Text>
                </View>
              ))}
            </View>
          </View>
          {/* Products KPIs */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Products Overview</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap' }}>
              <View style={{ width:'50%', marginBottom:12 }}>
                <Text style={{ color:'#6b7280' }}>Total Products</Text>
                <Text style={{ fontSize:18, fontWeight:'700', marginTop:4 }}>{productsData?.products?.total ?? 0}</Text>
              </View>
            </View>
            <View style={{ marginTop:8 }}>
              <Text style={{ fontWeight:'600', marginBottom:6 }}>Top Categories</Text>
              {(!productsData?.topCategories || productsData.topCategories.length===0) && (
                <Text style={{ color:'#6b7280' }}>No category data</Text>
              )}
              {(productsData?.topCategories || []).map(c => (
                <View key={c.category} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:4 }}>
                  <Text style={{ fontWeight:'600' }}>{c.category || 'Uncategorized'}</Text>
                  <Text style={{ color:'#6b7280' }}>{c.c}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop:12 }}>
              <Text style={{ fontWeight:'600', marginBottom:6 }}>Top Farmers</Text>
              {(!productsData?.topFarmers || productsData.topFarmers.length===0) && (
                <Text style={{ color:'#6b7280' }}>No farmer data</Text>
              )}
              {(productsData?.topFarmers || []).map(f => {
                const name = f.full_name || f.username || f.email || `Farmer #${f.farmerId}`
                return (
                  <View key={f.farmerId} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:4 }}>
                    <Text style={{ fontWeight:'600' }}>{name}</Text>
                    <Text style={{ color:'#6b7280' }}>{f.sales}</Text>
                  </View>
                )
              })}
            </View>
          </View>
          {/* Simple trend lists */}
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Revenue Trend (Daily)</Text>
            {(!productsData?.revenueTrend || productsData.revenueTrend.length===0) ? <Text style={{ color:'#6b7280' }}>No revenue data</Text> : (
              productsData.revenueTrend.slice(-14).map(r => (
                <View key={String(r.d)} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:4 }}>
                  <Text>{new Date(r.d).toLocaleDateString()}</Text>
                  <Text style={{ fontWeight:'600' }}>KSh {Math.round(Number(r.revenue||0)).toLocaleString()}</Text>
                </View>
              ))
            )}
          </View>
          <View style={{ backgroundColor:'#fff', borderRadius:12, padding:16, marginBottom:32 }}>
            <Text style={{ fontSize:16, fontWeight:'700', marginBottom:12 }}>Orders Per Day</Text>
            {(!transactions?.perDay || transactions.perDay.length===0) ? <Text style={{ color:'#6b7280' }}>No order data</Text> : (
              transactions.perDay.slice(-14).map(r => (
                <View key={String(r.date)} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:4 }}>
                  <Text>{new Date(r.date).toLocaleDateString()}</Text>
                  <Text style={{ fontWeight:'600' }}>{r.count}</Text>
                </View>
              ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  )
}
