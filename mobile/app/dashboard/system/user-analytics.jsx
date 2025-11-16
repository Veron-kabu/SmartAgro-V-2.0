import { View, Text, TouchableOpacity } from 'react-native'
import SimpleLineChart from '../../../components/charts/SimpleLineChart'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import SimplePieChart from '../../../components/charts/SimplePieChart'
import { useEffect, useState } from 'react'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import { useRouter } from 'expo-router'
import ZoomableChart from '../../../components/charts/ZoomableChart'
import ChartTooltip from '../../../components/charts/ChartTooltip'

export default function UserAnalytics() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)
  const [tooltip, setTooltip] = useState({ visible:false, section:null, left:0, top:0, label:'', value:0, format: (v)=>String(v) })

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
      <View style={{ flexDirection:'row', gap:8, marginBottom:8, alignItems:'center' }}>
        <UsersButton />
        
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

  function UsersButton() {
    const router = useRouter()
    return (
      <TouchableOpacity onPress={() => router.push('/dashboard/system/users')} style={{ backgroundColor:'#0f172a', paddingHorizontal:12, paddingVertical:8, borderRadius:10, marginRight:8 }}>
        <Text style={{ color:'#fff', fontWeight:'700' }}>Users</Text>
      </TouchableOpacity>
    )
  }

  const sections = [
    {
      title: 'Growth (Daily)',
      render: () => (
        <View style={{ width:320, height:120, position:'relative' }}>
          <ZoomableChart width={320} height={120}>
            <SimpleLineChart
              width={320}
              height={120}
              color="#16a34a"
              area
              data={daily}
              onPointPress={({ index, value, x, y }) => {
                const tooltipWidth = 140
                const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
                const left = clamp(x - tooltipWidth/2, 8, 320 - tooltipWidth - 8)
                const top = clamp(y - 48, 8, 120 - 56)
                setTooltip({ visible: true, section: 'daily', left, top, label: `Day ${index+1}`, value, format: v => String(v) })
              }}
            />
          </ZoomableChart>
          <ChartTooltip visible={tooltip.visible && tooltip.section==='daily'} left={tooltip.left} top={tooltip.top} label={tooltip.label} value={tooltip.value} formatValue={tooltip.format} />
        </View>
      )
    },
    {
      title: 'Growth (Weekly vs Monthly)',
      render: () => (
        <View style={{ flexDirection:'row', gap:12 }}>
          <View style={{ width:160, height:120, position:'relative' }}>
            <ZoomableChart width={160} height={120}>
              <SimpleBarChart
                width={160}
                height={120}
                color="#0ea5e9"
                data={weekly}
                onBarPress={({ index, value, x, y }) => {
                  const tooltipWidth = 120
                  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
                  const left = clamp(x - tooltipWidth/2, 4, 160 - tooltipWidth - 4)
                  const top = clamp(y - 48, 8, 120 - 56)
                  setTooltip({ visible: true, section: 'weekly', left, top, label: `W${index+1}`, value, format: v => String(v) })
                }}
              />
            </ZoomableChart>
            <ChartTooltip visible={tooltip.visible && tooltip.section==='weekly'} left={tooltip.left} top={tooltip.top} label={tooltip.label} value={tooltip.value} formatValue={tooltip.format} />
          </View>
          <View style={{ width:160, height:120, position:'relative' }}>
            <ZoomableChart width={160} height={120}>
              <SimpleLineChart
                width={160}
                height={120}
                color="#f59e0b"
                data={monthly}
                onPointPress={({ index, value, x, y }) => {
                  const tooltipWidth = 120
                  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
                  const left = clamp(x - tooltipWidth/2, 4, 160 - tooltipWidth - 4)
                  const top = clamp(y - 48, 8, 120 - 56)
                  setTooltip({ visible: true, section: 'monthly', left, top, label: `M${index+1}`, value, format: v => String(v) })
                }}
              />
            </ZoomableChart>
            <ChartTooltip visible={tooltip.visible && tooltip.section==='monthly'} left={tooltip.left} top={tooltip.top} label={tooltip.label} value={tooltip.value} formatValue={tooltip.format} />
          </View>
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
