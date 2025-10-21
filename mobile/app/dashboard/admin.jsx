import { COLORS } from '../../constants/colors'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Switch } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useProfile } from '../../context/profile'
import { useLogout } from '../../hooks/useLogout'
import { useCallback, useEffect, useState } from 'react'
import { getJSON, postJSON } from '../../context/api'
import { useToast } from '../../context/toast'
import { router } from 'expo-router'
import UserDashboard from './UserDashboard'
import { profileStyles as styles } from '../../assets/styles/(tabs)/profile.styles'

export default function AdminDashboard() {
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile()
  const toast = useToast()
  const { signingOut, logout: confirmLogout } = useLogout()
  const [syncStatus, setSyncStatus] = useState(null)
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false)
  const [runningSync, setRunningSync] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [openSync, setOpenSync] = useState(false)

  const name = profile?.fullName || profile?.username || 'User'

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
    await Promise.all([fetchSyncStatus(), refreshProfile()])
    setRefreshing(false)
  }, [fetchSyncStatus, refreshProfile])

  // Logout now handled by shared useLogout hook

  useEffect(() => {
    if (!profileLoading) {
      fetchSyncStatus()
    }
  }, [profileLoading, fetchSyncStatus])

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
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Mirror the user dashboard UI */}
      <UserDashboard expectedRole={profile?.role === 'farmer' ? 'farmer' : 'buyer'} fallbackName={name} />

      {/* Admin-only tools */}
      <View style={[styles.sectionBlock, { marginTop: 0, paddingHorizontal: 16 }]}>
        {/* Collapsible Clerk Sync */}
        <View style={styles.sectionHeaderRow}>
          <TouchableOpacity style={styles.sectionTitleBtn} onPress={() => setOpenSync(v=>!v)} activeOpacity={0.7}>
            <Text style={styles.chevron}>{openSync ? '▾' : '▸'}</Text>
            <Text style={styles.sectionHeading}>Clerk User Sync</Text>
          </TouchableOpacity>
        </View>
        {openSync && (
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, marginTop: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Status</Text>
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
                    <ActivityIndicator size="small" color={COLORS.white} />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Syncing…</Text>
                  </View>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>Run {dryRun ? 'Dry' : 'Full'} Sync</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Admin navigation with same UI as Orders button */}
      <View style={[styles.sectionBlock, { paddingHorizontal: 16 }]}>
        <TouchableOpacity
          style={styles.ordersButton}
          activeOpacity={0.9}
          onPress={() => router.push('/verification/verification-reviews')}
          accessibilityLabel="Verification Reviews"
        >
          <Ionicons name={'shield-checkmark-outline'} size={18} color={COLORS.white} style={styles.ordersButtonIcon} />
          <Text style={styles.ordersButtonText}>Verification Reviews</Text>
        </TouchableOpacity>
        <Text style={styles.ordersButtonHint}>Review and validate submissions</Text>
      </View>

      <View style={[styles.sectionBlock, { paddingHorizontal: 16 }]}>        
        <TouchableOpacity
          style={styles.ordersButton}
          activeOpacity={0.9}
          onPress={() => router.push('/dashboard/reports')}
          accessibilityLabel="Reports Queue"
        >
          <Ionicons name={'flag-outline'} size={18} color={COLORS.white} style={styles.ordersButtonIcon} />
          <Text style={styles.ordersButtonText}>Reports Queue</Text>
        </TouchableOpacity>
        <Text style={styles.ordersButtonHint}>User reports awaiting moderation</Text>
      </View>

      {/* Logout at bottom */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          onPress={confirmLogout}
          disabled={signingOut}
          style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]}
          activeOpacity={0.85}
        >
          {signingOut ? (
            <View style={styles.logoutRow}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.logoutText}>Logging out…</Text>
            </View>
          ) : (
            <Text style={styles.logoutText}>Log Out</Text>
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

// QuickLink removed: buttons now mirror Orders button UI
