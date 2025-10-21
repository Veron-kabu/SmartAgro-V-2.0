import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native'
import { getJSON, postJSON } from '../../context/api'
import { useToast } from '../../context/toast'
import { useAuth } from '@clerk/clerk-expo'
import { useProfile } from '../../context/profile'
import { useFocusEffect } from '@react-navigation/native'

export default function ReportsQueue() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const isAdmin = useMemo(() => profile?.role === 'admin', [profile])

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getJSON('/api/admin/reports')
      setItems(res?.items || [])
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

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800' }}>Reports</Text>
      {loading ? <View style={{ marginTop: 20 }}><ActivityIndicator /></View> : error ? (
        <Text style={{ color: '#dc2626', marginTop: 8 }}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={{ color: '#6b7280', marginTop: 12 }}>No reports.</Text>
      ) : (
        items.map(r => (
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
    </ScrollView>
  )
}
