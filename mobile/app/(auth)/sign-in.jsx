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
          await signIn.reload?.()
          const factors = Array.isArray(signIn.supportedFirstFactors) ? signIn.supportedFirstFactors : []
          const emailCodeFactor = factors.find((f) => f?.strategy === 'email_code' && f?.emailAddressId)
          if (emailCodeFactor?.emailAddressId) {
            await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailCodeFactor.emailAddressId })
          } else {
            await signIn.prepareFirstFactor({ strategy: 'email_code' })
          }
        } catch (_e) {
          Alert.alert('Cannot send code', 'We could not prepare email verification. Please try again.')
          return
        }
  router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-in', email: emailAddress, sentAt: Date.now() } })
      }
    } catch (err) {
      console.error('Sign-in failed', err)
      Alert.alert('Sign-in failed', err?.errors?.[0]?.message || 'Please try again')
    }
  }

  const onEmailCodeSignIn = async () => {
    if (!isLoaded) return
    const email = String(emailAddress || '').trim()
    if (!email) {
      Alert.alert('Email required', 'Enter your email to receive a verification code')
      return
    }
    try {
      // Ensure we operate on the latest signIn object state
      await signIn.reload?.()

      // Only create if we don't already have the same identifier in the current flow
      const currentId = (signIn && signIn.identifier) ? String(signIn.identifier).toLowerCase() : ''
      if (!currentId || currentId !== email.toLowerCase()) {
        try {
          await signIn.create({ identifier: email })
        } catch (_e) {
          // If an older sign-in exists, reload and continue; do not hard-fail here
          // Common Clerk error: "Update operations are not allowed on older sign ins"
          await signIn.reload?.()
        }
      }

      // Prepare the email code factor (pass emailAddressId when possible)
      try {
        await signIn.reload?.()
        const factors = Array.isArray(signIn.supportedFirstFactors) ? signIn.supportedFirstFactors : []
        const emailCodeFactor = factors.find((f) => f?.strategy === 'email_code' && f?.emailAddressId)
        if (emailCodeFactor?.emailAddressId) {
          await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailCodeFactor.emailAddressId })
        } else {
          await signIn.prepareFirstFactor({ strategy: 'email_code' })
        }
      } catch (_prepErr) {
        Alert.alert('Cannot send code', 'We could not send a verification code. Please try again.')
        return
      }

  router.push({ pathname: '/(auth)/verify', params: { mode: 'sign-in', email, sentAt: Date.now() } })
    } catch (err) {
      console.error('Start email code sign-in failed', err)
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Please try again'
      Alert.alert('Email code sign-in failed', String(msg))
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
