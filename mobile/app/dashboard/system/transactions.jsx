import { View, Text, TouchableOpacity } from 'react-native'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import SimplePieChart from '../../../components/charts/SimplePieChart'
import { useEffect, useState } from 'react'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import ZoomableChart from '../../../components/charts/ZoomableChart'

export default function Transactions() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getJSON(`/api/analytics/transactions?range=${encodeURIComponent(range)}`)
        if (alive) setData(res)
      } catch (_e) {}
    })()
    return () => { alive = false }
  }, [range])

  const totals = {
    completed: Number(data?.totals?.completed || 0),
    pending: Number(data?.totals?.pending || 0),
    failed: Number(data?.totals?.failed || 0),
    revenue: Number(data?.totals?.revenue || 0),
    avg: Number(data?.totals?.averageValue || 0),
  }
  const perDay = (data?.perDay || []).map(d => Number(d.count))
  const byMethod = (data?.paymentMethods || [])

  const header = (
    <View style={{ padding:16, paddingBottom:0 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:4 }}>Transactions</Text>
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
    { title: 'Overview', render: () => (
      <View style={{ gap:6 }}>
        <Text>Completed: <Text style={{ fontWeight:'700' }}>{totals.completed}</Text></Text>
        <Text>Pending: <Text style={{ fontWeight:'700', color:'#f59e0b' }}>{totals.pending}</Text></Text>
        <Text>Failed: <Text style={{ fontWeight:'700', color:'#ef4444' }}>{totals.failed}</Text></Text>
        <Text>Revenue: <Text style={{ fontWeight:'700' }}>KSh {totals.revenue.toLocaleString()}</Text></Text>
        <Text>Avg value: <Text style={{ fontWeight:'700' }}>KSh {totals.avg.toLocaleString()}</Text></Text>
      </View>
    ) },
    { title: 'Transactions per day', render: () => (
      <ZoomableChart width={320} height={140}>
        <SimpleBarChart width={320} height={140} color="#0ea5e9" data={perDay.length?perDay:[0]} />
      </ZoomableChart>
    ) },
    { title: 'Payment methods', render: () => (
      <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
        <SimplePieChart width={120} height={120} donut data={(byMethod.length?byMethod:[100]).map(v=>({ value:v }))} />
        <View>
          <Text style={{ color:'#6b7280' }}>{data?.note || 'Distribution unavailable'}</Text>
        </View>
      </View>
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
