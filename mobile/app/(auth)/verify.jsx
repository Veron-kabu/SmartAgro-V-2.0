import { useSignUp, useSignIn } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  View,
  Text,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { authStyles } from "../../assets/styles/auth.styles"
import { Image } from "expo-image"
import { COLORS } from "../../constants/colors"
import * as ExpoLocation from "expo-location"
import { patchJSON } from "../../context/api"
import { reverseGeocode } from "../../utils/geocoding"

export default function VerifyScreen() {
  const router = useRouter()
  const { email, mode } = useLocalSearchParams()
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } = useSignUp()
  const { isLoaded: signInLoaded, signIn, setActive: setActiveFromSignIn } = useSignIn()
  
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerification = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the verification code')
      return
    }

    setLoading(true)

    try {
      if (mode === 'sign-up') {
        if (!signUpLoaded || !signUp) {
          Alert.alert('Error', 'Sign-up not ready. Please restart the process.')
          return
        }

        console.log('Attempting sign-up verification with code:', code)
        const signUpAttempt = await signUp.attemptEmailAddressVerification({ code })
        console.log('Verification result:', signUpAttempt.status)

        if (signUpAttempt.status === 'complete') {
          await setActiveFromSignUp({ session: signUpAttempt.createdSessionId })
          
          // Capture location after successful sign-up
          try {
            const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
            if (status === 'granted') {
              const { coords } = await ExpoLocation.getCurrentPositionAsync({ 
                accuracy: ExpoLocation.Accuracy.Balanced 
              })
              const lat = coords.latitude
              const lng = coords.longitude
              
              // Get readable place name via reverse geocoding
              let place = null
              try { 
                place = await reverseGeocode(lat, lng) 
              } catch (e) {
                console.warn('Reverse geocoding failed:', e)
              }
              
              // Update user location in backend
              await patchJSON('/api/location', {
                lat,
                lng,
                place_name: place?.placeName || null,
                address_details: place?.address || null,
              })
              console.log('Location captured after sign-up')
            }
          } catch (locErr) {
            console.warn('Location capture failed (non-fatal):', locErr)
            // Don't block user flow if location fails
          }
          
          router.replace('/home')
        } else {
          Alert.alert('Error', 'Verification failed. Please try again.')
          console.error('Verification not complete:', signUpAttempt)
        }
      } else if (mode === 'sign-in') {
        if (!signInLoaded || !signIn) {
          Alert.alert('Error', 'Sign-in not ready. Please restart the process.')
          return
        }

        console.log('Attempting sign-in verification with code:', code)
        const result = await signIn.attemptFirstFactor({ 
          strategy: 'email_code', 
          code: code 
        })
        console.log('Sign-in verification result:', result.status)

        if (result.status === 'complete') {
          await setActiveFromSignIn({ session: result.createdSessionId })
          router.replace('/home')
        } else {
          Alert.alert('Error', 'Verification failed. Please try again.')
        }
      }
    } catch (err) {
      console.error('Verification failed:', err)
      const errorMessage = err?.errors?.[0]?.longMessage || 
                          err?.errors?.[0]?.message || 
                          err?.message || 
                          'Verification failed. Please try again.'
      Alert.alert('Error', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    try {
      if (mode === 'sign-up') {
        if (signUpLoaded && signUp) {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
          Alert.alert('Success', 'New verification code sent!')
        }
      } else if (mode === 'sign-in') {
        if (signInLoaded && signIn) {
          await signIn.prepareFirstFactor({ strategy: 'email_code' })
          Alert.alert('Success', 'New verification code sent!')
        }
      }
    } catch (err) {
      console.error('Resend failed:', err)
      Alert.alert('Error', 'Failed to resend code. Please try again.')
    }
  }

  const handleBack = () => {
    if (mode === 'sign-up') {
      router.push('/(auth)/sign-up')
    } else {
      router.push('/(auth)/sign-in')
    }
  }

  return (
    <View style={authStyles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={authStyles.keyboardView}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={authStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Container */}
          <View style={authStyles.imageContainer}>
            <Image
              source={require("../../assets/images/i3.png")}
              style={authStyles.image}
              contentFit="contain"
            />
          </View>

          {/* Title */}
          <Text style={authStyles.title}>Verify Your Email</Text>
          <Text style={authStyles.subtitle}>
            We&apos;ve sent a verification code to {email ? String(email) : 'your email'}
          </Text>

          <View style={authStyles.formContainer}>
            {/* Verification Code Input */}
            <View style={authStyles.inputContainer}>
              <TextInput
                style={authStyles.textInput}
                placeholder="Enter verification code"
                placeholderTextColor={COLORS.textLight}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                maxLength={6}
              />
            </View>

            {/* Verify Button */}
            <TouchableOpacity
              style={[authStyles.authButton, loading && authStyles.buttonDisabled]}
              onPress={handleVerification}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={authStyles.buttonText}>
                {loading ? "Verifying..." : "Verify Email"}
              </Text>
            </TouchableOpacity>

            {/* Resend Code */}
            <TouchableOpacity 
              style={authStyles.linkContainer} 
              onPress={handleResendCode}
            >
              <Text style={authStyles.linkText}>
                Didn&apos;t receive the code? <Text style={authStyles.link}>Resend</Text>
              </Text>
            </TouchableOpacity>

            {/* Back Button */}
            <TouchableOpacity style={authStyles.linkContainer} onPress={handleBack}>
              <Text style={authStyles.linkText}>
                <Text style={authStyles.link}>
                  Back to {mode === 'sign-up' ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}
