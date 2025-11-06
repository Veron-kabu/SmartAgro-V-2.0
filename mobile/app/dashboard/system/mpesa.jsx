import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { getJSON, resolveUrl } from '../../../context/api'

function Section({ title, items, total, loading, onRefresh }) {
  return (
    <View style={{ backgroundColor:'#fff', marginBottom:12, borderRadius:12, padding:12 }}>
      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <Text style={{ fontSize:16, fontWeight:'800' }}>{title}</Text>
        <TouchableOpacity onPress={onRefresh} style={{ paddingHorizontal:10, paddingVertical:6, backgroundColor:'#111827', borderRadius:8 }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {typeof total === 'number' && (
        <Text style={{ color:'#6b7280', fontSize:12, marginBottom:6 }}>Showing {items.length} of {total}</Text>
      )}
      {loading ? (
        <View style={{ padding:12, alignItems:'center' }}><ActivityIndicator /></View>
      ) : items.length === 0 ? (
        <Text style={{ color:'#6b7280' }}>No data</Text>
      ) : (
        items.slice(0, 20).map((it, idx) => (
          <View key={idx} style={{ paddingVertical:8, borderBottomWidth: idx===items.length-1?0:1, borderColor:'#e5e7eb' }}>
            <Text style={{ fontWeight:'700' }}>{it.mpesa_receipt_number || it.transactionId || it.checkout_request_id || it.conversation_id || `#${it.id}`}</Text>
            <Text style={{ color:'#374151', fontSize:12 }}>{it.result_desc || it.status || ''}</Text>
          </View>
        ))
      )}
    </View>
  )
}

export default function MpesaAdmin() {
  const [tx, setTx] = useState([])
  const [payouts, setPayouts] = useState([])
  const [logs, setLogs] = useState([])
  const [totals, setTotals] = useState({ tx: 0, payouts: 0, logs: 0 })
  const [loading, setLoading] = useState({ tx: true, payouts: true, logs: true })
  const [range, setRange] = useState('24h') // '24h' | '7d' | 'all'

  const loadTx = useCallback(async () => {
    setLoading(s => ({ ...s, tx: true }))
    try {
      const now = new Date()
      const from = range === 'all' ? null : new Date(range === '24h' ? now.getTime() - 24*60*60*1000 : now.getTime() - 7*24*60*60*1000)
      const qp = from ? `&dateFrom=${encodeURIComponent(from.toISOString())}` : ''
      const res = await getJSON(`/api/admin/mpesa/transactions?limit=100${qp}`)
      setTx(Array.isArray(res?.items) ? res.items : [])
      setTotals(s => ({ ...s, tx: Number(res?.total || 0) }))
    } catch { setTx([]) } finally { setLoading(s => ({ ...s, tx: false })) }
  }, [range])
  const loadPayouts = useCallback(async () => {
    setLoading(s => ({ ...s, payouts: true }))
    try {
      const now = new Date()
      const from = range === 'all' ? null : new Date(range === '24h' ? now.getTime() - 24*60*60*1000 : now.getTime() - 7*24*60*60*1000)
      const qp = from ? `&dateFrom=${encodeURIComponent(from.toISOString())}` : ''
      const res = await getJSON(`/api/admin/mpesa/payouts?limit=100${qp}`)
      setPayouts(Array.isArray(res?.items) ? res.items : [])
      setTotals(s => ({ ...s, payouts: Number(res?.total || 0) }))
    } catch { setPayouts([]) } finally { setLoading(s => ({ ...s, payouts: false })) }
  }, [range])
  const loadLogs = useCallback(async () => {
    setLoading(s => ({ ...s, logs: true }))
    try {
      const now = new Date()
      const from = range === 'all' ? null : new Date(range === '24h' ? now.getTime() - 24*60*60*1000 : now.getTime() - 7*24*60*60*1000)
      const qp = from ? `&dateFrom=${encodeURIComponent(from.toISOString())}` : ''
      const res = await getJSON(`/api/admin/mpesa/callback-logs?limit=100${qp}`)
      setLogs(Array.isArray(res?.items) ? res.items : [])
      setTotals(s => ({ ...s, logs: Number(res?.total || 0) }))
    } catch { setLogs([]) } finally { setLoading(s => ({ ...s, logs: false })) }
  }, [range])

  useEffect(() => { loadTx(); loadPayouts(); loadLogs(); }, [loadTx, loadPayouts, loadLogs])

  const downloadLogsJson = useCallback(async () => {
    try {
      const now = new Date()
      const from = range === 'all' ? null : new Date(range === '24h' ? now.getTime() - 24*60*60*1000 : now.getTime() - 7*24*60*60*1000)
      const qp = from ? `?dateFrom=${encodeURIComponent(from.toISOString())}` : ''
      const url = resolveUrl(`/api/admin/mpesa/callback-logs/export.json${qp}`)
      await WebBrowser.openBrowserAsync(url)
    } catch {}
  }, [range])

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#f3f4f6' }} contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:8 }}>M-Pesa</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
        {['24h','7d','all'].map(key => (
          <TouchableOpacity key={key} onPress={() => setRange(key)} style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor: range===key ? '#111827' : '#e5e7eb' }}>
            <Text style={{ color: range===key ? '#fff' : '#111827', fontWeight:'700' }}>{key === '24h' ? 'Last 24h' : key === '7d' ? 'Last 7d' : 'All time'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={downloadLogsJson} style={{ paddingHorizontal:10, paddingVertical:6, borderRadius:8, backgroundColor:'#065f46', marginLeft:'auto' }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Download logs JSON</Text>
        </TouchableOpacity>
      </View>
      <Section title="STK Transactions" items={tx} total={totals.tx} loading={loading.tx} onRefresh={loadTx} />
      <Section title="B2C Payouts" items={payouts} total={totals.payouts} loading={loading.payouts} onRefresh={loadPayouts} />
      <Section title="Callback Logs" items={logs} total={totals.logs} loading={loading.logs} onRefresh={loadLogs} />
    </ScrollView>
  )
}
