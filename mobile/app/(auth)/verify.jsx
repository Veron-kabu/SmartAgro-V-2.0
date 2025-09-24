import { useSignUp, useSignIn } from '@clerk/clerk-expo'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Text, TextInput, View } from 'react-native'

const COOLDOWN_SECONDS = 60

export default function VerifyScreen() {
  const router = useRouter()
  const { email, mode, sentAt } = useLocalSearchParams()
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveFromSignUp } = useSignUp()
  const { isLoaded: signInLoaded, signIn, setActive: setActiveFromSignIn } = useSignIn()

  const [emailInput, setEmailInput] = useState(email ? String(email) : '')
  const initialEmail = (email ? String(email) : '').trim().toLowerCase()

  const [lastSentAt, setLastSentAt] = useState(() => {
    const ts = Number(sentAt)
    return Number.isFinite(ts) && ts > 0 ? ts : Date.now()
  })
  const [resendIn, setResendIn] = useState(0)

  // 6-digit segmented input state
  const [codeDigits, setCodeDigits] = useState(Array(6).fill(''))
  const [code, setCode] = useState('')
  const inputRefs = useRef([])
  const [isVerifying, setIsVerifying] = useState(false)
  const lastAutoSubmitCodeRef = useRef('')

  // Cooldown ticker
  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - lastSentAt) / 1000)
      const remaining = Math.max(0, COOLDOWN_SECONDS - elapsed)
      setResendIn(remaining)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lastSentAt])

  function updateCodeFromDigits(nextDigits) {
    setCode(nextDigits.join(''))
  }

  function handleDigitChange(index, value) {
    const digits = String(value || '').replace(/\D/g, '')
    setCodeDigits((prev) => {
      const next = [...prev]
      if (digits.length <= 1) {
        next[index] = digits
        updateCodeFromDigits(next)
        if (digits && index < 5) {
          const nextRef = inputRefs.current[index + 1]
          nextRef && nextRef.focus?.()
        }
        return next
      }
      // Handle paste of multiple digits into a single cell
      let i = index
      for (const d of digits) {
        if (i > 5) break
        next[i++] = d
      }
      updateCodeFromDigits(next)
      const focusIndex = Math.min(5, index + digits.length)
      const fRef = inputRefs.current[focusIndex]
      fRef && fRef.focus?.()
      return next
    })
  }

  function handleKeyPress(index, e) {
    if (e?.nativeEvent?.key === 'Backspace') {
      setCodeDigits((prev) => {
        const next = [...prev]
        if (!next[index] && index > 0) {
          const prevIndex = index - 1
          next[prevIndex] = ''
          updateCodeFromDigits(next)
          const pRef = inputRefs.current[prevIndex]
          pRef && pRef.focus?.()
          return next
        }
        next[index] = ''
        updateCodeFromDigits(next)
        return next
      })
    }
  }

  // Build a callable verify function in a ref so effects can call it without re-deps churn
  const verifyRef = useRef(null)
  useEffect(() => {
    verifyRef.current = async () => {
      if (isVerifying) return
      setIsVerifying(true)
      try {
        const codeVal = String(code || '').trim()
        const cleanCode = codeVal.replace(/\D/g, '')
        if (cleanCode.length < 6) {
          Alert.alert('Invalid code', 'Please enter the 6-digit code we emailed you')
          return
        }
        const emailVal = String(emailInput || '').trim()

        if (mode === 'sign-up') {
          if (signUpLoaded && signUp?.attemptEmailAddressVerification) {
            await signUp.reload?.()
            if (!signUp.emailAddressId && emailVal) {
              try {
                await signUp.create({ emailAddress: emailVal })
                await signUp.reload?.()
              } catch (_e) {}
            }
            try {
              const result = await signUp.attemptEmailAddressVerification({ code: cleanCode })
              if (result.status === 'complete') {
                await setActiveFromSignUp({ session: result.createdSessionId })
                router.replace('/')
                return
              }
            } catch (err) {
              console.warn('Sign-up verify error:', err)
              try {
                await signUp.reload?.()
                if (signUp.status === 'complete' && signUp.createdSessionId) {
                  await setActiveFromSignUp({ session: signUp.createdSessionId })
                  router.replace('/')
                  return
                }
              } catch (_e) {}
              throw err
            }
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
            await signIn.reload?.()
            const currentId = (signIn && signIn.identifier) ? String(signIn.identifier).toLowerCase() : ''
            if (!currentId || currentId !== emailVal.toLowerCase()) {
              try {
                await signIn.create({ identifier: emailVal })
              } catch (_e) {
                await signIn.reload?.()
              }
            }
            // Do NOT prepare here; that would invalidate the old code
            try {
              const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: cleanCode })
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
          // Fallbacks
          if (signUpLoaded && signUp?.attemptEmailAddressVerification) {
            const result = await signUp.attemptEmailAddressVerification({ code: cleanCode })
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
            await signIn.reload?.()
            try {
              const result = await signIn.attemptFirstFactor({ strategy: 'email_code', code: cleanCode })
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
      } finally {
        setIsVerifying(false)
      }
    }
  }, [code, emailInput, isVerifying, mode, router, setActiveFromSignIn, setActiveFromSignUp, signIn, signInLoaded, signUp, signUpLoaded])

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    const allFilled = codeDigits.every((d) => d && d.length === 1)
    if (allFilled && !isVerifying) {
      const joined = codeDigits.join('')
      if (lastAutoSubmitCodeRef.current === joined) {
        return
      }
      lastAutoSubmitCodeRef.current = joined
      const t = setTimeout(() => {
        verifyRef.current && verifyRef.current()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [codeDigits, isVerifying])

  async function onVerifyPress() {
    if (verifyRef.current) {
      await verifyRef.current()
    }
  }

  async function onResendCode() {
    try {
      if (mode === 'sign-up') {
        if (signUpLoaded && signUp?.prepareEmailAddressVerification) {
          await signUp.reload?.()
          let emailId = signUp.emailAddressId
          if (!emailId && emailInput) {
            try {
              await signUp.create({ emailAddress: String(emailInput).trim() })
              await signUp.reload?.()
              emailId = signUp.emailAddressId
            } catch (_e) {}
          }
          if (emailId) {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code', emailAddressId: emailId })
          } else {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
          }
          setLastSentAt(Date.now())
          // Reset inputs on resend
          setCodeDigits(Array(6).fill(''))
          setCode('')
          lastAutoSubmitCodeRef.current = ''
          Alert.alert('Code sent', 'Please check your email for a new code')
          return
        }
      } else if (mode === 'sign-in') {
        if (signInLoaded && signIn) {
          const emailVal = String(emailInput || '').trim()
          if (!emailVal) {
            Alert.alert('Email required', 'Enter your email to receive a code')
            return
          }
          await signIn.reload?.()
          const currentId = (signIn && signIn.identifier) ? String(signIn.identifier).toLowerCase() : ''
          if (!currentId || currentId !== emailVal.toLowerCase()) {
            try {
              await signIn.create({ identifier: emailVal })
            } catch (_e) {
              await signIn.reload?.()
            }
          }
          const factors = Array.isArray(signIn.supportedFirstFactors) ? signIn.supportedFirstFactors : []
          const emailCodeFactor = factors.find((f) => f?.strategy === 'email_code' && f?.emailAddressId)
          if (emailCodeFactor?.emailAddressId) {
            await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailCodeFactor.emailAddressId })
          } else {
            await signIn.prepareFirstFactor({ strategy: 'email_code' })
          }
          setLastSentAt(Date.now())
          // Reset inputs on resend
          setCodeDigits(Array(6).fill(''))
          setCode('')
          lastAutoSubmitCodeRef.current = ''
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
      <View style={{ backgroundColor: '#eef6ff', borderColor: '#bfdbfe', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <Text style={{ color: '#1d4ed8', fontWeight: '600' }}>
          Code sent to: {emailInput || (email ? String(email) : 'your email')}
        </Text>
        <Text style={{ color: '#1d4ed8' }}>
          at {new Date(lastSentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {resendIn > 0 ? ` • Resend available in ${resendIn}s` : ' • You can resend now'}
        </Text>
      </View>
      <Text style={{ fontSize: 24, marginBottom: 16 }}>Verify Email</Text>
      <TextInput
        placeholder="Email (required for sign-in via code)"
        value={emailInput}
        onChangeText={setEmailInput}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginBottom: 8, borderRadius: 8 }}
      />
      {emailInput.trim().toLowerCase() !== initialEmail && (
        <Text style={{ color: '#b45309', marginBottom: 8 }}>
          You changed the email. The code must match this email. If you requested a code for a different address, tap Resend.
        </Text>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
        {codeDigits.map((d, i) => (
          <TextInput
            key={i}
            ref={(r) => { inputRefs.current[i] = r }}
            value={d}
            onChangeText={(val) => handleDigitChange(i, val)}
            onKeyPress={(e) => handleKeyPress(i, e)}
            keyboardType="number-pad"
            maxLength={1}
            style={{ width: 48, height: 56, borderWidth: 1, borderColor: '#ccc', textAlign: 'center', fontSize: 20, borderRadius: 8 }}
          />
        ))}
      </View>
      <Button title="Verify" onPress={onVerifyPress} />
      <View style={{ height: 12 }} />
      <Button
        title={resendIn > 0 ? `Resend Code (${resendIn}s)` : 'Resend Code'}
        onPress={onResendCode}
        disabled={resendIn > 0}
      />
    </View>
  )
}
