"use client"

import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../constants/colors'
import { ordersHubStyles as styles } from '../../assets/styles/orders.styles'

export default function FundsIndex() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Funds</Text>
      <Text style={styles.subtitle}>Choose what to view</Text>
      <View style={styles.grid}>
  <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/funds/earnings')}>
          <View style={styles.iconWrap}><Ionicons name="trending-up-outline" size={22} color={COLORS.white} /></View>
          <Text style={styles.cardTitle}>Earnings</Text>
          <Text style={styles.cardHint}>Revenue and trends</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/funds/transactions')}>
          <View style={styles.iconWrap}><Ionicons name="swap-vertical-outline" size={22} color={COLORS.white} /></View>
          <Text style={styles.cardTitle}>Transactions</Text>
          <Text style={styles.cardHint}>Income and payouts</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => router.push('/funds/withdrawals')}>
          <View style={styles.iconWrap}><Ionicons name="card-outline" size={22} color={COLORS.white} /></View>
          <Text style={styles.cardTitle}>Withdrawals</Text>
          <Text style={styles.cardHint}>Cash out funds</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
