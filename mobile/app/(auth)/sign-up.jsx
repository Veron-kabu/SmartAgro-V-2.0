import { useSignUp } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View, Text, TextInput, Button, Alert } from 'react-native'

export default function SignUpScreen() {
  const router = useRouter()
  const { isLoaded, signUp } = useSignUp()
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')

  const onSignUpPress = async () => {
    if (!isLoaded) return
    try {
  await signUp.create({ emailAddress, password })
  // If email verification is enabled, prepare verification
  await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
  // Navigate with mode and email so verify screen branches properly
  router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-up', email: emailAddress, sentAt: Date.now() } })
    } catch (err) {
      console.error('Sign-up failed', err)
      Alert.alert('Sign-up failed', err?.errors?.[0]?.message || 'Please try again')
    }
  }

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign Up</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="Email"
        value={emailAddress}
        onChangeText={setEmailAddress}
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}
      />
      <Button title="Sign Up" onPress={onSignUpPress} />
      <View style={{ height: 16 }} />
      <Button title="Go to Sign In" onPress={() => router.push('/(auth)/sign-in')} />
    </View>
  )
}
