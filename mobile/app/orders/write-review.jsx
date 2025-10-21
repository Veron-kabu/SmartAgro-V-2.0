import React, { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, TextInput, TouchableOpacity, ScrollView, Keyboard } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON, postJSON } from '../../context/api'
import StarRating from '../../components/StarRating'
import { useToast } from '../../context/toast'
import { useProfile } from '../../context/profile'

export default function WriteReview() {
  const { id } = useLocalSearchParams()
  const orderId = Number(id)
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  const { profile } = useProfile()

  useEffect(() => {
    if (!orderId) return
    let mounted = true
    ;(async () => {
      try {
        const data = await getJSON(`/api/orders/${orderId}`)
        if (mounted) setOrder(data)
      } catch (_e) {
        // ignore
      } finally { setLoading(false) }
    })()
    return () => { mounted = false }
  }, [orderId])

  const canReview = order && String(order.status).toLowerCase() === 'delivered'
  const isSuspended = String(profile?.status || '').toLowerCase() === 'suspended'

  const onSubmit = async () => {
    Keyboard.dismiss()
    if (!canReview) { toast.show('Order not delivered yet', { type: 'error' }); return }
    try {
      setSubmitting(true)
      await postJSON('/api/reviews', { order_id: orderId, rating, comment })
      toast.show('Review submitted', { type: 'success' })
      router.back()
    } catch (e) {
      toast.show(e?.body || e?.message || 'Failed to submit review', { type: 'error' })
    } finally { setSubmitting(false) }
  }

  if (!orderId || Number.isNaN(orderId)) return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Invalid order</Text></View>
  if (loading) return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><ActivityIndicator /></View>
  if (!order) return <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}><Text>Order not found</Text></View>

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {isSuspended && (
        <View style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Account suspended</Text>
          <Text style={{ color: '#7F1D1D', marginTop: 4, fontSize: 12 }}>Submitting reviews is disabled until your account is reactivated.</Text>
        </View>
      )}
      <Text style={{ fontSize: 20, fontWeight: '800' }}>Write a Review</Text>
      <Text style={{ marginTop: 6, color: '#6b7280' }}>Order #{order.id}</Text>
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Your Rating</Text>
        <StarRating value={rating} editable={!isSuspended} onChange={setRating} size={28} />
      </View>
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Comment (optional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="How did it go?"
          style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, minHeight: 100, textAlignVertical: 'top', opacity: isSuspended ? 0.6 : 1 }}
          multiline
          editable={!isSuspended}
        />
      </View>
      <TouchableOpacity
        onPress={onSubmit}
        disabled={!canReview || submitting || isSuspended}
        style={{ backgroundColor: (!canReview || submitting || isSuspended) ? '#9ca3af' : '#16a34a', marginTop: 20, paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>{submitting ? 'Submitting…' : 'Submit Review'}</Text>
      </TouchableOpacity>
      {!canReview ? (
        <Text style={{ marginTop: 12, color: '#ef4444' }}>Order must be delivered before you can review.</Text>
      ) : null}
    </ScrollView>
  )
}
