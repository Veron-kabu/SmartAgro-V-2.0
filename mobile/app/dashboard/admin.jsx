import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Switch } from 'react-native'
import { useProfile } from '../../context/profile'
import { useCallback, useEffect, useState } from 'react'
import { useLogout } from '../../hooks/useLogout'
import { getJSON, postJSON } from '../../context/api'
import { useToast } from '../../context/toast'
import { router } from 'expo-router'

export default function AdminDashboard() {
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile()
  const toast = useToast()
  const [syncStatus, setSyncStatus] = useState(null)
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false)
  const [runningSync, setRunningSync] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [overview, setOverview] = useState(null)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const { signingOut, logout: confirmLogout } = useLogout()

  const name = profile?.fullName || profile?.username || 'User'
  const role = profile?.role || 'admin'

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

  const fetchOverview = useCallback(async () => {
    try {
      setOverviewLoading(true)
      const data = await getJSON('/api/stats/overview')
      setOverview(data)
    } catch (e) {
      console.log('overview fetch failed', e?.message)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const onRunSync = useCallback(async () => {
    if (runningSync) return
    try {
      setRunningSync(true)
      toast.show(dryRun ? 'Running dry sync…' : 'Running sync…', { type: 'info' })
      const result = await postJSON('/api/admin/clerk-sync-run', { dryRun, logDiffs: true, verbose: false })
      toast.show(dryRun ? 'Dry sync complete' : 'Sync complete', { type: 'success' })
      await fetchSyncStatus()
      setSyncStatus(prev => {
        if (!prev) return prev
        return { ...prev, latestRun: { ...(prev.latestRun||{}), ...result } }
      })
    } catch (e) {
      console.log('sync run failed', e?.message)
      toast.show('Sync failed', { type: 'error' })
    } finally {
      setRunningSync(false)
    }
  }, [runningSync, dryRun, fetchSyncStatus, toast])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([fetchSyncStatus(), fetchOverview(), refreshProfile()])
    setRefreshing(false)
  }, [fetchSyncStatus, fetchOverview, refreshProfile])

  // Logout now handled by shared useLogout hook

  useEffect(() => {
    if (!profileLoading) {
      fetchSyncStatus()
      fetchOverview()
    }
  }, [profileLoading, fetchSyncStatus, fetchOverview])

  if (profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading profile…</Text>
      </View>
    )
  }

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
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f3f4f6' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', color: '#111827' }}>Admin Console</Text>
      <Text style={{ marginTop: 4, color: '#374151' }}>Welcome back, {name}</Text>

      {/* Profile Summary */}
      <View style={{ marginTop: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Profile</Text>
        <View style={{ marginTop: 12, gap: 6 }}>
          <Row label="Role" value={role} />
          <Row label="Email" value={profile?.email || '—'} />
          <Row label="Username" value={profile?.username || '—'} />
        </View>
      </View>

      {/* Overview Stats (from stats/overview) */}
      <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Your Activity Snapshot</Text>
          {overviewLoading && <ActivityIndicator size="small" />}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          <Stat label="Unread Msgs" value={overview?.messages?.unread ?? 0} />
          <Stat label="Orders Active" value={overview?.orders?.active ?? 0} />
          <Stat label="Orders Delivered" value={overview?.orders?.delivered ?? 0} />
        </View>
      </View>

      {/* Clerk Sync Status */}
      <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Clerk User Sync</Text>
          {loadingSyncStatus && <ActivityIndicator size="small" />}
        </View>
        <View style={{ marginTop: 12, gap: 6 }}>
          <Row label="DB Users" value={String(syncStatus?.dbUserCount ?? '—')} />
          <Row label="Last Run" value={latest ? relTime(latest.finishedAt || latest.startedAt) : '—'} />
          <Row label="Processed" value={latest?.processed != null ? String(latest.processed) : '—'} />
          <Row label="Inserted" value={latest?.inserted != null ? String(latest.inserted) : '—'} />
          <Row label="Updated" value={latest?.updated != null ? String(latest.updated) : '—'} />
          <Row label="Status" value={latest?.status || (loadingSyncStatus ? 'loading' : '—')} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Switch value={dryRun} onValueChange={setDryRun} />
            <Text style={{ fontSize: 12, color: '#374151' }}>Dry Run</Text>
          </View>
          <TouchableOpacity
            onPress={onRunSync}
            disabled={runningSync}
            style={{ backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, opacity: runningSync ? 0.7 : 1 }}
            activeOpacity={0.85}
          >
            {runningSync ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Syncing…</Text>
              </View>
            ) : (
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Run {dryRun ? 'Dry' : 'Full'} Sync</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Links */}
      <View style={{ marginTop: 16, backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Quick Actions</Text>
        <View style={{ marginTop: 12, gap: 10 }}>
          <QuickLink label="My Listings" onPress={() => router.push('/dashboard/my-listings')} />
          <QuickLink label="Messages" onPress={() => router.push('/dashboard/messages')} />
          <QuickLink label="Earnings (Farmer)" disabled onPress={() => {}} note="Farmer only" />
        </View>
      </View>

      {/* Logout */}
      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          onPress={confirmLogout}
          disabled={signingOut}
          style={{ backgroundColor: '#dc2626', paddingVertical: 12, borderRadius: 12, alignItems: 'center', opacity: signingOut ? 0.75 : 1 }}
          activeOpacity={0.85}
        >
          {signingOut ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Logging out…</Text>
            </View>
          ) : (
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Log Out</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 12, color: '#6b7280' }}>{label}</Text>
      <Text style={{ fontSize: 12, color: '#111827', fontWeight: '600' }}>{value}</Text>
    </View>
  )
}

function Stat({ label, value }) {
  return (
    <View style={{ width: '33%', paddingVertical: 12, alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{value}</Text>
      <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{label}</Text>
    </View>
  )
}

function QuickLink({ label, onPress, disabled = false, note }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: disabled ? '#e5e7eb' : '#16a34a', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, opacity: disabled ? 0.6 : 1 }}
      activeOpacity={0.85}
    >
      <Text style={{ color: disabled ? '#6b7280' : '#fff', fontWeight: '600', fontSize: 13 }}>{label}</Text>
      {note && <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>{note}</Text>}
    </TouchableOpacity>
  )
}
