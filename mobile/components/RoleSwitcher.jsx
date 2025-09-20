import { View, Text, Button, Alert } from 'react-native'
import { useProfile } from '../context/profile'
import { ROLES, SWITCHABLE_ROLES } from '../constants/roles'
import { patchJSON } from '../context/api'

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001'

export default function RoleSwitcher() {
  const { profile, refresh } = useProfile()
  const current = profile?.role || 'buyer'

  async function switchRole(nextRole) {
    if (!SWITCHABLE_ROLES.includes(nextRole)) return
    if (nextRole === ROLES.admin) return
    try {
      await patchJSON(`${apiUrl}/api/users/role`, { role: nextRole })
      Alert.alert('Role updated', `Switched to ${nextRole}`)
      await refresh()
    } catch (e) {
      Alert.alert('Failed to update role', e?.message || 'Please try again')
    }
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ marginVertical: 8 }}>Current role: {current}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {current !== ROLES.buyer && (
          <Button title="Switch to Buyer" onPress={() => switchRole(ROLES.buyer)} />
        )}
        {current !== ROLES.farmer && (
          <Button title="Switch to Farmer" onPress={() => switchRole(ROLES.farmer)} />
        )}
      </View>
    </View>
  )
}
