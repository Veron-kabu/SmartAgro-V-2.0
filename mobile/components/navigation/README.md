# Navigation Components

This folder contains reusable navigation components that can be used throughout the app.

## Components

### 1. BackButton Component
A reusable back navigation button for headers and UI elements.

### 2. SwipeBackGesture Component ⭐ NEW
Global swipe-to-go-back gesture that works across the entire app.

---

## BackButton Component

A reusable back navigation button that provides consistent navigation behavior across the app.

### Location
```
components/navigation/BackButton.jsx
```

### Import
```javascript
import { BackButton } from '../../components/navigation';
// or
import BackButton from '../../components/navigation/BackButton';
```

### Basic Usage

**1. Simple Back Button (default behavior):**
```jsx
<BackButton />
```

**2. Custom color and size:**
```jsx
<BackButton 
  color="#333" 
  size={20}
/>
```

**3. Custom onPress handler:**
```jsx
<BackButton 
  onPress={() => {
    // Custom logic before navigation
    setCurrentChatRoom(null);
    router.back();
  }}
/>
```

**4. With fallback route:**
```jsx
<BackButton 
  fallbackRoute="/home"
  color={COLORS.surface}
/>
```

**5. Custom styling:**
```jsx
<BackButton 
  style={styles.customBackButton}
  color="#fff"
  size={24}
/>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onPress` | Function | `undefined` | Custom press handler. If provided, overrides default navigation |
| `color` | String | `COLORS.surface` | Icon color |
| `size` | Number | `24` | Icon size |
| `style` | Object | `{}` | Additional styles for the button container |
| `fallbackRoute` | String | `null` | Route to navigate to if `router.back()` fails |
| `safeNavigation` | Boolean | `true` | Use safe navigation with error handling |

### Features

- **Safe Navigation**: Handles navigation timing issues with error handling
- **Previous Screen Priority**: Always tries to go back to actual previous screen first
- **Smart Fallbacks**: Only uses fallback routes when no navigation history exists
- **Customizable**: Supports custom colors, sizes, and styles
- **Consistent Behavior**: Provides the same navigation experience across the app
- **Error Resilient**: Includes retry logic for failed navigation attempts

### Navigation Behavior

The BackButton follows this priority order:

1. 🎯 **`router.back()`** - Goes to the actual previous screen in navigation history
2. 🔄 **`fallbackRoute`** - Only used if no navigation history exists  
3. 🏠 **`/home`** - Final fallback if no fallbackRoute is specified

This ensures users always return to where they came from, rather than being redirected to arbitrary routes.

### Usage Examples in Different Contexts

**Header Navigation:**
```jsx
// In useLayoutEffect for header configuration
navigation.setOptions({
  headerLeft: () => (
    <BackButton 
      color={COLORS.surface}
      fallbackRoute="/chat"
    />
  ),
});
```

**Chat Interface:**
```jsx
<BackButton 
  onPress={() => {
    setCurrentChatRoom(null);
    router.back();
  }}
  color={COLORS.surface}
  fallbackRoute="/chat"
/>
```

**Product Detail:**
```jsx
<BackButton 
  color="#333"
  size={20}
  style={styles.navBtn}
  fallbackRoute="/home"
/>
```

**Form/Modal:**
```jsx
<BackButton 
  onPress={() => {
    // Save draft or show confirmation
    handleFormExit();
  }}
  color={COLORS.text}
/>
```

### Migration Guide

**Before (manual implementation):**
```jsx
<TouchableOpacity
  style={styles.headerBackButton}
  onPress={() => {
    setCurrentChatRoom(null);
    router.back();
  }}
>
  <Ionicons name="arrow-back" size={24} color={COLORS.surface} />
</TouchableOpacity>
```

**After (using BackButton):**
```jsx
<BackButton 
  onPress={() => {
    setCurrentChatRoom(null);
    router.back();
  }}
  color={COLORS.surface}
  fallbackRoute="/chat"
/>
```

### Benefits

1. **Consistency**: Same look and behavior across the app
2. **Safety**: Built-in error handling for navigation timing issues
3. **Maintainability**: Single place to update navigation logic
4. **Flexibility**: Customizable while maintaining consistency
5. **Reliability**: Fallback routes ensure users are never stuck

### Future Enhancements

You can easily extend this component to add:
- Haptic feedback
- Custom icons (not just arrow-back)
- Animation transitions
- Sound effects
- Accessibility improvements

---

## SwipeBackGesture Component ⭐

**Global swipe-to-go-back functionality** - Works across the entire app!

### What It Does
- Detects left edge swipes on any screen
- Provides iOS-style swipe-back navigation
- Includes haptic feedback for better UX
- Automatically handles navigation safety

### Usage
Already integrated globally in `app/_layout.jsx` - no additional setup needed!

**Basic Import:**
```javascript
import { SwipeBackGesture, withSwipeBack, useSwipeBackGesture } from '../../components/navigation';
```

**How to Use:**
1. **Global** (Already Active): Works everywhere automatically
2. **Per-Screen**: Wrap specific components with `withSwipeBack(Component)`
3. **Programmatic**: Use `useSwipeBackGesture()` hook for custom triggers

**Configuration:**
```jsx
<SwipeBackGesture 
  edgeWidth={60}           // Edge detection width
  threshold={100}          // Minimum swipe distance
  velocityThreshold={0.4}  // Minimum swipe velocity
  hapticFeedback={true}    // Enable haptic feedback
  fallbackRoute="/home"    // Fallback if can't go back
/>
```

**Features:**
- ✅ Edge-only activation (won't interfere with other gestures)
- ✅ Haptic feedback (light on start, medium on success)
- ✅ Performance optimized
- ✅ Error handling with fallback routes
- ✅ Configurable sensitivity
- ✅ Works with Expo Router

**Try It Now:**
Swipe from the left edge of your screen on any page to go back!

See `SwipeBackGesture.md` for complete documentation.