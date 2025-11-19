import { useEffect, useState, useCallback } from 'react' 
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams, router } from 'expo-router'
import { getJSON, postJSON } from '../../../context/api'
import { emit as emitEvent } from '../../../utils/eventBus'
import ImageViewing from 'react-native-image-viewing'
import { useToast } from '../../../context/toast'

async function resolveImageUrl(uploadKey) {
  const q = encodeURIComponent(uploadKey)
  const r = await getJSON(`/api/admin/verification-image-url?key=${q}`)
  return r?.url || null
}

// OCR overlays removed

export default function VerificationDetail() {
  const { id } = useLocalSearchParams()
  const [rec, setRec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rejecting, setRejecting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonFocused, setReasonFocused] = useState(false)
  const [imageUrls, setImageUrls] = useState([])
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(0)
  const [viewerVisible, setViewerVisible] = useState(false)
  const toast = useToast()

  const fetchRec = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getJSON(`/api/admin/verifications/${encodeURIComponent(id)}`)
      setRec(data)
      const imgs = Array.isArray(data?.images) ? data.images : []
      // Initialize with nulls so UI can render placeholders immediately
      setImageUrls(new Array(imgs.length).fill(null))
      await Promise.all(
        imgs.map(async (img, idx) => {
          try {
            // Prefer resolving by uploadKey for private buckets
            let final = null
            if (img?.uploadKey) {
              const signed = await resolveImageUrl(img.uploadKey)
              if (signed) final = signed
            }
            if (!final) {
              const raw = img?.displayUrl || null
              if (raw) final = raw
            }
            if (final) {
              setImageUrls(prev => {
                const next = prev && prev.length === imgs.length ? [...prev] : new Array(imgs.length).fill(null)
                next[idx] = final
                return next
              })
            }
          } catch { /* leave null */ }
        })
      )
    } catch (e) {
      console.log('fetch detail failed', e?.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchRec() }, [fetchRec])

  const onApprove = useCallback(async () => {
    try {
      setApproving(true)
      await postJSON(`/api/admin/verifications/${encodeURIComponent(id)}/approve`, {})
      emitEvent('verification:update', { id: Number(id), status: 'approved' })
      router.back()
    } finally { setApproving(false) }
  }, [id])

  const onReject = useCallback(async () => {
    try {
      setRejecting(true)
      await postJSON(`/api/admin/verifications/${encodeURIComponent(id)}/reject`, { reviewer_comment: reason })
      emitEvent('verification:update', { id: Number(id), status: 'rejected' })
      router.back()
    } finally { setRejecting(false) }
  }, [id, reason])

    const onRequestInfo = () => {
      // Optimistic: act instantly without waiting
      const note = reason || 'More evidence requested'
      try { toast.show('Requested more info', { type: 'success' }) } catch {}
      router.back()
      // Fire-and-forget; surface any failure via toast
      ;(async () => {
        try {
          await postJSON(`/api/admin/verifications/${encodeURIComponent(id)}/request-more-info`, { reason: note })
        } catch (e) {
          try { toast.show(e?.body || 'Request more info failed', { type: 'error' }) } catch {}
        }
      })()
    }

    // Escalate removed

  if (loading) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>
  if (!rec) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>Not found</Text></View>

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f3f4f6' }} contentContainerStyle={{ padding: 12, paddingBottom: 36 }}>
      {/* Title only (header back button provided by navigation) */}
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom:8 }}>Submission #{rec.id}</Text>
      <Text style={{ marginTop: 4, color: '#6b7280' }}>{new Date(rec.createdAt).toLocaleString()}</Text>
      {rec.awaitingSecondApproval && (
        <View style={{ marginTop: 8, backgroundColor: '#FEF3C7', padding: 10, borderRadius: 10 }}>
          <Text style={{ color: '#92400E' }}>Awaiting second approval{rec.firstReviewerId ? ` · first by #${rec.firstReviewerId}` : ''}</Text>
        </View>
      )}

      {rec.images?.map((img, idx) => (
        <View key={idx} style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
          <View style={{ width: '100%', aspectRatio: 4/3, backgroundColor: '#e5e7eb' }}>
            {imageUrls[idx] ? (
              <View style={{ flex: 1 }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={{ flex: 1, borderWidth: selectedIdx === idx ? 3 : 0, borderColor: selectedIdx === idx ? '#2563eb' : 'transparent' }}
                  onPress={() => {
                    // Tap-to-zoom only; per-image tagging removed
                    setSelectedIdx(null)
                    const filteredIndices = (imageUrls || []).map((u, i) => (u ? i : null)).filter(i => i !== null)
                    const mappedIndex = filteredIndices.indexOf(idx)
                    setViewerIndex(Math.max(0, mappedIndex))
                    setViewerVisible(true)
                  }}
                >
                  <ExpoImage
                    source={{ uri: imageUrls[idx] }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={0}
                    priority="high"
                  />
                </TouchableOpacity>
                {/* overlays removed */}
              </View>
            ) : (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>
            )}
          </View>
          <View style={{ padding: 12 }} />
        </View>
      ))}

      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '700' }}>Device</Text>
        <Text style={{ marginTop: 4, color: '#374151' }}>{JSON.stringify(rec.deviceInfo || {}, null, 2)}</Text>
      </View>

      <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '700' }}>Decision</Text>
        <View style={{ marginTop: 10 }}>
          <TextInput
            placeholder="Reason / note (optional)"
            placeholderTextColor="#94A3B8"
            value={reason}
            onChangeText={setReason}
            multiline
            onFocus={() => setReasonFocused(true)}
            onBlur={() => setReasonFocused(false)}
            style={{
              backgroundColor:'#FFFFFF',
              borderWidth:1.5,
              borderColor: reasonFocused ? '#2563eb' : '#CBD5E1',
              borderRadius:10,
              padding:12,
              minHeight:100,
              textAlignVertical:'top',
              color:'#111827'
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity onPress={onApprove} disabled={approving} style={{ backgroundColor: '#16a34a', padding: 10, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{approving ? 'Approving…' : 'Approve'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onReject} disabled={rejecting} style={{ backgroundColor: '#dc2626', padding: 10, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>{rejecting ? 'Rejecting…' : 'Reject'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity onPress={onRequestInfo} style={{ backgroundColor: '#2563eb', padding: 10, borderRadius: 8, flex: 1 }}>
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Request More Info</Text>
          </TouchableOpacity>
          {/* Escalate button removed */}
        </View>
      </View>
      <ImageViewing
        images={(imageUrls || []).filter(Boolean).map(u => ({ uri: u }))}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
        presentationStyle="fullScreen"
        swipeToCloseEnabled
      />
    </ScrollView>
  )
}
