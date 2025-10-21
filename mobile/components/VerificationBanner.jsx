import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { getJSON } from '../context/api'

// Reusable verification banner
// Props:
// - role: 'farmer' | 'buyer' | undefined (for copy)
// - containerStyle, buttonStyle, textStyle overrides (optional)
export default function VerificationBanner({ role = 'farmer', containerStyle, buttonStyle, textStyle }) {
  const [verifyStatus, setVerifyStatus] = useState(null)
  const [latestFlagged, setLatestFlagged] = useState(false)
  const [reviewerMessage, setReviewerMessage] = useState(null)
  const [navBusy, setNavBusy] = useState(false)
  const refresh = useCallback(async (mountedRef) => {
    try {
      const j = await getJSON('/api/verification/my-status')
      if (mountedRef.current === false) return
      setVerifyStatus(j?.status || 'unverified')
      if (j?.status && j.status !== 'unverified') {
        try {
          const latest = await getJSON('/api/verification/my-latest')
          if (mountedRef.current === false) return
          setLatestFlagged(latest?.status === 'flagged')
          setReviewerMessage(latest?.reviewerMessage || null)
        } catch {
          if (mountedRef.current !== false) setLatestFlagged(false)
        }
      } else {
        setLatestFlagged(false)
        setReviewerMessage(null)
      }
    } catch {
      if (mountedRef.current !== false) setVerifyStatus(null)
    }
  }, [])

  useEffect(() => {
    const mountedRef = { current: true }
    refresh(mountedRef)
    return () => { mountedRef.current = false }
  }, [refresh])

  useFocusEffect(
    useCallback(() => {
      const mountedRef = { current: true }
      refresh(mountedRef)
      return () => { mountedRef.current = false }
    }, [refresh])
  )

  // Do not show verification UI for buyers
  if (role === 'buyer') return null
  if (!verifyStatus || verifyStatus === 'verified') return null

  const isPending = verifyStatus === 'pending'
  const showProvideMore = isPending && latestFlagged
  const ctaLabel = showProvideMore ? 'Provide more info' : (isPending ? 'Wait for approval' : 'Start verification')

  return (
    <View style={[{ backgroundColor: '#fef3c7', padding: 12 }, containerStyle]}> 
      <Text style={[{ color: '#92400e', fontWeight: '700' }, textStyle]}>Complete verification</Text>
      <Text style={[{ color: '#92400e', marginTop: 2 }, textStyle]}>Earn trust and unlock full features by confirming you are a real {role}. It takes about 2 minutes.</Text>
      {showProvideMore ? (
        <Text style={[{ color: '#92400e', marginTop: 4, fontStyle: 'italic' }, textStyle]}>
          {reviewerMessage ? reviewerMessage : 'More info requested by reviewer'}
        </Text>
      ) : null}
      <TouchableOpacity
        style={[{ backgroundColor: '#f59e0b', alignSelf: 'flex-start', marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, opacity: navBusy ? 0.6 : 1 }, buttonStyle]}
        onPress={() => {
          if (navBusy) return
          setNavBusy(true)
          router.push('/verification')
          // prevent multi-press; let navigation and focus refresh handle updates
          setTimeout(() => setNavBusy(false), 1000)
        }}
        disabled={navBusy}
        accessibilityLabel="Complete verification"
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>{ctaLabel}</Text>
      </TouchableOpacity>
      {!!verifyStatus && verifyStatus !== 'unverified' && (
        <Text style={[{ color: '#92400e', marginTop: 6, fontSize: 12 }, textStyle]}>Status: {verifyStatus}</Text>
      )}
    </View>
  )
}
