import Constants from 'expo-constants'

const extra = (Constants?.expoConfig?.extra) || {}

export const ZEGO_APP_ID = Number(extra.zegoAppId) || 0
export const ZEGO_APP_SIGN = String(extra.zegoAppSign || '')

export function ensureZegoKeys() {
  if (!ZEGO_APP_ID || !ZEGO_APP_SIGN) {
    console.warn('[Zego] Missing ZEGO keys. Set EXPO_PUBLIC_ZEGO_APP_ID and EXPO_PUBLIC_ZEGO_APP_SIGN in your env and rebuild the dev client.')
  }
}
