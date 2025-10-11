# SwipeBackGesture Component

A global swipe-to-go-back gesture component that provides iOS-style edge swipe navigation across the entire app.

## Features

- **Edge Detection**: Only responds to swipes starting from the left edge
- **Haptic Feedback**: Provides tactile feedback on gesture start and success
- **Performance Optimized**: Minimal re-renders and efficient gesture handling
- **Configurable**: Customizable sensitivity, thresholds, and behavior
- **Error Resilient**: Safe navigation with fallback routes
- **Global Coverage**: Works across all screens when placed in root layout

## Installation

The component is already integrated in the root layout (`_layout.jsx`) and works globally across the app.

### Dependencies
- `expo-haptics` ✅ (already installed)
- `expo-router` ✅ (already installed)
- `react-native` PanResponder ✅ (built-in)

## Configuration

The gesture is currently configured in `app/_layout.jsx` with these settings:

```jsx
<SwipeBackGesture 
  edgeWidth={60}           // 60px edge detection zone
  threshold={100}          // 100px minimum swipe distance
  velocityThreshold={0.4}  // 0.4 minimum swipe velocity
  hapticFeedback={true}    // Enable haptic feedback
  fallbackRoute="/home"    // Fallback to home if can't go back
>
  <Stack screenOptions={{ headerShown: false }} />
</SwipeBackGesture>
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `edgeWidth` | Number | `50` | Width of left edge area that triggers swipe (pixels) |
| `threshold` | Number | `80` | Minimum swipe distance to trigger navigation (pixels) |
| `velocityThreshold` | Number | `0.3` | Minimum swipe velocity to trigger navigation |
| `enabled` | Boolean | `true` | Enable/disable the gesture globally |
| `hapticFeedback` | Boolean | `true` | Enable haptic feedback |
| `fallbackRoute` | String | `null` | Route to navigate to if can't go back |
| `onSwipeStart` | Function | `null` | Callback when swipe gesture starts |
| `onSwipeEnd` | Function | `null` | Callback when swipe gesture ends |
| `onNavigate` | Function | `null` | Callback when navigation occurs |

## Usage Examples

### 1. Current Global Setup (Already Implemented)
```jsx
// In app/_layout.jsx
<SwipeBackGesture 
  edgeWidth={60}
  threshold={100}
  velocityThreshold={0.4}
  hapticFeedback={true}
  fallbackRoute="/home"
>
  <Stack screenOptions={{ headerShown: false }} />
</SwipeBackGesture>
```

### 2. Custom Configuration
```jsx
<SwipeBackGesture 
  edgeWidth={80}           // Wider edge detection
  threshold={60}           // Shorter swipe distance needed
  velocityThreshold={0.2}  // Lower velocity requirement
  hapticFeedback={false}   // Disable haptics
  fallbackRoute="/dashboard"
  onSwipeStart={() => console.log('Swipe started')}
  onNavigate={(data) => console.log('Navigated:', data)}
>
  {children}
</SwipeBackGesture>
```

### 3. Per-Screen Wrapper (Alternative)
```jsx
import { withSwipeBack } from '../components/navigation';

// Wrap a specific component
const ProductDetailWithSwipe = withSwipeBack(ProductDetail, {
  threshold: 120,
  fallbackRoute: '/products'
});

export default ProductDetailWithSwipe;
```

### 4. Programmatic Hook Usage
```jsx
import { useSwipeBackGesture } from '../components/navigation';

function MyComponent() {
  const { triggerSwipeBack, canGoBack } = useSwipeBackGesture();
  
  const handleCustomBack = () => {
    triggerSwipeBack({
      hapticFeedback: true,
      fallbackRoute: '/custom-route'
    });
  };
  
  return (
    <TouchableOpacity onPress={handleCustomBack}>
      <Text>Custom Back Action</Text>
    </TouchableOpacity>
  );
}
```

## How It Works

### Gesture Detection
1. **Edge Detection**: Gesture only activates when touch starts within `edgeWidth` pixels from left edge
2. **Direction Validation**: Must be horizontal rightward movement (not vertical)
3. **Threshold Check**: Must swipe at least `threshold` distance OR exceed `velocityThreshold`

### Navigation Logic
1. **Check History**: Uses `router.canGoBack()` to determine if back navigation is possible
2. **Prioritize History**: Always tries `router.back()` first (goes to actual previous screen)
3. **Safe Navigation**: Wraps navigation in try-catch with retry mechanism
4. **Fallback Only When Needed**: Uses `fallbackRoute` only if no navigation history exists
5. **Final Fallback**: Defaults to `/home` only as last resort

### Navigation Priority Order
1. 🎯 **`router.back()`** - Goes to the actual previous screen in navigation history
2. 🔄 **`fallbackRoute`** - Only used if no navigation history exists
3. 🏠 **`/home`** - Final fallback if no fallbackRoute is specified

### Haptic Feedback
- **Light Impact**: On gesture start (edge touch detected)
- **Medium Impact**: On successful navigation trigger

## Performance Considerations

- **PanResponder Optimization**: Only activates for edge touches
- **Ref Usage**: Uses refs to avoid unnecessary re-renders
- **Gesture Termination**: Properly handles interrupted gestures
- **Memory Management**: Cleans up refs and timeouts

## Customization Examples

### Disable on Specific Screens
```jsx
// You can disable globally and enable per-screen instead
<SwipeBackGesture enabled={!isModalOpen}>
  {children}
</SwipeBackGesture>
```

### Custom Sensitivity for Different Devices
```jsx
import { Platform, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const isTablet = width > 768;

<SwipeBackGesture 
  edgeWidth={isTablet ? 100 : 60}
  threshold={isTablet ? 150 : 100}
>
  {children}
</SwipeBackGesture>
```

### Debug Mode
```jsx
<SwipeBackGesture 
  onSwipeStart={() => console.log('🏁 Swipe started')}
  onSwipeEnd={(data) => console.log('🔚 Swipe ended:', data)}
  onNavigate={(data) => console.log('🧭 Navigation triggered:', data)}
>
  {children}
</SwipeBackGesture>
```

## Troubleshooting

### Gesture Not Working
1. **Check Edge Width**: Ensure you're swiping from the very left edge
2. **Check Threshold**: Make sure you're swiping far enough
3. **Check Direction**: Swipe horizontally, not diagonally
4. **Check if Enabled**: Verify `enabled={true}` is set

### Performance Issues
1. **Reduce Edge Width**: Smaller `edgeWidth` = less gesture detection overhead
2. **Disable Haptics**: Set `hapticFeedback={false}` if needed
3. **Remove Callbacks**: Avoid heavy operations in callback functions

### Navigation Issues
1. **Check Router State**: Ensure Expo Router is properly configured
2. **Set Fallback Route**: Always provide a `fallbackRoute`
3. **Check Console**: Look for navigation error logs

## Best Practices

1. **Global Setup**: Place once in root layout for app-wide coverage
2. **Reasonable Thresholds**: Balance between sensitivity and accidental triggers
3. **Fallback Routes**: Always provide fallback navigation paths
4. **Test on Device**: Gesture behavior differs between simulator and real device
5. **Haptic Moderation**: Don't overuse haptic feedback

## Current Implementation Status

✅ **Installed**: Globally active in `app/_layout.jsx`  
✅ **Configured**: Optimized settings for general use  
✅ **Tested**: Ready for use across all app screens  
✅ **Performance**: Optimized for minimal impact  

The swipe-to-go-back gesture is now active across your entire app! Users can swipe from the left edge of the screen to navigate back, just like in native iOS apps.