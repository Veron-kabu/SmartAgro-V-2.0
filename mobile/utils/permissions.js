// Centralized camera & microphone permission handling
// Provides: requestCallPermissions, checkCallPermissions
// Uses expo-camera for both camera & mic requests.

export async function requestCallPermissions() {
	try {
		const { Camera } = await import('expo-camera')
		const cam = await Camera.requestCameraPermissionsAsync()
		const mic = await Camera.requestMicrophonePermissionsAsync()
		return {
			cameraGranted: cam.status === 'granted',
			microphoneGranted: mic.status === 'granted',
			allGranted: cam.status === 'granted' && mic.status === 'granted'
		}
	} catch (e) {
		return { cameraGranted: false, microphoneGranted: false, allGranted: false, error: e?.message || 'permission_error' }
	}
}

export async function checkCallPermissions() {
	try {
		const { Camera } = await import('expo-camera')
		const cam = await Camera.getCameraPermissionsAsync?.()
		const mic = await Camera.getMicrophonePermissionsAsync?.()
		return {
			cameraGranted: cam?.status === 'granted',
			microphoneGranted: mic?.status === 'granted',
			allGranted: cam?.status === 'granted' && mic?.status === 'granted'
		}
	} catch (e) {
		return { cameraGranted: false, microphoneGranted: false, allGranted: false, error: e?.message || 'permission_error' }
	}
}

// Prewarm helper: If not granted, request once silently
export async function prewarmCallPermissions() {
	const current = await checkCallPermissions()
	if (current.allGranted) return current
	return await requestCallPermissions()
}

