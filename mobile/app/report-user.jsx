import React, { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON, postJSON } from '../context/api'
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
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '800' }}>Report User</Text>
      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: '#374151', fontWeight: '700' }}>Farmer: </Text>
        {loadingTarget ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={{ color: '#6b7280' }}>{targetUsername || (Number.isFinite(reportedId) ? `#${reportedId}` : 'Unknown')}</Text>
        )}
      </View>
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700' }}>Reason Code</Text>
        <TextInput value={reason} onChangeText={setReason} placeholder="reason code" style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, marginTop: 8 }} />
      </View>
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700' }}>Description</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder="Describe the issue" multiline style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, minHeight: 100, marginTop: 8, textAlignVertical: 'top' }} />
      </View>
      <TouchableOpacity onPress={submit} disabled={submitting} style={{ backgroundColor: submitting ? '#9ca3af' : '#dc2626', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{submitting ? 'Submitting…' : 'Submit Report'}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
