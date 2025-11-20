import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native'
import { getJSON, postJSON } from '../../context/api'
import { useToast } from '../../context/toast'
import { useAuth } from '@clerk/clerk-expo'
import { useProfile } from '../../context/profile'
import { useFocusEffect } from '@react-navigation/native'
// Cache + defaults to render instantly
let cachedReports = global.__cached_reports__
const DEFAULT_REPORTS = []

export default function ReportsQueue() {
  const [items, setItems] = useState(cachedReports || DEFAULT_REPORTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(0)
  const pageSize = 10
  const toast = useToast()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const isAdmin = useMemo(() => profile?.role === 'admin', [profile])

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getJSON('/api/admin/reports')
      const rows = res?.items || []
      setItems(rows)
      try { global.__cached_reports__ = rows } catch {}
    } catch (e) {
      // Provide clearer error reasons
      if (e?.status === 401) setError('You need to sign in to view reports.')
      else if (e?.status === 403) setError('Admin access required to view reports.')
      else setError(e?.body || e?.message || 'Failed to load reports')
    } finally { setLoading(false) }
  }, [])

  // Initial load when auth and profile are ready
  useEffect(() => {
    if (!authLoaded || !isSignedIn || profileLoading) return
    if (!isAdmin) { setLoading(false); setError('Admin access required to view reports.'); setItems([]); return }
    fetchReports()
  }, [authLoaded, isSignedIn, profileLoading, isAdmin, fetchReports])

  // Refetch when screen is focused (handles auth token race on first mount)
  useFocusEffect(
    useCallback(() => {
      if (!authLoaded || !isSignedIn || profileLoading || !isAdmin) return
      fetchReports()
    }, [authLoaded, isSignedIn, profileLoading, isAdmin, fetchReports])
  )

  const act = async (id, action) => {
    try {
      await postJSON(`/api/admin/reports/${id}/${action}`, {})
      toast.show(action === 'validate' ? 'Report validated' : 'Report rejected', { type: 'success' })
      fetchReports()
    } catch (e) { toast.show(e?.body || 'Action failed', { type: 'error' }) }
  }

  const suspendUser = async (userId) => {
    try {
      await postJSON(`/api/admin/users/${userId}/suspend`, {})
      toast.show('User suspended', { type: 'success' })
  // Refresh the list so statuses reflow
      fetchReports()
    } catch (e) {
      toast.show(e?.body || 'Failed to suspend user', { type: 'error' })
    }
  }

  const activateUser = async (userId) => {
    try {
      await postJSON(`/api/admin/users/${userId}/unsuspend`, {})
      toast.show('User activated', { type: 'success' })
      fetchReports()
    } catch (e) {
      toast.show(e?.body || 'Failed to activate user', { type: 'error' })
    }
  }

  const filtered = useMemo(() => items.filter(r => statusFilter === 'all' ? true : r.status === statusFilter), [items, statusFilter])
  const totalPages = Math.ceil(filtered.length / pageSize)
  const pageItems = filtered.slice(page * pageSize, page * pageSize + pageSize)
  useEffect(() => { if (page >= totalPages) setPage(0) }, [totalPages, page])

  const exportCsv = () => {
    try {
      const header = ['id','reportedUserId','reasonCode','status','createdAt']
      const rows = pageItems.map(r => [r.id,r.reportedUserId,r.reasonCode,r.status,r.createdAt])
      const csv = [header.join(','), ...rows.map(row => row.map(v => {
        const s = String(v ?? '')
        return s.includes(',') ? '"' + s.replace(/"/g,'""') + '"' : s
      }).join(','))].join('\n')
      // Fallback: display in a toast (could integrate Clipboard later)
      toast.show('CSV ready (copied to state)', { type: 'success' })
      console.log('[Reports CSV]\n' + csv)
    } catch {}
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800' }}>Reports</Text>
      <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:12 }}>
        {['all','pending','validated','rejected'].map(s => (
          <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={{ paddingVertical:6, paddingHorizontal:12, borderRadius:20, backgroundColor: statusFilter===s ? '#111827' : '#fff', borderWidth:1, borderColor:'#e5e7eb' }}>
            <Text style={{ color: statusFilter===s ? '#fff' : '#111827', fontWeight:'600', textTransform:'capitalize' }}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ marginTop: 8, alignItems: 'flex-end' }}>
        <TouchableOpacity onPress={exportCsv} style={{ paddingVertical:6, paddingHorizontal:12, borderRadius:10, backgroundColor:'#111827' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Export CSV</Text>
        </TouchableOpacity>
      </View>
      {loading ? <View style={{ marginTop: 20 }}><ActivityIndicator /></View> : error ? (
        <Text style={{ color: '#dc2626', marginTop: 8 }}>{error}</Text>
      ) : pageItems.length === 0 ? (
        <Text style={{ color: '#6b7280', marginTop: 12 }}>No reports.</Text>
      ) : (
        pageItems.map(r => (
          <View key={r.id} style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700' }}>Report #{r.id}</Text>
              <Text style={{ color: r.status === 'pending' ? '#f59e0b' : r.status === 'validated' ? '#16a34a' : '#6b7280' }}>{r.status === 'pending' ? 'pending' : r.status}</Text>
            </View>
            <Text style={{ color: '#374151', marginTop: 6 }}>Reason: {r.reasonCode}</Text>
            {r.description ? <Text style={{ color: '#374151', marginTop: 6 }}>{r.description}</Text> : null}
            {(r.lastSuspendedAt || r.lastReactivatedAt) ? (
              <View style={{ marginTop: 8, backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 8, padding: 8 }}>
                {r.lastSuspendedAt ? (
                  <Text style={{ color: '#111827' }}>Suspended on {new Date(r.lastSuspendedAt).toLocaleDateString()}</Text>
                ) : null}
                {r.lastReactivatedAt ? (
                  <Text style={{ color: '#111827', marginTop: 2 }}>Reactivated on {new Date(r.lastReactivatedAt).toLocaleDateString()}</Text>
                ) : null}
              </View>
            ) : null}
            {r.reportedUserStatus === 'suspended' && Number(r.pausedOrdersCount || 0) > 0 && (
              <View style={{ marginTop: 8, backgroundColor: '#FFF7ED', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 8, padding: 8 }}>
                <Text style={{ color: '#92400E', fontWeight: '600' }}>{r.pausedOrdersCount} order(s) paused</Text>
                <Text style={{ color: '#92400E', marginTop: 2 }}>Orders are paused and will resume automatically when the user is reactivated.</Text>
              </View>
            )}
            {/* Severity removed */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {r.status === 'pending' ? (
                <>
                  <TouchableOpacity onPress={() => act(r.id, 'validate')} style={{ backgroundColor: '#16a34a', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Validate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => act(r.id, 'reject')} style={{ backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Reject</Text>
                  </TouchableOpacity>
                </>
              ) : null}
              {/* Admin override: immediate suspension/activation */}
              {r.reportedUserStatus === 'suspended' ? (
                <TouchableOpacity onPress={() => activateUser(r.reportedUserId)} style={{ backgroundColor: '#16a34a', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Activate user</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => suspendUser(r.reportedUserId)} style={{ backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Suspend user</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
      {/* Pagination controls */}
      {totalPages > 1 && !loading && !error ? (
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:20 }}>
          <TouchableOpacity disabled={page===0} onPress={() => setPage(p => Math.max(0, p-1))} style={{ opacity: page===0 ? 0.4 : 1, backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb', paddingVertical:8, paddingHorizontal:14, borderRadius:8 }}>
            <Text style={{ fontWeight:'600' }}>Prev</Text>
          </TouchableOpacity>
          <Text style={{ fontWeight:'600' }}>Page {page+1} / {totalPages}</Text>
          <TouchableOpacity disabled={page >= totalPages-1} onPress={() => setPage(p => Math.min(totalPages-1, p+1))} style={{ opacity: page >= totalPages-1 ? 0.4 : 1, backgroundColor:'#fff', borderWidth:1, borderColor:'#e5e7eb', paddingVertical:8, paddingHorizontal:14, borderRadius:8 }}>
            <Text style={{ fontWeight:'600' }}>Next</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  )
}
