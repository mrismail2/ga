import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';

type Props = { navigation: NativeStackNavigationProp<any> };

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(() => { navigation.replace('Onboarding'); }, 2200);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.wrap}>
      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}><Text style={styles.logoK}>K</Text></View>
        <Text style={styles.brand}>Kobciye</Text>
      </View>
      <Text style={styles.tagline}>Premium School Management</Text>
      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: Colors.navy, alignItems: 'center', justifyContent: 'center', gap: 12 },
  logoWrap: { alignItems: 'center', gap: 14 },
  logoCircle: { width: 88, height: 88, borderRadius: 26, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' },
  logoK: { fontSize: 50, fontWeight: '900', color: Colors.navy },
  brand: { fontSize: 36, fontWeight: '900', color: Colors.surface, letterSpacing: 1 },
  tagline: { fontSize: 14, color: Colors.navy300, letterSpacing: 0.5, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 40 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.navy300 },
  dotActive: { backgroundColor: Colors.gold, width: 20, borderRadius: 3 },
});
