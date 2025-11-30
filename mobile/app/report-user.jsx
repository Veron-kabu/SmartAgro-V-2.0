import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON, postJSON } from '../context/api'
import { COLORS } from '../constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../context/toast'

export default function ReportUser() {
  const params = useLocalSearchParams()
  const reportedId = useMemo(() => Number(params?.id), [params?.id])
  const initialUsername = useMemo(() => (typeof params?.username === 'string' ? params.username : ''), [params?.username])
  const [targetUsername, setTargetUsername] = useState(initialUsername)
  const [loadingTarget, setLoadingTarget] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()

  // If no username was provided in params, fetch by id to show 'Farmer: <username>'
  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (targetUsername || !Number.isFinite(reportedId)) return
      try {
        setLoadingTarget(true)
        const u = await getJSON(`/api/users/${reportedId}`)
        if (mounted && u?.username) setTargetUsername(u.username)
      } catch (_) {
        // ignore fetch errors; UI will fallback to showing numeric id
      } finally { setLoadingTarget(false) }
    })()
    return () => { mounted = false }
  }, [reportedId, targetUsername])

  const submit = async () => {
    try {
      setSubmitting(true)
      const payload = {
        // Backend accepts username string or numeric id via reported_user_id
        reported_user_id: targetUsername || reportedId,
        reason_code: reason,
        description,
        evidence_media_links: [],
      }
      await postJSON('/api/reports', payload)
      toast.show('Report submitted', { type: 'success' })
      router.back()
    } catch (e) { toast.show(e?.body || 'Failed to submit report', { type: 'error' }) } finally { setSubmitting(false) }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: COLORS.background, flexGrow: 1 }}>
      <View style={{ paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 44, justifyContent: 'center', paddingLeft: 6 }} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#000' }}>Report User</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#000', fontWeight: '700' }}>Farmer: </Text>
        {loadingTarget ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={{ color: '#000' }}>{targetUsername || (Number.isFinite(reportedId) ? `#${reportedId}` : 'Unknown')}</Text>
        )}
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700', color: '#000' }}>Reason Code</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="reason code" placeholderTextColor={'#000'} style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: '#fff', color: '#000' }} />
      </View>

      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700', color: '#000' }}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Describe the issue" placeholderTextColor={'#000'} multiline style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, minHeight: 100, marginTop: 8, textAlignVertical: 'top', backgroundColor: '#fff', color: '#000' }} />
      </View>

      <TouchableOpacity onPress={submit} disabled={submitting} style={{ backgroundColor: submitting ? '#9ca3af' : '#dc2626', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', marginTop: 20, alignSelf: 'center', minWidth: 140 }}>
        <Text style={{ color: COLORS.card, fontWeight: '700' }}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
