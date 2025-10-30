import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native'
import CombinedBarLineChart from '../../../components/charts/CombinedBarLineChart'
import DualAreaLineChart from '../../../components/charts/DualAreaLineChart'
import { getJSON } from '../../../context/api'
import { useEffect, useState } from 'react'

export default function Overview() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)
  const [txData, setTxData] = useState(null)
  const [mkData, setMkData] = useState(null)
  const [engData, setEngData] = useState(null)
  const [healthData, setHealthData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [overviewRes, txRes, mkRes, engRes, healthRes] = await Promise.all([
          getJSON(`/api/analytics/overview?range=${encodeURIComponent(range)}`),
          getJSON(`/api/analytics/transactions?range=${encodeURIComponent(range)}`),
          getJSON(`/api/analytics/marketplace?range=${encodeURIComponent(range)}`),
          getJSON(`/api/analytics/engagement?range=${encodeURIComponent(range)}`),
          getJSON(`/api/analytics/system-health?range=${encodeURIComponent(range)}`),
        ])
        if (alive) {
          setData(overviewRes)
          setTxData(txRes)
          setMkData(mkRes)
          setEngData(engRes)
          setHealthData(healthRes)
        }
      } catch (_e) { /* ignore for now */ }
    })()
    return () => { alive = false }
  }, [range])

  const tx = { count: data?.transactions?.completed || 0, revenue: data?.transactions?.revenue || 0, avg: data?.transactions?.averageValue || 0, successRate: 0.9 }

  // Demo series shaped like the provided examples (fallbacks if backend doesn't include trends)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  // Build real series from APIs
  const txPerDay = (txData?.perDay || []).map(r => Number(r.c || r.count || 0))
  const revTrend = (mkData?.revenueTrend || []).map(r => Number(r.revenue || 0))
  const labels1 = (mkData?.revenueTrend || []).map(r => {
    try { const d = new Date(r.d); return `${d.toLocaleString('en', { month: 'short' })} ${String(d.getDate()).padStart(2,'0')}` } catch { return '' }
  })
  const engagements = (engData?.perDay || []).map(r => Number(r.c || r.count || 0))
  const sessionsSeries = (healthData?.activeSessionsTrend || []).map(r => Number(r.active || 0))
  const labels2 = (engData?.perDay || []).map(r => { try { const d = new Date(r.d); return d.toLocaleString('en', { month: 'short' }) } catch { return '' } })
  const chartWidth = Math.max(320, Dimensions.get('window').width - 32)

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f3f4f6' }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 }}>Overview</Text>
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
      {/* Big KPI figures like the example */}
      <View style={{ flexDirection:'row', gap:24, alignItems:'baseline', paddingVertical:8 }}>
        <View>
          <Text style={{ fontSize:28, fontWeight:'800', color:'#111827' }}>KSh {Number(tx.revenue||0).toLocaleString()}</Text>
          <Text style={{ color:'#6b7280' }}>Total Sales</Text>
        </View>
        <View>
          <Text style={{ fontSize:28, fontWeight:'800', color:'#111827' }}>KSh {Number(tx.avg||0).toLocaleString()}</Text>
          <Text style={{ color:'#6b7280' }}>Average</Text>
        </View>
      </View>

      {/* Combined bar + line chart matching the example spacing and style */}
      <View style={{ alignItems:'center', marginTop:8 }}>
        <CombinedBarLineChart
          width={chartWidth}
          height={260}
          barData={txPerDay}
          lineData={revTrend}
          xLabels={labels1.length ? labels1 : months.map(m=>`${m} 01`)}
          legend={["Orders","Revenue"]}
        />
      </View>

      {/* Dual area line chart with legend */}
      <View style={{ alignItems:'center', marginTop:16, paddingBottom:24 }}>
        <DualAreaLineChart width={chartWidth} height={260} seriesA={engagements} seriesB={sessionsSeries} xLabels={labels2.length?labels2:months} legend={['Reviews','User sessions']} />
      </View>
    </ScrollView>
  )
}
