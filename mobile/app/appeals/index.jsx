import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON, postJSON } from '../../context/api'
import { COLORS } from '../../constants/colors'
import { useProfile } from '../../context/profile'

export default function AppealSuspension() {
  const { reportId } = useLocalSearchParams()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [appeals, setAppeals] = useState([])
  const { profile } = useProfile()
  const isSuspended = String(profile?.status || '').toLowerCase() === 'suspended'

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await getJSON('/api/reports/my-appeals')
        if (!mounted) return
        setAppeals(Array.isArray(res?.items) ? res.items : [])
      } catch {
        if (!mounted) return
        setAppeals([])
      } finally { if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [])

  const hasOpenAppeal = useMemo(() => {
    const list = Array.isArray(appeals) ? appeals : []
    const rid = reportId ? Number(Array.isArray(reportId) ? reportId[0] : reportId) : null
    if (rid) return list.some(a => a.reportId === rid && String(a.status) === 'open')
    return list.some(a => String(a.status) === 'open')
  }, [appeals, reportId])

  const openAppeal = useMemo(() => {
    const list = Array.isArray(appeals) ? appeals : []
    const rid = reportId ? Number(Array.isArray(reportId) ? reportId[0] : reportId) : null
    if (rid) return list.find(a => a.reportId === rid && String(a.status) === 'open') || null
    return list.find(a => String(a.status) === 'open') || null
  }, [appeals, reportId])

  const latestAppeal = useMemo(() => {
    const list = Array.isArray(appeals) ? appeals : []
    return list[0] || null
  }, [appeals])

  const prettyDate = useCallback((iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return String(iso || '')
    }
  }, [])

  const submit = useCallback(async () => {
    const text = String(reason || '').trim()
    if (!text) return
    try {
      setSubmitting(true)
      if (reportId) {
        await postJSON(`/api/reports/${Number(Array.isArray(reportId) ? reportId[0] : reportId)}/appeal`, { reason: text })
      } else {
        await postJSON('/api/reports/appeal-latest', { reason: text })
      }
      Alert.alert('Appeal submitted', 'We have received your appeal. Our team will review it shortly.', [
        { text: 'OK', onPress: () => router.back() }
      ])
      setReason('')
    } catch (e) {
      Alert.alert('Error', e?.body || e?.message || 'Failed to submit appeal')
    } finally { setSubmitting(false) }
  }, [reason, reportId])

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8fafc' }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800' }}>Appeal account suspension</Text>
      {isSuspended ? (
        <Text style={{ color: '#374151', marginTop: 8 }}>Explain briefly why your account should be reinstated. If your suspension relates to a specific report, we will attach this appeal to it.</Text>
      ) : (
        <Text style={{ color: '#374151', marginTop: 8 }}>You are not currently suspended. You can still submit an appeal for a recent action against your account.</Text>
      )}
      {loading ? (
        <View style={{ marginTop: 16 }}><ActivityIndicator color={COLORS.primary} /></View>
      ) : hasOpenAppeal ? (
        <View style={{ marginTop: 12, backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', borderWidth: 1, padding: 10, borderRadius: 8 }}>
          <Text style={{ color: '#065F46', fontWeight: '700' }}>Appeal already submitted</Text>
          <Text style={{ color: '#065F46', marginTop: 4 }}>Your appeal is currently open and under review. You will be notified once there is an update.</Text>
          {openAppeal ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: '#065F46' }}>Status: <Text style={{ fontWeight: '800' }}>{String(openAppeal.status || 'open').toUpperCase()}</Text></Text>
              <Text style={{ color: '#065F46', marginTop: 2 }}>Open since {prettyDate(openAppeal.createdAt)}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        latestAppeal ? (
          <View style={{ marginTop: 12, backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, padding: 10, borderRadius: 8 }}>
            <Text style={{ color: '#111827' }}>Latest appeal</Text>
            <Text style={{ color: '#111827', marginTop: 4 }}>Status: <Text style={{ fontWeight: '800' }}>{String(latestAppeal.status || '').toUpperCase()}</Text></Text>
            <Text style={{ color: '#6b7280', marginTop: 2 }}>Submitted on {prettyDate(latestAppeal.createdAt)}</Text>
            {latestAppeal.status === 'resolved' && latestAppeal.resolvedAt ? (
              <Text style={{ color: '#6b7280', marginTop: 2 }}>Resolved on {prettyDate(latestAppeal.resolvedAt)}</Text>
            ) : null}
          </View>
        ) : null
      )}
      <View style={{ marginTop: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 6 }}>Reason</Text>
        <TextInput
          placeholder="Provide details (required)"
          value={reason}
          onChangeText={setReason}
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, minHeight: 100, textAlignVertical: 'top' }}
          multiline
        />
        <TouchableOpacity onPress={submit} disabled={submitting || !String(reason).trim() || hasOpenAppeal} activeOpacity={0.85} style={{ marginTop: 12, backgroundColor: (submitting || !String(reason).trim() || hasOpenAppeal) ? '#cbd5e1' : COLORS.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' }}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Submit appeal</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
