import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/colors';

interface StatCardProps { label: string; value: string | number; trend?: string; trendUp?: boolean; accentColor?: string; icon?: React.ReactNode; style?: ViewStyle; }

export const StatCard: React.FC<StatCardProps> = ({ label, value, trend, trendUp, accentColor = Colors.blue, icon, style }) => (
  <View style={[styles.card, style]}>
    <View style={[styles.iconWrap, { backgroundColor: accentColor + '18' }]}>
      {icon ?? <View style={[styles.dot, { backgroundColor: accentColor }]} />}
    </View>
    <Text style={styles.value}>{value}</Text>
    <Text style={styles.label}>{label}</Text>
    {trend && <Text style={[styles.trend, trendUp ? styles.up : styles.down]}>{trendUp ? '▲' : '▼'} {trend}</Text>}
  </View>
);

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, flex: 1, minWidth: 140, ...Shadows.md },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  value: { fontSize: 26, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  label: { fontSize: 13, color: Colors.muted, fontWeight: '500' },
  trend: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  up: { color: Colors.green },
  down: { color: Colors.red },
});
