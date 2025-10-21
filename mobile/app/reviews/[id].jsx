import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, Keyboard, StyleSheet, Alert } from 'react-native'
import { getJSON, postJSON, deleteJSON } from '../../context/api'
import { Ionicons } from '@expo/vector-icons'
import StarRating from '../../components/StarRating'
import { COLORS } from '../../constants/colors'
import { useProfile } from '../../context/profile'

export default function ReviewThread() {
  const { id } = useLocalSearchParams()
  const reviewId = Number(Array.isArray(id) ? id[0] : id)
  const [review, setReview] = useState(null)
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const { profile } = useProfile()
  const isAdmin = String(profile?.role || '').toLowerCase() === 'admin'
  const isSuspended = String(profile?.status || '').toLowerCase() === 'suspended'
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())

  const load = useCallback(async () => {
    if (!reviewId || Number.isNaN(reviewId)) return
    setLoading(true)
    try {
      const [r, c] = await Promise.all([
        getJSON(`/api/reviews/${reviewId}`),
        getJSON(`/api/reviews/${reviewId}/comments`),
      ])
      setReview(r)
      setComments(Array.isArray(c?.items) ? c.items : [])
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to load review')
    } finally { setLoading(false) }
  }, [reviewId])

  useEffect(() => { load() }, [load])

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const onDeleteSingle = async (id) => {
    try {
      const proceed = await new Promise(resolve => {
        Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ])
      })
      if (!proceed) return
      await deleteJSON(`/api/admin/reviews/comments/${id}`)
      setComments(prev => prev.filter(c => c.id !== id))
      setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch (e) {
      Alert.alert('Error', e?.body || e?.message || 'Failed to delete')
    }
  }

  const onBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    try {
      const proceed = await new Promise(resolve => {
        Alert.alert('Delete selected', `Delete ${ids.length} selected comment(s)?`, [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
        ])
      })
      if (!proceed) return
      await postJSON('/api/admin/reviews/comments/bulk-delete', { ids })
      setComments(prev => prev.filter(c => !selectedIds.has(c.id)))
      setSelectedIds(new Set())
      setSelectMode(false)
    } catch (e) {
      Alert.alert('Error', e?.body || e?.message || 'Failed to delete selected')
    }
  }

  const send = async () => {
    if (!text.trim()) return
    Keyboard.dismiss()
    try {
      setSending(true)
      const payload = { comment: text.trim() }
      // Optimistic append at top (newest-first list)
      const optimistic = {
        id: `temp_${Date.now()}`,
        reviewId,
        authorUserId: profile?.id,
        authorName: null,
        authorUsername: profile?.username || null,
        comment: payload.comment,
        createdAt: new Date().toISOString(),
        optimistic: true,
      }
      setComments(prev => [optimistic, ...prev])
      const resp = await postJSON(`/api/reviews/${reviewId}/comments`, payload)
      // Replace optimistic with server response
      setComments(prev => {
        const without = prev.filter(c => c.id !== optimistic.id)
        return [resp, ...without]
      })
      setText('')
    } catch (e) {
      // Revert optimistic if any
      setComments(prev => prev.filter(c => !String(c.id).startsWith('temp_')))
      Alert.alert('Error', e?.body || e?.message || 'Failed to send')
    } finally { setSending(false) }
  }

  if (!reviewId || Number.isNaN(reviewId)) return <View style={styles.center}><Text>Invalid review</Text></View>
  if (loading) return <View style={styles.center}><Text>Loading…</Text></View>
  if (!review) return <View style={styles.center}><Text>Review not found</Text></View>

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 6 }}>Review</Text>
        <View style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <StarRating value={review.rating} size={14} />
            <Text style={{ marginLeft: 8, color: COLORS.muted, fontSize: 12 }}>by {review.reviewerName || review.reviewerUsername || `#${review.reviewerId}`}</Text>
            <Text style={{ marginLeft: 'auto', color: COLORS.muted, fontSize: 12 }}>{new Date(review.createdAt).toLocaleString()}</Text>
          </View>
          {review.comment ? <Text style={{ marginTop: 8 }}>{review.comment}</Text> : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>Replies</Text>
          {isAdmin && (
            <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {!selectMode ? (
                <TouchableOpacity onPress={() => setSelectMode(true)} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#111827', borderRadius: 8 }}>
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Bulk Select</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setSelectedIds(new Set(comments.map(c => c.id)))} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e5e7eb', borderRadius: 8 }}>
                    <Text style={{ color: '#111827', fontWeight: '700', fontSize: 12 }}>Select All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectedIds(new Set())} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e5e7eb', borderRadius: 8 }}>
                    <Text style={{ color: '#111827', fontWeight: '700', fontSize: 12 }}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onBulkDelete} disabled={!selectedIds.size} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: selectedIds.size ? '#dc2626' : '#f3f4f6', borderRadius: 8 }}>
                    <Text style={{ color: selectedIds.size ? '#fff' : '#9ca3af', fontWeight: '700', fontSize: 12 }}>Delete ({selectedIds.size})</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds(new Set()) }} style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#e5e7eb', borderRadius: 8 }}>
                    <Text style={{ color: '#111827', fontWeight: '700', fontSize: 12 }}>Done</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
        {Array.isArray(comments) && comments.length ? comments.map(c => {
          const isMe = !!profile?.id && c.authorUserId === profile.id
          const isOwner = !!review?.reviewedId && c.authorUserId === review.reviewedId
          const bg = isMe ? '#e6f9f2' : isOwner ? '#eef2ff' : '#fff'
          const bd = isMe ? '#34d399' : isOwner ? '#93c5fd' : '#e5e7eb'
          const name = isMe ? 'me' : (isOwner ? 'owner' : (c.authorName || c.authorUsername || `#${c.authorUserId}`))
          const selected = selectedIds.has(c.id)
          return (
            <TouchableOpacity key={c.id} activeOpacity={0.8} onPress={selectMode ? () => toggleSelect(c.id) : undefined} style={{ backgroundColor: bg, borderRadius: 10, padding: 12, borderWidth: 2, borderColor: (selectMode && selected) ? '#111827' : bd, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: COLORS.muted, fontSize: 12, marginBottom: 4, flex: 1 }}>by {name}</Text>
                {isAdmin && !selectMode && (
                  <TouchableOpacity onPress={() => onDeleteSingle(c.id)} style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#dc2626', borderRadius: 6 }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                )}
                {isAdmin && selectMode && (
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? '#111827' : '#6b7280'} />
                )}
              </View>
              <Text>{c.comment}</Text>
              <Text style={{ color: COLORS.muted, fontSize: 12, marginTop: 6 }}>{new Date(c.createdAt).toLocaleString()}</Text>
            </TouchableOpacity>
          )
        }) : (
          <Text style={{ color: COLORS.muted }}>No replies yet.</Text>
        )}

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>Add a reply</Text>
          {isSuspended && (
            <View style={{ backgroundColor: '#FFF7ED', borderColor: '#F59E0B', borderWidth: 1, borderRadius: 8, padding: 8, marginBottom: 8 }}>
              <Text style={{ color: '#92400E' }}>Replies are disabled while your account is suspended.</Text>
            </View>
          )}
          <TextInput
            placeholder="Write a reply"
            value={text}
            onChangeText={setText}
            editable={!isSuspended}
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 10, minHeight: 44, opacity: isSuspended ? 0.6 : 1 }}
            multiline
          />
          <TouchableOpacity onPress={send} disabled={sending || !text.trim() || isSuspended} style={{ marginTop: 10, backgroundColor: (sending || !text.trim() || isSuspended) ? '#cbd5e1' : COLORS.primary, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{sending ? 'Sending…' : 'Send reply'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
})
