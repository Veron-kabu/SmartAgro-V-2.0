import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON, postJSON } from '../../context/api'
import { COLORS } from '../../constants/colors'
import { useProfile } from '../../context/profile'
import { productDetailStyles as pstyles } from '../../assets/styles/products.styles'

export default function AppealSuspension() {
  const { reportId } = useLocalSearchParams()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [appeals, setAppeals] = useState([])
  const [focused, setFocused] = useState(false)
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
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.background }} contentContainerStyle={{ padding: 16 }}>
      {/* Header */}
      <View style={{ marginBottom: 8, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }} style={{ position: 'absolute', left: 8, paddingVertical: 6, paddingRight: 12, paddingLeft: 4 }}>
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' }}>Appeal suspension</Text>
      </View>

      {/* Status banner (concise) */}
      <View style={{ marginTop: 4 }}>
        {loading ? null : (
          isSuspended ? (
            <View style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 }}>
              <Text style={{ color: '#065F46', fontWeight: '700' }}>Account suspended</Text>
              <Text style={{ color: '#065F46', marginTop: 2 }}>Submit a brief appeal.</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10 }}>
              <Text style={{ color: '#1E3A8A', fontWeight: '700' }}>Account active</Text>
              <Text style={{ color: '#1E3A8A', marginTop: 2 }}>You may appeal a recent action.</Text>
            </View>
          )
        )}
      </View>
      {loading ? (
        <View style={{ marginTop: 16 }}><ActivityIndicator color={COLORS.primary} /></View>
      ) : hasOpenAppeal ? (
        <View style={{ marginTop: 12, backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', borderWidth: 1, padding: 12, borderRadius: 12 }}>
          <Text style={{ color: '#065F46', fontWeight: '800' }}>Appeal in review</Text>
          {openAppeal ? (
            <View style={{ marginTop: 4 }}>
              <Text style={{ color: '#065F46' }}>Status: <Text style={{ fontWeight: '800' }}>{String(openAppeal.status || 'open').toUpperCase()}</Text></Text>
              <Text style={{ color: '#065F46', marginTop: 2 }}>Since {prettyDate(openAppeal.createdAt)}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        latestAppeal ? (
          <View style={{ marginTop: 12, backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, padding: 12, borderRadius: 12 }}>
            <Text style={{ color: '#111827', fontWeight: '700' }}>Latest appeal</Text>
            <Text style={{ color: '#111827', marginTop: 4 }}>Status: <Text style={{ fontWeight: '800' }}>{String(latestAppeal.status || '').toUpperCase()}</Text></Text>
            <Text style={{ color: '#6b7280', marginTop: 2 }}>Submitted {prettyDate(latestAppeal.createdAt)}</Text>
            {latestAppeal.status === 'resolved' && latestAppeal.resolvedAt ? (
              <Text style={{ color: '#6b7280', marginTop: 2 }}>Resolved {prettyDate(latestAppeal.resolvedAt)}</Text>
            ) : null}
          </View>
        ) : null
      )}

      {/* Appeal form */}
      <View style={{ marginTop: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderColor: '#E5E7EB', borderWidth: 1, padding: 12 }}>
        <Text style={{ fontWeight: '700', color: '#111827', marginBottom: 8 }}>Reason</Text>
        <TextInput
          placeholder="Brief reason for reinstatement (required)"
          placeholderTextColor="#94A3B8"
          value={reason}
          onChangeText={setReason}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: focused ? COLORS.primary : '#CBD5E1', borderRadius: 12, padding: 12, minHeight: 110, textAlignVertical: 'top', color: '#111827' }}
          multiline
        />
        <TouchableOpacity
          onPress={submit}
          disabled={submitting || !String(reason).trim() || hasOpenAppeal}
          activeOpacity={0.85}
          style={
            (submitting || !String(reason).trim() || hasOpenAppeal)
              ? [pstyles.addBtn, pstyles.addBtnDisabled, { marginTop: 12, borderRadius: 12, paddingVertical: 12, minWidth: 160 }]
              : [pstyles.addBtn, { marginTop: 12, borderRadius: 28, paddingVertical: 12, minWidth: 120, alignSelf: 'center', paddingHorizontal: 20 }]
          }
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={pstyles.addBtnText}>Submit appeal</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
