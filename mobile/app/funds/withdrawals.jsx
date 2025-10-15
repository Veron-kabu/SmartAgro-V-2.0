import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { earningsStyles as styles } from '../../assets/styles/dashboard.styles'
import { COLORS } from '../../constants/colors'

export default function WithdrawalsScreen() {
  const [amount, setAmount] = useState('')

  return (
    <View style={{ padding: 16 }}>
      <Text style={styles.title}>Withdraw Funds</Text>
      <Text style={styles.muted}>Enter an amount to withdraw (placeholder UI)</Text>
      <TextInput
        style={[styles.input]}
        value={amount}
        onChangeText={setAmount}
        placeholder="Amount"
        keyboardType="numeric"
      />
      <TouchableOpacity style={[styles.retryBtn, { backgroundColor: COLORS.primary, marginTop: 12 }]} onPress={() => {}}>
        <Text style={[styles.retryText, { color: COLORS.white }]}>Request Withdrawal</Text>
      </TouchableOpacity>
    </View>
  )
}
