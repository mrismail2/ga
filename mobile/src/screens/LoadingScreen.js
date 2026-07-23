import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

export default function LoadingScreen({ onDone }) {
  const dot1Y = useRef(new Animated.Value(0)).current;
  const dot2Y = useRef(new Animated.Value(0)).current;
  const dot3Y = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const bounce = (anim, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -10, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 280, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(400 - delay),
        ])
      );

    bounce(dot1Y, 0).start();
    bounce(dot2Y, 120).start();
    bounce(dot3Y, 240).start();

    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone && onDone());
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <View style={styles.wrap}>
        <Animated.View style={[styles.dot, { transform: [{ translateY: dot1Y }] }]} />
        <View style={styles.row}>
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot2Y }] }]} />
          <Animated.View style={[styles.dot, { transform: [{ translateY: dot3Y }] }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Transparent wrapper: the loader blends with whatever screen is behind it
    // instead of painting a solid colored block over the app.
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  wrap: { alignItems: 'center', gap: 5 },
  row: { flexDirection: 'row', gap: 5 },
  // brand navy so the dots stay visible on the (now transparent) light background
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#0A2E6B' },
});
