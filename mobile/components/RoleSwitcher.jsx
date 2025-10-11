import { View, Text } from 'react-native'
import { useProfile } from '../context/profile'
import { ROLE_NAMES } from '../constants/roles'

// This component is deprecated. Role switching has been disabled.
// Users must select their role during sign-up and it cannot be changed unless by an admin.
export default function RoleDisplay() {
  const { profile } = useProfile()
  const current = profile?.role || 'buyer'

  return (
    <View style={{ alignItems: 'center', padding: 16 }}>
      <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>
        Account Type
      </Text>
      <Text style={{ fontSize: 14, color: '#666' }}>
        {ROLE_NAMES[current] || current}
      </Text>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 4, textAlign: 'center' }}>
        Contact support if you need to change your account type
      </Text>
    </View>
  )
}
