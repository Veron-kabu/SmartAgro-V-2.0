"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useAuth, useUser } from "@clerk/clerk-expo"
import { getJSON, postJSON, setAuthTokenGetter } from "./api"

const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5001"

const ProfileContext = createContext({
  profile: null,
  refresh: async () => {},
  loading: true,
  error: null,
})

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { getToken, isSignedIn } = useAuth()
  const { user } = useUser()
  const jwtTemplate = process.env.EXPO_PUBLIC_CLERK_JWT_TEMPLATE

  useEffect(() => {
    setAuthTokenGetter(async () => {
      if (isSignedIn) {
        // Use a Clerk JWT template if provided (recommended for backend auth);
        // falls back to default token if not set.
        try {
          const token = await getToken(jwtTemplate ? { template: jwtTemplate } : undefined)
          return token ?? null
        } catch (e) {
          console.warn("Failed to get Clerk token", e)
          return null
        }
      }
      return null
    })
  }, [getToken, isSignedIn, jwtTemplate])

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      let p = await getJSON(`${apiUrl}/api/users/profile`)
      setProfile(p)
    } catch (err) {
      // If profile doesn't exist yet (404), attempt to create it using Clerk user info
      if (typeof err?.message === "string" && err.message.includes("404") && user) {
        try {
          const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress
          const derivedUsername =
            user.username || (email ? email.split("@")[0] : `user_${(user.id || "").slice(-6)}`)
          const full_name = [user.firstName, user.lastName].filter(Boolean).join(" ") || null
          const phone = user.phoneNumbers?.[0]?.phoneNumber || null
          await postJSON(`${apiUrl}/api/users`, {
            username: derivedUsername,
            email,
            full_name,
            phone,
          })
          // Re-fetch after creating
          const created = await getJSON(`${apiUrl}/api/users/profile`)
          setProfile(created)
          setError(null)
        } catch (createErr) {
          console.error("Profile auto-create failed:", createErr)
          setError(createErr.message)
          setProfile(null)
        }
      } else {
        console.error("Profile fetch error:", err)
        setError(err.message)
        setProfile(null)
      }
    } finally {
      setLoading(false)
    }
  }, [isSignedIn, user])

  useEffect(() => {
    refresh()
  }, [isSignedIn, refresh])

  return <ProfileContext.Provider value={{ profile, refresh, loading, error }}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  return useContext(ProfileContext)
}
