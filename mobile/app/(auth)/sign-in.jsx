import { useSignIn } from '@clerk/clerk-expo'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { View, Text, TextInput, Button, Alert } from 'react-native'

export default function SignInScreen() {
  const router = useRouter()
  const { signIn, setActive, isLoaded } = useSignIn()
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')

  const onSignInPress = async () => {
    if (!isLoaded) return
    try {
      const result = await signIn.create({ identifier: emailAddress, password })

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
        router.replace('/')
      } else if (result.status === 'needs_first_factor') {
        // Prepare email code factor and navigate to verify with email in params
        try {
          await signIn.prepareFirstFactor({ strategy: 'email_code' })
        } catch (_e) {
          // ignore if already prepared
        }
        router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-in', email: emailAddress } })
      }
    } catch (err) {
      console.error('Sign-in failed', err)
      Alert.alert('Sign-in failed', err?.errors?.[0]?.message || 'Please try again')
    }
  }

  const onEmailCodeSignIn = async () => {
    if (!isLoaded) return
    if (!emailAddress) {
      Alert.alert('Email required', 'Enter your email to receive a verification code')
      return
    }
    try {
      await signIn.create({ identifier: emailAddress })
      await signIn.prepareFirstFactor({ strategy: 'email_code' })
      router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-in', email: emailAddress } })
    } catch (err) {
      console.error('Start email code sign-in failed', err)
      Alert.alert('Email code sign-in failed', err?.errors?.[0]?.message || 'Please try again')
    }
  }

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Sign In</Text>
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
      <Button title="Sign In" onPress={onSignInPress} />
      <View style={{ height: 16 }} />
      <Button title="Sign in with Email Code" onPress={onEmailCodeSignIn} />
      <View style={{ height: 16 }} />
      <Button title="Go to Sign Up" onPress={() => router.push('/(auth)/sign-up')} />
    </View>
  )
}
