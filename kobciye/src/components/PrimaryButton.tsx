import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, Radius } from '../constants/colors';

interface PrimaryButtonProps { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; style?: ViewStyle; color?: string; }

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({ label, onPress, loading, disabled, style, color = Colors.blue }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.82} style={[styles.btn, { backgroundColor: color }, (disabled || loading) && styles.disabled, style]}>
    {loading ? <ActivityIndicator color={Colors.surface} size="small" /> : <Text style={styles.label}>{label}</Text>}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.surface, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  disabled: { opacity: 0.55 },
});
