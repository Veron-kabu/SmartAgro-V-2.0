import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native'
import { getJSON, postJSON } from '../../../context/api'
import { useToast } from '../../../context/toast'
import { useAuth } from '@clerk/clerk-expo'
import { useProfile } from '../../../context/profile'
import { COLORS } from '../../../constants/colors'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

// Module cache to make the UI appear instantly on open
let cachedAppeals = global.__cached_appeals__
const DEFAULT_APPEALS = []

export default function VerificationAppealsAdmin() {
  const [items, setItems] = useState(cachedAppeals || DEFAULT_APPEALS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)
  const [note, setNote] = useState('')
  const toast = useToast()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const { profile, loading: profileLoading } = useProfile()
  const isAdmin = profile?.role === 'admin'

  const fetchAppeals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getJSON('/api/admin/verification-appeals?status=open')
      const rows = Array.isArray(res?.items) ? res.items : []
      setItems(rows)
      try { global.__cached_appeals__ = rows } catch {}
    } catch (e) {
      if (e?.status === 401) setError('Sign in required.')
      else if (e?.status === 403) setError('Admin access required.')
      else setError(e?.body || e?.message || 'Failed to load appeals')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (!authLoaded || !isSignedIn || profileLoading) return
    if (!isAdmin) { setLoading(false); setError('Admin access required.'); setItems([]); return }
    fetchAppeals()
  }, [authLoaded, isSignedIn, profileLoading, isAdmin, fetchAppeals])

  const beginResolve = (id) => {
    setResolvingId(id)
    setNote('')
  }

  const cancelResolve = () => {
    setResolvingId(null)
    setNote('')
  }

  const resolveAppeal = async (reinstate) => {
    try {
      const id = resolvingId
      if (!id) return
      await postJSON(`/api/admin/verification-appeals/${id}/resolve`, { resolution_note: note || null, reinstate: !!reinstate })
      toast.show('Appeal resolved', { type: 'success' })
      cancelResolve()
      fetchAppeals()
    } catch (e) {
      Alert.alert('Failed', e?.body || e?.message || 'Could not resolve appeal')
    }
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <LoadingSpinner />
    </View>
  )

  return (
    <ScrollView contentContainerStyle={{ padding:16, alignItems: 'center' }} style={{ backgroundColor: COLORS.background }}>
      <View style={{ paddingVertical:1, marginTop: -18, flexDirection:'row', alignItems:'center', justifyContent:'space-between', width: '100%' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, justifyContent: 'center', paddingLeft: 6 }} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize:20, fontWeight:'800', textAlign: 'center', color: '#000' }}>Verification Appeals</Text>
        <View style={{ width: 44 }} />
      </View>
      {error ? (
        <Text style={{ color:'#dc2626', marginTop:12 }}>{error}</Text>
      ) : items.length === 0 ? (
        <Text style={{ color:'#6b7280', marginTop:12 }}>No open appeals.</Text>
      ) : (
        items.map(a => (
          <View key={a.id} style={{ marginTop:14, backgroundColor:'#fff', padding:14, borderRadius:12, borderWidth:1, borderColor:'#e5e7eb', width: '100%', maxWidth: 720 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ fontWeight:'700' }}>Appeal #{a.id}</Text>
              <Text style={{ color:'#f59e0b' }}>{a.status}</Text>
            </View>
            <Text style={{ color:'#374151', marginTop:6 }}>Submission ID: {a.submissionId}</Text>
            {a.reason ? <Text style={{ color:'#374151', marginTop:6 }}>Reason: {a.reason}</Text> : null}
            <Text style={{ color:'#6b7280', marginTop:6, fontSize:12 }}>Filed {new Date(a.createdAt || a.created_at).toLocaleString()}</Text>
            {resolvingId === a.id ? (
              <View style={{ marginTop:12 }}>
                <Text style={{ fontWeight:'600', marginBottom:6 }}>Resolution Note (optional)</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Add a short resolution note"
                  multiline
                  style={{ backgroundColor:'#f9fafb', borderWidth:1, borderColor:'#d1d5db', borderRadius:8, padding:10, minHeight:80, textAlignVertical:'top' }}
                />
                <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:12 }}>
                  <TouchableOpacity onPress={() => resolveAppeal(false)} style={{ backgroundColor:'#111827', paddingVertical:10, paddingHorizontal:14, borderRadius:999 }}>
                    <Text style={{ color:'#fff', fontWeight:'700' }}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => resolveAppeal(true)} style={{ backgroundColor:'#16a34a', paddingVertical:10, paddingHorizontal:14, borderRadius:999 }}>
                    <Text style={{ color:'#fff', fontWeight:'700' }}>Reinstate & Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelResolve} style={{ backgroundColor:'#fff', paddingVertical:10, paddingHorizontal:14, borderRadius:999, borderWidth:1, borderColor:'#e5e7eb' }}>
                    <Text style={{ color:'#111827', fontWeight:'700' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:12 }}>
                <TouchableOpacity onPress={() => beginResolve(a.id)} style={{ backgroundColor:'#111827', paddingVertical:10, paddingHorizontal:14, borderRadius:999 }}>
                  <Text style={{ color:'#fff', fontWeight:'700' }}>Resolve</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  )
}
