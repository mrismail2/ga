import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/colors';

interface ModuleCardProps {
  title: string; subtitle?: string; count?: string | number;
  icon?: React.ReactNode; color?: string; onPress?: () => void; style?: ViewStyle; locked?: boolean;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({ title, subtitle, count, icon, color = Colors.blue, onPress, style, locked }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={locked ? 1 : 0.8} style={[styles.card, style, locked && styles.locked]}>
    <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
      {icon ?? <View style={[styles.dot, { backgroundColor: color }]} />}
    </View>
    <View style={styles.text}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
    {count !== undefined && <View style={[styles.countBadge, { backgroundColor: color }]}><Text style={styles.countText}>{count}</Text></View>}
    {locked && <Text style={{ fontSize: 14, marginLeft: 4 }}>🔒</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadows.sm, marginBottom: 10 },
  locked: { opacity: 0.6 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 18, height: 18, borderRadius: 9 },
  text: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countText: { color: Colors.surface, fontSize: 12, fontWeight: '700' },
});
