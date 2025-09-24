"use client"

import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { useProfile } from '../../context/profile'

export default function OrdersIndex() {
  const { profile } = useProfile()

  useEffect(() => {
    const role = (profile?.role || 'buyer').toLowerCase()
    if (role === 'farmer') router.replace('/orders/farmerorders')
    else router.replace('/orders/buyerorders')
  }, [profile])

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
      <ActivityIndicator size="small" color="#16a34a" />
    </View>
  )
}
