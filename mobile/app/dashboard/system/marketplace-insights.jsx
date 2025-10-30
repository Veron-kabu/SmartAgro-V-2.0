import { View, Text, TouchableOpacity } from 'react-native'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import SimpleLineChart from '../../../components/charts/SimpleLineChart'
import { useEffect, useState } from 'react'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import ZoomableChart from '../../../components/charts/ZoomableChart'

export default function MarketplaceInsights() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getJSON(`/api/analytics/marketplace?range=${encodeURIComponent(range)}`)
        if (alive) setData(res)
      } catch (_e) {}
    })()
    return () => { alive = false }
  }, [range])

  const productsListed = Number(data?.products?.total || 0)
  const topCats = (data?.topCategories || []).map(c => ({ label: c.category, value: Number(c.c) }))
  const sellers = (data?.topFarmers || []).map(s => ({ name: `Farmer ${s.farmerid || s.farmerId}`, sales: Number(s.sales) }))
  const revenueTrend = (data?.revenueTrend || []).map(r => Number(r.revenue))
  const priceTrend = (data?.avgPriceTrend || []).map(r => Number(r.avgprice || r.avgPrice))

  const header = (
    <View style={{ padding:16, paddingBottom:0 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:4 }}>Marketplace Insights</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        {[
          { key:'today', label:'Today' },
          { key:'1w', label:'1W' },
          { key:'1m', label:'1M' },
          { key:'1y', label:'1Y' },
        ].map(({key,label}) => (
          <TouchableOpacity key={key} onPress={() => setRange(key)} style={{ backgroundColor: range===key?'#111827':'#e5e7eb', paddingHorizontal:12, paddingVertical:6, borderRadius:999 }}>
            <Text style={{ color: range===key?'#fff':'#111827', fontWeight:'700', fontSize:12 }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )

  const sections = [
    { title: 'Products listed', render: () => (<Text style={{ fontSize:24, fontWeight:'800' }}>{productsListed.toLocaleString()}</Text>) },
    { title: 'Most traded categories', render: () => (
      <View>
        <ZoomableChart width={320} height={140}>
          <SimpleBarChart width={320} height={140} color="#6366f1" data={topCats.map(c=>c.value)} />
        </ZoomableChart>
        <View style={{ flexDirection:'row', justifyContent:'space-between', flexWrap:'wrap', marginTop:8 }}>
          {topCats.map((c,i)=>(<Text key={i} style={{ fontSize:12, width:'48%' }}>{c.label}: {c.value}</Text>))}
        </View>
      </View>
    ) },
    { title: 'Top-performing farmers', render: () => (
      <View>
        {sellers.map((s,i)=> (
          <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', paddingVertical:6 }}>
            <Text>{s.name}</Text>
            <Text style={{ fontWeight:'700' }}>{s.sales} sales</Text>
          </View>
        ))}
      </View>
    ) },
    { title: 'Sales & revenue trend', render: () => (
      <ZoomableChart width={320} height={120}>
        <SimpleLineChart width={320} height={120} color="#22c55e" area data={revenueTrend} />
      </ZoomableChart>
    ) },
    { title: 'Average product price', render: () => (
      <ZoomableChart width={320} height={120}>
        <SimpleLineChart width={320} height={120} color="#f59e0b" data={priceTrend} />
      </ZoomableChart>
    ) },
  ]

  return (
    <StickySections
      sections={sections}
      ListHeaderComponent={header}
      cardless
      itemContainerStyle={{ marginBottom:16 }}
    />
  )
}
