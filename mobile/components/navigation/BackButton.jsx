import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { getLastRoute } from '../../utils/navHistory'

/**
 * Reusable Back Button Component
 * Can be used in headers or anywhere in the app for navigation
 * 
 * Navigation Priority:
 * 1. Always tries router.back() first (previous screen in history)
 * 2. Only uses fallbackRoute if no navigation history exists
 * 3. Defaults to /home as final fallback
 * 
 * @param {Object} props - Component props
 * @param {Function} props.onPress - Custom onPress handler (optional)
 * @param {string} props.color - Icon color (optional, defaults to COLORS.surface)
 * @param {number} props.size - Icon size (optional, defaults to 24)
 * @param {Object} props.style - Additional styles (optional)
 * @param {string} props.fallbackRoute - Route to navigate to if no history exists (optional)
 * @param {boolean} props.safeNavigation - Use safe navigation with error handling (optional, defaults to true)
 */
export default function BackButton({ 
  onPress, 
  color = COLORS.surface, 
  size = 24, 
  style = {},
  fallbackRoute = null,
  safeNavigation = true,
  stackKey = null, // optional: use to select a smarter fallback based on last route visited in that stack
}) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      // Use custom onPress handler if provided
      onPress();
      return;
    }

    // Default back navigation behavior
    if (safeNavigation) {
      // Safe navigation with error handling
      const frame = requestAnimationFrame(() => {
        try {
          // Always prioritize actual navigation history
          if (router.canGoBack()) {
            router.back();
          } else {
            // Only use fallback if no navigation history exists
            console.log('No navigation history, using fallback route');
            const dynamicFallback = stackKey ? (getLastRoute(stackKey) || fallbackRoute) : fallbackRoute
            if (dynamicFallback) {
              router.replace(dynamicFallback);
            } else {
              // Default fallback to home only as last resort
              router.replace('/home');
            }
          }
        } catch (_error) {
          console.log('Back navigation deferred, retrying...');
          setTimeout(() => {
            try {
              if (router.canGoBack()) {
                router.back();
              } else {
                console.log('Retry: No navigation history, using fallback');
                const dynamicFallback2 = stackKey ? (getLastRoute(stackKey) || fallbackRoute) : fallbackRoute
                if (dynamicFallback2) {
                  router.replace(dynamicFallback2);
                } else {
                  router.replace('/home');
                }
              }
            } catch (_retryError) {
              console.warn('Navigation failed after retry');
            }
          }, 500);
        }
      });
      return () => cancelAnimationFrame(frame);
    } else {
      // Simple navigation without error handling
      if (router.canGoBack()) {
        router.back();
      } else {
        // Only use fallback if no navigation history exists
        console.log('No navigation history, using fallback route');
        if (fallbackRoute) {
          router.replace(fallbackRoute);
        } else {
          router.replace('/home');
        }
      }
    }
  };

  return (
    <TouchableOpacity
      style={[styles.backButton, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons name="arrow-back" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
    marginLeft: -8, // Adjust for better header alignment
    justifyContent: 'center',
    alignItems: 'center',
  },
});