import { useSignUp, useSignIn } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { View, Text, TextInput, Button, Alert } from 'react-native'

export default function VerifyScreen() {
  const router = useRouter()
  const { email, mode } = useLocalSearchParams()
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } = useSignUp()
  const { isLoaded: signInLoaded, signIn, setActive: setActiveFromSignIn } = useSignIn()
  const [code, setCode] = useState('')
  const [emailInput, setEmailInput] = useState(email ? String(email) : '')

  const onVerifyPress = async () => {
    try {
      const codeVal = String(code || '').trim()
      const emailVal = String(emailInput || '').trim()
      if (mode === 'sign-up') {
        if (signUpLoaded && signUp?.attemptEmailAddressVerification) {
          try {
            const result = await signUp.attemptEmailAddressVerification({ code: codeVal })
            if (result.status === 'complete') {
              await setActiveFromSignUp({ session: result.createdSessionId })
              router.replace('/')
              return
            }
            // Not complete: fall through to reload check
          } catch (err) {
            // If error says already verified, try to complete session
            console.warn('Sign-up verify error:', err)
            try {
              await signUp.reload?.()
              if (signUp.status === 'complete' && signUp.createdSessionId) {
                await setActiveFromSignUp({ session: signUp.createdSessionId })
                router.replace('/')
                return
              }
            } catch (_) {}
            throw err
          }
          // Final fallback
          await signUp.reload?.()
          if (signUp.status === 'complete' && signUp.createdSessionId) {
            await setActiveFromSignUp({ session: signUp.createdSessionId })
            router.replace('/')
            return
          }
        }
      } else if (mode === 'sign-in') {
        if (signInLoaded && signIn?.attemptFirstFactor) {
          if (!emailVal) {
            Alert.alert('Email required', 'Enter your email to verify the code')
            return
          }
          try {
            await signIn.create({ identifier: emailVal })
          } catch (_e) {
            // ignore if already set
          }
          try {
            const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: codeVal })
            if (result.status === 'complete') {
              await setActiveFromSignIn({ session: result.createdSessionId })
              router.replace('/')
              return
            }
          } catch (err) {
            console.warn('Sign-in first factor error:', err)
            throw err
          }
        }
      } else {
        // Fallback: try sign-up first, then sign-in
        if (signUpLoaded && signUp?.attemptEmailAddressVerification) {
          const result = await signUp.attemptEmailAddressVerification({ code })
          if (result.status === 'complete') {
            await setActiveFromSignUp({ session: result.createdSessionId })
            router.replace('/')
            return
          }
        }
        if (signInLoaded && signIn?.attemptFirstFactor) {
          if (!emailVal) {
            Alert.alert('Email required', 'Enter your email to verify the code')
            return
          }
          try {
            await signIn.create({ identifier: emailVal })
          } catch (_e) {}
          try {
            const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: codeVal })
            if (result.status === 'complete') {
              await setActiveFromSignIn({ session: result.createdSessionId })
              router.replace('/')
              return
            }
          } catch (err) {
            console.warn('Sign-in fallback first factor error:', err)
            throw err
          }
        }
      }

      Alert.alert('Verification', 'Unable to verify. Check the code and try again. If it persists, tap Resend Code.')
    } catch (err) {
      console.error('Verification failed', err)
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Please try again'
      Alert.alert('Verification failed', String(msg))
    }
  }

  const onResendCode = async () => {
    try {
      if (mode === 'sign-up') {
        if (signUpLoaded && signUp?.prepareEmailAddressVerification) {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
          Alert.alert('Code sent', 'Please check your email for a new code')
          return
        }
      } else if (mode === 'sign-in') {
        if (signInLoaded && signIn) {
          if (!emailInput) {
            Alert.alert('Email required', 'Enter your email to receive a code')
            return
          }
          try {
            await signIn.create({ identifier: String(emailInput) })
          } catch (_e) {}
          await signIn.prepareFirstFactor({ strategy: 'email_code' })
          Alert.alert('Code sent', 'Please check your email for a new code')
          return
        }
      }
      Alert.alert('Unable to resend', 'Please go back and start the flow again')
    } catch (e) {
      console.error('Resend code failed', e)
      Alert.alert('Resend failed', e?.errors?.[0]?.message || 'Please try again')
    }
  }

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Verify Email</Text>
      <TextInput
        placeholder="Email (required for sign-in via code)"
        value={emailInput}
        onChangeText={setEmailInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}
      />
      <TextInput
        placeholder="Verification Code"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 12, borderRadius: 8 }}
      />
      <Button title="Verify" onPress={onVerifyPress} />
      <View style={{ height: 12 }} />
      <Button title="Resend Code" onPress={onResendCode} />
    </View>
  )
}
