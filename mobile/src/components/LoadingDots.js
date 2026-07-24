import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/* Universal loading indicator — three dots bouncing in a wave, used for
   every busy/tap state (buttons, list loads) and every full-screen loading
   moment (session restore) so the app has one consistent loading language
   instead of scattered native ActivityIndicators. */
function Dot({ anim, color, size }) {
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.9] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  return (
    <Animated.View
      style={{
        width: size, height: size, borderRadius: size / 2, backgroundColor: color,
        opacity, transform: [{ translateY }],
      }}
    />
  );
}

export default function LoadingDots({ color = '#fff', size = 8, gap = 6, style }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay((2 - i) * 140),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={[styles.row, { gap }, style]}>
      {anims.map((a, i) => <Dot key={i} anim={a} color={color} size={size} />)}
    </View>
  );
}

// full-screen loading state — brand blue background, white dots. Used
// everywhere a screen/app is still opening (splash-adjacent, but for
// in-app waits rather than the one-time launch splash).
export function LoadingOverlay() {
  const { c } = useTheme();
  return (
    <View style={[styles.fullscreen, { backgroundColor: c.blue }]}>
      <LoadingDots color="#fff" size={13} gap={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  fullscreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
