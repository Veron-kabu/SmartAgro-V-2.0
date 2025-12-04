import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, Path, Rect } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const HAND_SHIFT_X_VALUE = -Math.min(width * 0.0250, 15);
const HAND_SHIFT_Y_VALUE = Math.min(height * 0.0088, 5);
// Temporary static raise (pixels) applied to the hand graphic
const HAND_RAISE_PIXELS = 5;

export default function SplashScreen({ onFinish }) {
  const insets = useSafeAreaInsets()
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const bgTranslate = useRef(new Animated.Value(-30)).current;

  const handScale = useRef(new Animated.Value(0.03)).current;
  const handOpacity = useRef(new Animated.Value(0)).current;
  const handTranslateX = useRef(new Animated.Value(0)).current;
  const handTranslateY = useRef(new Animated.Value(0)).current;

  const circleScale = useRef(new Animated.Value(0)).current;
  const circleRotate = useRef(new Animated.Value(0)).current;
  const circleOpacity = useRef(new Animated.Value(0)).current;

  const text = 'SmartAgro';
  const letters = text.split('');
  const letterAnimations = useRef(
    letters.map(() => ({ translateY: new Animated.Value(40), scale: new Animated.Value(0.3), opacity: new Animated.Value(0) }))
  ).current;

  const loopAnim = useRef(null);
  const isStoppedRef = useRef(false);
  const onFinishRef = useRef(onFinish)
  // keep the ref up-to-date without forcing the effect to re-run
  onFinishRef.current = onFinish

  useEffect(() => {
    const bgIn = Animated.parallel([
      Animated.timing(bgOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(bgTranslate, { toValue: 0, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]);

    const HAND_FINAL_SCALE = 1.06;
    const handIn = Animated.parallel([
      Animated.timing(handScale, { toValue: HAND_FINAL_SCALE, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(handOpacity, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(handTranslateX, { toValue: HAND_SHIFT_X_VALUE, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(handTranslateY, { toValue: HAND_SHIFT_Y_VALUE, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]);

    const circleIn = Animated.parallel([
      Animated.timing(circleOpacity, { toValue: 1, duration: 10, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(circleScale, { toValue: 1.15, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(circleScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]),
      Animated.timing(circleRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]);

    const lettersIn = Animated.stagger(
      100,
      letters.map((_, i) =>
        Animated.parallel([
          Animated.spring(letterAnimations[i].translateY, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }),
          Animated.spring(letterAnimations[i].scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }),
          Animated.timing(letterAnimations[i].opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ])
      )
    );

    // Hold the final splash frame for a short moment before transitioning.
    // Previously this reset all animated values to 0 which made the splash
    // appear to disappear immediately before the transition. Keep a simple
    // delay here so the final frame remains visible until onFinish is called.
    const holdAndReset = Animated.delay(1000);

    const fullSeq = Animated.sequence([bgIn, Animated.delay(120), handIn, Animated.delay(120), circleIn, Animated.delay(120), lettersIn, holdAndReset]);

    // Run the full splash sequence once and then transition automatically.
    // Previously this used Animated.loop(fullSeq) which kept the splash repeating
    // until the user tapped. Commenting out the loop behavior and starting a
    // single-run animation so the splash auto-advances when finished.
    // Single-run animation (restore default behavior)
    loopAnim.current = fullSeq;
    loopAnim.current.start(() => {
      if (!isStoppedRef.current) {
        // use ref to call parent callback without adding it to deps
        if (onFinishRef.current) onFinishRef.current();
      }
    });

    return () => {
      if (loopAnim.current) loopAnim.current.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // All animated values are refs (stable). We intentionally avoid including
    // `onFinish` and `letters` here to prevent re-running the sequence
    // unnecessarily on every render.
    bgOpacity,
    bgTranslate,
    circleOpacity,
    circleRotate,
    circleScale,
    handOpacity,
    handScale,
    handTranslateX,
    handTranslateY,
    letterAnimations,
  ]);

  const rotateInterpolate = circleRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const circleRaise = Math.min(height * 0.06, 48);
  // Vertical offset for the title to adjust its Y position (responsive)
  const TITLE_OFFSET = Math.min(height * 0.05, 48);

  const handlePress = () => {
    if (isStoppedRef.current) return;
    isStoppedRef.current = true;
    if (loopAnim.current) loopAnim.current.stop();

    const finalSeq = Animated.sequence([
      Animated.parallel([Animated.timing(bgOpacity, { toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true }), Animated.timing(bgTranslate, { toValue: 0, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true })]),
      Animated.parallel([Animated.timing(handScale, { toValue: 1.06, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }), Animated.timing(handOpacity, { toValue: 1, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }), Animated.timing(handTranslateX, { toValue: HAND_SHIFT_X_VALUE, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true }), Animated.timing(handTranslateY, { toValue: HAND_SHIFT_Y_VALUE, duration: 500, easing: Easing.out(Easing.ease), useNativeDriver: true })]),
      Animated.parallel([Animated.timing(circleOpacity, { toValue: 1, duration: 10, useNativeDriver: true }), Animated.sequence([Animated.timing(circleScale, { toValue: 1.15, duration: 450, easing: Easing.out(Easing.ease), useNativeDriver: true }), Animated.timing(circleScale, { toValue: 1, duration: 220, easing: Easing.out(Easing.ease), useNativeDriver: true })]), Animated.timing(circleRotate, { toValue: 1, duration: 700, easing: Easing.out(Easing.ease), useNativeDriver: true })]),
      Animated.stagger(100, letterAnimations.map(a => Animated.parallel([Animated.spring(a.translateY, { toValue: 0, useNativeDriver: true, friction: 6, tension: 80 }), Animated.spring(a.scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }), Animated.timing(a.opacity, { toValue: 1, duration: 300, useNativeDriver: true })]))),
      Animated.delay(500),
    ]);

    finalSeq.start(() => {
      if (onFinishRef.current) onFinishRef.current();
    });
  };
 
  return (
    // Apply a negative top margin to counter the SafeScreen padding so splash fills the full screen
    <View style={[styles.container, { marginTop: -(insets.top || 0) }]} pointerEvents="auto">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity, transform: [{ translateY: bgTranslate }] }] }>
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Defs />
          <Rect x="0" y="0" width={width} height={height} fill="#FFFAF0" />
          {(() => {
            // Draw a smooth green wave shape across the top portion of the screen.
            const startX = 0;
            const startY = height * -0.004;
            const endY = height * 0.64;
            const c1x = width * 0.35;
            const c1y = height * 0.45;
            const c2x = width * 0.75;
            const c2y = height * 0.25;

            const path = `M 0 0 L ${width} 0 L ${width} ${endY} C ${c2x} ${c2y} ${c1x} ${c1y} ${startX} ${startY} Z`;
            return (
              <>
                <Path d={path} fill="#32CD32" />
                <Path d={path} fill="none" stroke="#32CD32" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
              </>
            );
          })()}
        </Svg>
      </Animated.View>

      <Pressable style={styles.centerWrap} onPress={handlePress}>
        <Animated.View style={{ alignItems: 'center', justifyContent: 'center', transform: [{ translateX: handTranslateX }, { translateY: handTranslateY }, { translateY: -HAND_RAISE_PIXELS }, { scale: handScale }], opacity: handOpacity }}>
          <Image source={require('../../assets/images/splash/nocircle.png')} resizeMode="contain" style={styles.handImage} />
        </Animated.View>

        <Animated.View style={{ position: 'absolute', transform: [{ translateY: -circleRaise }, { rotate: rotateInterpolate }, { scale: circleScale }], opacity: circleOpacity }}>
          <Image source={require('../../assets/images/splash/circle.png')} resizeMode="contain" style={styles.circleImage} />
        </Animated.View>

  {/* Title row: use TITLE_OFFSET to move the 'SmartAgro' title lower on the screen */}
  <View style={{ flexDirection: 'row', marginTop: TITLE_OFFSET }}>
          {letters.map((letter, i) => (
            <Animated.Text key={i} style={[styles.title, { transform: [{ translateY: letterAnimations[i].translateY }, { scale: letterAnimations[i].scale }], opacity: letterAnimations[i].opacity }]}>
              {letter}
            </Animated.Text>
          ))}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  handImage: { width: width * 0.45, height: width * 0.45 },
  circleImage: { width: width * 0.55, height: width * 0.55 },
  title: { fontSize: 20, color: '#32CD32', fontWeight: 'bold' },
});
