import { useState, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-expo'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { useToast } from '../context/toast'

/**
 * useLogout - shared logout logic with confirmation, state, and navigation.
 * Options:
 *  - confirm (default true): whether to show confirmation dialog
 *  - redirectTo (default '/(auth)/sign-in'): route to replace after logout
 *  - showToast (default true)
 *  - confirmTitle/confirmMessage (override copy)
 */
export function useLogout(options = {}) {
  const {
    confirm = true,
    redirectTo = '/(auth)/sign-in',
    showToast = true,
    confirmTitle = 'Log Out',
    confirmMessage = 'Are you sure you want to log out?'
  } = options
  const { signOut } = useAuth()
  const toast = useToast()
  const [signingOut, setSigningOut] = useState(false)

  const performLogout = useCallback(async () => {
    if (signingOut) return
    try {
      setSigningOut(true)
      await signOut()
      if (showToast) {
        try { toast.show('Logged out', { type: 'success' }) } catch {}
      }
      router.replace(redirectTo)
    } catch (e) {
      console.log('Logout failed', e?.message)
      if (showToast) {
        try { toast.show('Logout failed', { type: 'error' }) } catch {}
      }
    } finally {
      setSigningOut(false)
    }
  }, [signingOut, signOut, toast, showToast, redirectTo])

  const requestLogout = useCallback(() => {
    if (signingOut) return
    if (!confirm) return performLogout()
    Alert.alert(confirmTitle, confirmMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => performLogout() }
    ])
  }, [confirm, performLogout, signingOut, confirmTitle, confirmMessage])

  return { signingOut, logout: requestLogout, immediateLogout: performLogout }
}
