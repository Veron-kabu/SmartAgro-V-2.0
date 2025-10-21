// Use the legacy FileSystem API for compatibility with existing upload helpers (SDK 54+)
// Ref: https://docs.expo.dev/versions/latest/sdk/filesystem/
import * as FileSystem from 'expo-file-system/legacy'
import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { authFetch, postJSON, resolveUrl } from '../context/api'
let Device
try { Device = require('expo-device') } catch { Device = {} }

// API paths (prefer /api prefix to match backend)
const PATHS = {
  uploadToken: '/api/verification/upload-token',
  directUpload: '/api/verification/upload', // optional fallback if server provides
  submission: '/api/verification/submission',
}

// Code issuance removed; no longer used

// Try to get an upload token (presigned URL). If not available, return null and caller may fallback.
export async function getUploadToken(filename, contentType, opts = {}) {
  try {
    const payload = { filename, contentType, ...(opts?.noAcl ? { noAcl: true } : {}) }
    const res = await postJSON(PATHS.uploadToken, payload)
    return res // { uploadUrl, uploadKey, contentType }
  } catch (e) {
    // 404/501 means not implemented on server; allow fallback
    if (e?.status === 404 || e?.status === 501) return null
    throw e
  }
}

// Upload a file to a presigned URL via PUT
export async function uploadToPresignedUrl(uploadUrl, fileUri, contentType, acl) {
  const fileInfo = await FileSystem.getInfoAsync(fileUri)
  if (!fileInfo.exists) throw new Error('File not found for upload')
  const headers = {}
  if (contentType) headers['Content-Type'] = contentType
  // No ACL needed for verification uploads
  let result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers,
  })
  if (result.status === 403 && acl) {
  // No ACL retries needed; ACLs are never used for verification uploads
    const headers2 = {}
    if (contentType) headers2['Content-Type'] = contentType
    result = await FileSystem.uploadAsync(uploadUrl, fileUri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: headers2,
    })
  }
  if (result.status >= 400) {
    const body = result.body || ''
    let detail = ''
    try {
      const code = /<Code>([^<]+)<\/Code>/i.exec(body)?.[1]
      const msg = /<Message>([^<]+)<\/Message>/i.exec(body)?.[1]
      const region = /<Region>([^<]+)<\/Region>/i.exec(body)?.[1]
      if (code || msg || region) {
        detail = ` ${code || ''}${msg ? ` - ${msg}` : ''}${region ? ` (region: ${region})` : ''}`.trim()
      }
    } catch {}
    const err = new Error(`Upload failed: ${result.status}${detail ? ` — ${detail}` : ''}`)
    err.body = body
    throw err
  }
  return true
}

// Fallback: direct upload to backend (multipart)
export async function directUploadToBackend(fileUri, fieldName = 'file') {
  const url = resolveUrl(PATHS.directUpload)
  const form = new FormData()
  // Derive a filename
  const name = fileUri.split('/').pop() || `capture_${Date.now()}.jpg`
  form.append(fieldName, { uri: fileUri, name, type: 'image/jpeg' })
  const res = await authFetch(url, { method: 'POST', body: form, headers: {} })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`Direct upload failed: ${res.status}`)
    err.body = text
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  if (!ct.includes('application/json')) return { url: await res.text() }
  return await res.json()
}

export function buildDeviceInfo() {
  return {
    platform: Device?.osName || Constants?.platform || 'unknown',
    os_version: Device?.osVersion || null,
    app_version: Constants?.expoConfig?.version || Constants?.manifest?.version || null,
    device_model: Device?.modelName || null,
    is_rooted_or_jailbroken_flag: false, // not reliably detectable with Expo managed; leave false
  }
}

export async function submitVerification(payload) {
  // payload: { code, images:[{uploadKey, lat, lng, accuracy, timestamp, photo_index}], device_info, offline?: boolean }
  return postJSON(PATHS.submission, payload)
}

// Offline queue helpers
const QUEUE_KEY = 'verification_queue_v1'

export async function enqueueVerification(draft) {
  const existing = await AsyncStorage.getItem(QUEUE_KEY)
  const list = existing ? JSON.parse(existing) : []
  list.push({ id: Date.now(), ...draft })
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(list))
  return list[list.length - 1]
}

export async function listQueuedVerifications() {
  const existing = await AsyncStorage.getItem(QUEUE_KEY)
  return existing ? JSON.parse(existing) : []
}

export async function removeQueuedVerification(id) {
  const existing = await AsyncStorage.getItem(QUEUE_KEY)
  const list = existing ? JSON.parse(existing) : []
  const next = list.filter((x) => x.id !== id)
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(next))
}
