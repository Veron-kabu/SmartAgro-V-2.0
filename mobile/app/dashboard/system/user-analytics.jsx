import { View, Text, TouchableOpacity } from 'react-native'
import SimpleLineChart from '../../../components/charts/SimpleLineChart'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import SimplePieChart from '../../../components/charts/SimplePieChart'
import { useEffect, useState } from 'react'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import ZoomableChart from '../../../components/charts/ZoomableChart'

export default function UserAnalytics() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getJSON(`/api/analytics/users?range=${encodeURIComponent(range)}`)
        if (alive) setData(res)
      } catch (_e) {}
    })()
    return () => { alive = false }
  }, [range])

  const daily = (data?.growth||[]).map(g=>g.count)
  const weekly = daily.slice(-7)
  const monthly = daily
  const distro = [Number(data?.totals?.farmers||0), Number(data?.totals?.buyers||0)]
  const total = Number(data?.totals?.total||0) || 1
  const active = Number(data?.status?.active||0)
  const activeVsInactive = [Math.round((active/total)*100), 100 - Math.round((active/total)*100)]

  const header = (
    <View style={{ padding:16, paddingBottom:0 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:4 }}>User Analytics</Text>
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
    {
      title: 'Growth (Daily)',
      render: () => (
        <ZoomableChart width={320} height={120}>
          <SimpleLineChart width={320} height={120} color="#16a34a" area data={daily} />
        </ZoomableChart>
      )
    },
    {
      title: 'Growth (Weekly vs Monthly)',
      render: () => (
        <View style={{ flexDirection:'row', gap:12 }}>
          <ZoomableChart width={160} height={120}>
            <SimpleBarChart width={160} height={120} color="#0ea5e9" data={weekly} />
          </ZoomableChart>
          <ZoomableChart width={160} height={120}>
            <SimpleLineChart width={160} height={120} color="#f59e0b" data={monthly} />
          </ZoomableChart>
        </View>
      )
    },
    {
      title: 'User Types',
      render: () => (
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          <SimplePieChart width={120} height={120} donut data={[{ value:distro[0] },{ value:distro[1] }]} />
          <View>
            <Text>Farmers: {distro[0]}%</Text>
            <Text>Buyers: {distro[1]}%</Text>
          </View>
        </View>
      )
    },
    {
      title: 'Active vs Inactive',
      render: () => (
        <View style={{ flexDirection:'row', alignItems:'center', gap:12 }}>
          <SimplePieChart width={120} height={120} colors={["#22c55e","#ef4444"]} donut data={[{ value:activeVsInactive[0] },{ value:activeVsInactive[1] }]} />
          <View>
            <Text>Active: {activeVsInactive[0]}%</Text>
            <Text>Inactive: {activeVsInactive[1]}%</Text>
          </View>
        </View>
      )
    },
  ]

  return (
    <StickySections
      sections={sections}
      contentContainerStyle={{ paddingTop: 8 }}
      ListHeaderComponent={header}
      cardless
      itemContainerStyle={{ marginBottom:16 }}
    />
  )
}
