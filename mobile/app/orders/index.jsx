"use client"

import { View, Text, TouchableOpacity } from 'react-native'
import { useProfile } from '../../context/profile'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { ordersHubStyles as styles } from '../../assets/styles/orders.styles'

export default function OrdersIndex() {
  const router = useRouter()
  const { profile } = useProfile()
  const role = profile?.role || 'buyer'

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Orders</Text>
      <Text style={styles.subtitle}>Choose a category</Text>
      <View style={styles.grid}>
        {role === 'farmer' && (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/orders/farmerorders?view=incoming')}> 
            <View style={styles.iconWrap}><Ionicons name="newspaper-outline" size={22} color={COLORS.white} /></View>
            <Text style={styles.cardTitle}>Incoming Orders</Text>
            <Text style={styles.cardHint}>Requests to fulfill</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/orders/buyerorders?view=sent')}>
          <View style={styles.iconWrap}><Ionicons name="paper-plane-outline" size={22} color={COLORS.white} /></View>
          <Text style={styles.cardTitle}>Sent Orders</Text>
          <Text style={styles.cardHint}>Orders you placed</Text>
        </TouchableOpacity>
        {role === 'farmer' ? (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/orders/farmerorders?view=fulfilled')}>
            <View style={styles.iconWrap}><Ionicons name="checkmark-done-circle-outline" size={22} color={COLORS.white} /></View>
            <Text style={styles.cardTitle}>Fulfilled Orders</Text>
            <Text style={styles.cardHint}>Delivered and closed</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/orders/buyerorders?view=fulfilled')}>
            <View style={styles.iconWrap}><Ionicons name="checkmark-done-circle-outline" size={22} color={COLORS.white} /></View>
            <Text style={styles.cardTitle}>Fulfilled Orders</Text>
            <Text style={styles.cardHint}>Delivered and closed</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}
