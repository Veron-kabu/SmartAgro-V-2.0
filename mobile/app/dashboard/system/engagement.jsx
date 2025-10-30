import { View, Text, TouchableOpacity } from 'react-native'
import SimpleBarChart from '../../../components/charts/SimpleBarChart'
import { useEffect, useState } from 'react'
import { getJSON } from '../../../context/api'
import StickySections from '../../../components/analytics/StickySections'
import ZoomableChart from '../../../components/charts/ZoomableChart'

export default function Engagement() {
  const [range, setRange] = useState('today')
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getJSON(`/api/analytics/engagement?range=${encodeURIComponent(range)}`)
        if (alive) setData(res)
      } catch (_e) {}
    })()
    return () => { alive = false }
  }, [range])

  const ratingStats = { avg: Number(data?.ratingAvg || 0).toFixed(2), count: Number(data?.totalReviews || 0) }
  const reviewsPerDay = (data?.perDay || []).map(d => Number(d.c || d.count || 0))

  const header = (
    <View style={{ padding:16, paddingBottom:0 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:4 }}>Engagement & Communication</Text>
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
    { title: 'Reviews & Ratings', render: () => (
      <View>
        <Text style={{ marginTop:6 }}>Average rating: <Text style={{ fontWeight:'700' }}>{ratingStats.avg}</Text></Text>
        <Text>Total reviews: <Text style={{ fontWeight:'700' }}>{ratingStats.count}</Text></Text>
      </View>
    ) },
    { title: 'Reviews per day', render: () => (
      <ZoomableChart width={320} height={140}>
        <SimpleBarChart width={320} height={140} color="#22c55e" data={reviewsPerDay} />
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
