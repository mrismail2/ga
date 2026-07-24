import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

const MARK_WHITE = require('../../assets/kobciye-mark-white.png');

/* Startup splash — full-bleed brand navy with the Kobciye "K" mark
   centered, popping in and then breathing (a gentle scale pulse) while
   the app boots. Replaces the earlier bouncing-dots loader. */
export default function LoadingScreen({ onDone }) {
  const scale = useRef(new Animated.Value(0.8)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ).start();

    Animated.spring(scale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start(pulse);

    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone && onDone());
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <View style={styles.wrap}>
        <Animated.Image source={MARK_WHITE} style={[styles.mark, { transform: [{ scale }] }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A2E6B', // brand navy
    zIndex: 9999,
  },
  wrap: { alignItems: 'center', justifyContent: 'center' },
  mark: { width: 84, height: 84, resizeMode: 'contain' },
});
