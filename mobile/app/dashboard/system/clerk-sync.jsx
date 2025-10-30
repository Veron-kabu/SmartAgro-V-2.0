import { useCallback, useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity, Switch, ScrollView } from 'react-native'
import { getJSON, postJSON } from '../../../context/api'

export default function ClerkSyncScreen() {
  const [syncStatus, setSyncStatus] = useState(null)
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false)
  const [runningSync, setRunningSync] = useState(false)
  const [dryRun, setDryRun] = useState(false)

  const fetchSyncStatus = useCallback(async () => {
    try {
      setLoadingSyncStatus(true)
      const data = await getJSON('/api/admin/clerk-sync-status')
      setSyncStatus(data)
    } catch (e) {
      console.log('sync status failed', e?.message)
    } finally {
      setLoadingSyncStatus(false)
    }
  }, [])

  const onRunSync = useCallback(async () => {
    if (runningSync) return
    try {
      setRunningSync(true)
      await postJSON('/api/admin/clerk-sync-run', { dryRun, logDiffs: true, verbose: false })
      await fetchSyncStatus()
    } catch (e) {
      console.log('sync run failed', e?.message)
    } finally {
      setRunningSync(false)
    }
  }, [runningSync, dryRun, fetchSyncStatus])

  useEffect(() => { fetchSyncStatus() }, [fetchSyncStatus])

  const latest = syncStatus?.latestRun
  const relTime = (dateStr) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return 'just now'
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <ScrollView style={{ flex:1, backgroundColor:'#f3f4f6' }} contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:20, fontWeight:'800', color:'#111827' }}>Clerk User Sync</Text>
      <View style={{ backgroundColor:'#fff', borderRadius:12, padding:12, marginTop:12 }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={{ fontSize:14, fontWeight:'600', color:'#374151' }}>Status</Text>
          {loadingSyncStatus && <ActivityIndicator size="small" />}
        </View>
        <View style={{ marginTop:12, gap:6 }}>
          <Row label="DB Users" value={String(syncStatus?.dbUserCount ?? '—')} />
          <Row label="Last Run" value={latest ? relTime(latest.finishedAt || latest.startedAt) : '—'} />
          <Row label="Processed" value={latest?.processed != null ? String(latest.processed) : '—'} />
          <Row label="Inserted" value={latest?.inserted != null ? String(latest.inserted) : '—'} />
          <Row label="Updated" value={latest?.updated != null ? String(latest.updated) : '—'} />
          <Row label="Status" value={latest?.status || (loadingSyncStatus ? 'loading' : '—')} />
        </View>
        <View style={{ flexDirection:'row', alignItems:'center', marginTop:14, justifyContent:'space-between' }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Switch value={dryRun} onValueChange={setDryRun} />
            <Text style={{ fontSize:12, color:'#374151' }}>Dry Run</Text>
          </View>
          <TouchableOpacity onPress={onRunSync} disabled={runningSync} style={{ backgroundColor:'#111827', paddingVertical:10, paddingHorizontal:18, borderRadius:10, opacity: runningSync?0.7:1 }}>
            {runningSync ? (
              <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color:'#fff', fontWeight:'600', fontSize:12 }}>Syncing…</Text>
              </View>
            ) : (
              <Text style={{ color:'#fff', fontWeight:'600', fontSize:12 }}>Run {dryRun ? 'Dry' : 'Full'} Sync</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
      <Text style={{ fontSize:12, color:'#6b7280' }}>{label}</Text>
      <Text style={{ fontSize:12, color:'#111827', fontWeight:'600' }}>{value}</Text>
    </View>
  )
}
