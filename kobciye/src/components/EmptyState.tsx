import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface EmptyStateProps { title: string; subtitle?: string; icon?: string; }

export const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle, icon = '\u{1F4CB}' }) => (
  <View style={styles.wrap}>
    <Text style={styles.icon}>{icon}</Text>
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', color: Colors.text, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.muted, textAlign: 'center', lineHeight: 20 },
});
