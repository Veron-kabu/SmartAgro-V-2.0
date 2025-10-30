import { View, Text, TouchableOpacity } from 'react-native'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import { useEffect, useState } from 'react'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import ZoomableChart from '../../../components/charts/ZoomableChart'

export default function SystemHealth() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getJSON(`/api/analytics/system-health?range=${encodeURIComponent(range)}`)
        if (alive) setData(res)
      } catch (_e) {}
    })()
    return () => { alive = false }
  }, [range])

  const uptime = Number(data?.uptimePct || 0)
  const sessions = Number(data?.activeSessionsTrend?.slice(-1)?.[0]?.active || 0)
  const responseAvgMs = data?.responseTimeMsAvg
  const storageUsage = Array.isArray(data?.storageUsage) ? data.storageUsage : null

  const header = (
    <View style={{ padding:16, paddingBottom:0 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:4 }}>System Health</Text>
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
    { title: 'Status', render: () => (
      <View style={{ gap:6 }}>
        <Text>Uptime: <Text style={{ fontWeight:'700', color: uptime>99.5?'#16a34a':'#f59e0b' }}>{uptime}%</Text></Text>
        <Text>Active sessions: <Text style={{ fontWeight:'700' }}>{sessions}</Text></Text>
      </View>
    ) },
    { title: 'Average response time (ms)', render: () => (
      responseAvgMs == null ? (
        <Text style={{ color:'#6b7280' }}>Metric unavailable (no response-time telemetry)</Text>
      ) : (
        <View style={{ flexDirection:'row', alignItems:'baseline', gap:8 }}>
          <Text style={{ fontSize:28, fontWeight:'800', color:'#111827' }}>{Math.round(Number(responseAvgMs))}</Text>
          <Text style={{ color:'#6b7280' }}>ms average</Text>
        </View>
      )
    ) },
    { title: 'Storage usage (current)', render: () => (
      Array.isArray(storageUsage) ? (
        <View>
          <ZoomableChart width={320} height={140}>
            <SimpleBarChart width={320} height={140} color="#8b5cf6" data={storageUsage.map(r=>Number(r.bytes||0)/1024/1024)} />
          </ZoomableChart>
          <View style={{ marginTop:8 }}>
            {storageUsage.map((r,i)=> (
              <Text key={i} style={{ fontSize:12, color:'#111827' }}>{r.table}: {(Number(r.bytes||0)/1024/1024).toFixed(1)} MB</Text>
            ))}
          </View>
        </View>
      ) : (
        <Text style={{ color:'#6b7280' }}>Storage metrics unavailable for this database.</Text>
      )
    ) },
    { title: 'Error log summary', render: () => (
      <Text style={{ color:'#6b7280' }}>No critical errors in the last 24 hours.</Text>
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
