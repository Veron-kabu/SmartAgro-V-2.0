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
  edges = 'left',           // 'left' | 'right' | 'both' — which screen edges activate the gesture
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
  const startEdgeRef = useRef(null); // 'left' | 'right' | null

  const allowLeft = edges === 'left' || edges === 'both';
  const allowRight = edges === 'right' || edges === 'both';

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      if (!enabled) return false;
      
      // Respond to touches near configured edges
      const touchX = evt.nativeEvent.pageX;
      const fromLeft = allowLeft && touchX <= edgeWidth;
      // We don't have screenWidth in event; use Dimensions
      const { width } = require('react-native').Dimensions.get('window');
      const fromRight = allowRight && touchX >= (width - edgeWidth);
      return fromLeft || fromRight;
    },

    onMoveShouldSetPanResponder: (evt, gestureState) => {
      if (!enabled) return false;
      
      // Respond if starting from configured edges and moving inward
      const touchX = evt.nativeEvent.pageX;
      const { width } = require('react-native').Dimensions.get('window');
      const startedLeft = allowLeft && (touchX <= edgeWidth || (swipeStartRef.current != null && swipeStartRef.current <= edgeWidth));
      const startedRight = allowRight && (touchX >= (width - edgeWidth) || (swipeStartRef.current != null && swipeStartRef.current >= (width - edgeWidth)));
      const isMovingRight = gestureState.dx > 10;
      const isMovingLeft = gestureState.dx < -10;
      const isNotVertical = Math.abs(gestureState.dy) < Math.abs(gestureState.dx);
      
      const leftOk = startedLeft && isMovingRight;
      const rightOk = startedRight && isMovingLeft;
      return (leftOk || rightOk) && isNotVertical;
    },

    onPanResponderGrant: (evt) => {
      // Store the starting position
      swipeStartRef.current = evt.nativeEvent.pageX;
      isSwipingRef.current = true;
      const { width } = require('react-native').Dimensions.get('window');
      startEdgeRef.current = (allowLeft && swipeStartRef.current <= edgeWidth)
        ? 'left'
        : (allowRight && swipeStartRef.current >= (width - edgeWidth))
          ? 'right'
          : null;
      
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
      const swipeDistance = gestureState.dx; // positive = right, negative = left
      const swipeVelocity = gestureState.vx; // positive = right, negative = left
      const distanceOk = Math.abs(swipeDistance) >= threshold;
      const velocityOk = Math.abs(swipeVelocity) >= velocityThreshold;
      // Direction must be inward relative to the edge we started from
      const fromLeftOK = startEdgeRef.current === 'left' && swipeDistance > 0;
      const fromRightOK = startEdgeRef.current === 'right' && swipeDistance < 0;
      const shouldNavigate = (distanceOk || velocityOk) && (fromLeftOK || fromRightOK);
      
      if (shouldNavigate) {
        // Trigger success haptic feedback
        if (hapticFeedback) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        
        // Perform navigation
        performNavigation();
        
        // Call custom callback
        if (onNavigate) {
          onNavigate({ distance: swipeDistance, velocity: swipeVelocity, edge: startEdgeRef.current });
        }
      }
      
      // Call end callback
      if (onSwipeEnd) {
        onSwipeEnd({ 
          distance: swipeDistance, 
          velocity: swipeVelocity, 
          navigated: shouldNavigate,
          edge: startEdgeRef.current,
        });
      }
      
      // Reset refs
      swipeStartRef.current = null;
      startEdgeRef.current = null;
    },

    onPanResponderTerminate: () => {
      // Reset state if gesture is terminated
      isSwipingRef.current = false;
      swipeStartRef.current = null;
      startEdgeRef.current = null;
      
      if (onSwipeEnd) {
        onSwipeEnd({ distance: 0, velocity: 0, navigated: false, terminated: true, edge: null });
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