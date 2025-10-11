import React, { useRef } from 'react';
import { View, PanResponder } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

/**
 * Global Swipe Back Gesture Component
 * Provides swipe-to-go-back functionality across the entire app
 * 
 * Navigation Priority:
 * 1. Always tries router.back() first (previous screen in history)
 * 2. Only uses fallbackRoute if no navigation history exists
 * 3. Defaults to /home as final fallback
 * 
 * Features:
 * - Edge swipe detection (left edge of screen)
 * - Haptic feedback on successful swipe
 * - Configurable sensitivity and thresholds
 * - Performance optimized with minimal re-renders
 * - Works with Expo Router navigation
 * 
 * Usage: Place once in root layout or wrap your main content
 */
export default function SwipeBackGesture({ 
  children,
  edgeWidth = 50,           // Width of edge area that triggers swipe (pixels)
  threshold = 80,           // Minimum swipe distance to trigger navigation (pixels)
  velocityThreshold = 0.3,  // Minimum swipe velocity to trigger navigation
  enabled = true,           // Enable/disable gesture
  hapticFeedback = true,    // Enable haptic feedback
  fallbackRoute = null,     // Fallback route if can't go back
  onSwipeStart = null,      // Callback when swipe starts
  onSwipeEnd = null,        // Callback when swipe ends
  onNavigate = null,        // Callback when navigation occurs
}) {
  const router = useRouter();
  const swipeStartRef = useRef(null);
  const isSwipingRef = useRef(false);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      if (!enabled) return false;
      
      // Only respond to touches near the left edge
      const touchX = evt.nativeEvent.pageX;
      return touchX <= edgeWidth;
    },

    onMoveShouldSetPanResponder: (evt, gestureState) => {
      if (!enabled) return false;
      
      // Only respond if starting from left edge and moving right
      const touchX = evt.nativeEvent.pageX;
      const isFromEdge = touchX <= edgeWidth || (swipeStartRef.current && swipeStartRef.current <= edgeWidth);
      const isMovingRight = gestureState.dx > 10;
      const isNotVertical = Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
      
      return isFromEdge && isMovingRight && isNotVertical;
    },

    onPanResponderGrant: (evt) => {
      // Store the starting position
      swipeStartRef.current = evt.nativeEvent.pageX;
      isSwipingRef.current = true;
      
      // Trigger haptic feedback on gesture start
      if (hapticFeedback) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Call custom callback
      if (onSwipeStart) {
        onSwipeStart(evt);
      }
    },

    onPanResponderMove: (evt, gestureState) => {
      // Optional: You can add visual feedback here (like iOS edge swipe indicator)
      // For now, we'll just track the movement
    },

    onPanResponderRelease: (evt, gestureState) => {
      isSwipingRef.current = false;
      
      // Check if swipe meets criteria for navigation
      const swipeDistance = gestureState.dx;
      const swipeVelocity = gestureState.vx;
      const shouldNavigate = swipeDistance >= threshold || swipeVelocity >= velocityThreshold;
      
      if (shouldNavigate) {
        // Trigger success haptic feedback
        if (hapticFeedback) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        
        // Perform navigation
        performNavigation();
        
        // Call custom callback
        if (onNavigate) {
          onNavigate({ distance: swipeDistance, velocity: swipeVelocity });
        }
      }
      
      // Call end callback
      if (onSwipeEnd) {
        onSwipeEnd({ 
          distance: swipeDistance, 
          velocity: swipeVelocity, 
          navigated: shouldNavigate 
        });
      }
      
      // Reset refs
      swipeStartRef.current = null;
    },

    onPanResponderTerminate: () => {
      // Reset state if gesture is terminated
      isSwipingRef.current = false;
      swipeStartRef.current = null;
      
      if (onSwipeEnd) {
        onSwipeEnd({ distance: 0, velocity: 0, navigated: false, terminated: true });
      }
    },
  });

  const performNavigation = () => {
    try {
      // Always try to go back to the previous screen first
      if (router.canGoBack()) {
        router.back();
      } else {
        // Only use fallback if there's no navigation history
        console.log('No navigation history, using fallback route');
        if (fallbackRoute) {
          router.replace(fallbackRoute);
        } else {
          // Default fallback to home only as last resort
          router.replace('/home');
        }
      }
    } catch (error) {
      console.warn('Swipe navigation failed:', error);
      
      // Retry navigation after a short delay
      setTimeout(() => {
        try {
          if (router.canGoBack()) {
            router.back();
          } else {
            console.log('Retry: No navigation history, using fallback');
            if (fallbackRoute) {
              router.replace(fallbackRoute);
            } else {
              router.replace('/home');
            }
          }
        } catch (retryError) {
          console.error('Swipe navigation retry failed:', retryError);
        }
      }, 100);
    }
  };

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      {children}
    </View>
  );
}

/**
 * HOC version for wrapping specific screens
 */
export function withSwipeBack(WrappedComponent, gestureOptions = {}) {
  return function SwipeBackWrapper(props) {
    return (
      <SwipeBackGesture {...gestureOptions}>
        <WrappedComponent {...props} />
      </SwipeBackGesture>
    );
  };
}

/**
 * Hook for programmatically accessing swipe gesture state
 */
export function useSwipeBackGesture() {
  const router = useRouter();
  
  const triggerSwipeBack = (options = {}) => {
    const { hapticFeedback = true, fallbackRoute = null } = options;
    
    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      // Always prioritize actual navigation history
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
    } catch (error) {
      console.warn('Programmatic swipe back failed:', error);
    }
  };
  
  return {
    triggerSwipeBack,
    canGoBack: router.canGoBack(),
  };
}