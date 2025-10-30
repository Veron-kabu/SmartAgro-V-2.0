import { ScrollView, View, Text, TouchableOpacity } from 'react-native'
import * as Sharing from 'expo-sharing'
import * as Print from 'expo-print'
import * as FileSystem from 'expo-file-system'

const demoRows = [
  { metric: 'Total Users', value: 4218 },
  { metric: 'Transactions', value: 842 },
  { metric: 'Revenue (KSh)', value: 254300 },
  { metric: 'Uptime (%)', value: 99.91 },
]

function toCSV(rows) {
  const header = 'Metric,Value\n'
  const body = rows.map(r => `${r.metric},${r.value}`).join('\n')
  return header + body + '\n'
}

export default function AdminTools() {
  const onExportCSV = async () => {
    try {
      const csv = toCSV(demoRows)
  const baseDir = (FileSystem||{})['cacheDirectory'] || (FileSystem||{})['documentDirectory'] || ''
      const path = baseDir + `system-analytics-${Date.now()}.csv`
      await FileSystem.writeAsStringAsync(path, csv)
      await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' })
    } catch (e) { console.log('csv export failed', e?.message) }
  }

  const onExportPDF = async () => {
    try {
      const html = `<!doctype html><html><head><meta charset='utf-8'><title>System Analytics</title></head>
        <body style="font-family: Arial, sans-serif; padding:16px">
          <h2>System Analytics Snapshot</h2>
          <table style="border-collapse: collapse; width: 100%">
            <thead><tr><th style="border:1px solid #ddd; padding:8px; text-align:left">Metric</th><th style="border:1px solid #ddd; padding:8px; text-align:right">Value</th></tr></thead>
            <tbody>
              ${demoRows.map(r => `<tr><td style='border:1px solid #ddd; padding:8px'>${r.metric}</td><td style='border:1px solid #ddd; padding:8px; text-align:right'>${r.value}</td></tr>`).join('')}
            </tbody>
          </table>
        </body></html>`
      const { uri } = await Print.printToFileAsync({ html })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' })
    } catch (e) { console.log('pdf export failed', e?.message) }
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#f3f4f6' }} contentContainerStyle={{ padding:16, gap:12 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827', marginBottom:4 }}>Administrative Tools</Text>
      <View style={{ backgroundColor:'#fff', borderRadius:14, padding:12 }}>
        <Text style={{ fontSize:14, fontWeight:'700', marginBottom:8 }}>Filters</Text>
        <View style={{ flexDirection:'row', gap:8 }}>
          {['7d','30d','90d','YTD','All'].map((r)=> (
            <View key={r} style={{ backgroundColor:'#e5e7eb', paddingHorizontal:12, paddingVertical:6, borderRadius:999 }}><Text>{r}</Text></View>
          ))}
        </View>
      </View>
      <View style={{ backgroundColor:'#fff', borderRadius:14, padding:12, gap:10 }}>
        <Text style={{ fontSize:14, fontWeight:'700' }}>Export Reports</Text>
        <TouchableOpacity onPress={onExportCSV} style={{ backgroundColor:'#111827', paddingVertical:12, borderRadius:10, alignItems:'center' }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onExportPDF} style={{ backgroundColor:'#2563eb', paddingVertical:12, borderRadius:10, alignItems:'center' }}>
          <Text style={{ color:'#fff', fontWeight:'700' }}>Export PDF</Text>
        </TouchableOpacity>
      </View>
      <View style={{ backgroundColor:'#fff', borderRadius:14, padding:12 }}>
        <Text style={{ fontSize:14, fontWeight:'700', marginBottom:8 }}>Notifications</Text>
        <Text style={{ color:'#6b7280' }}>No suspicious activity detected.</Text>
      </View>
    </ScrollView>
  )
}
