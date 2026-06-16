import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../constants/colors';

interface SecondaryButtonProps { label: string; onPress: () => void; style?: ViewStyle; }

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({ label, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.btn, style]}>
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: { paddingVertical: 13, paddingHorizontal: 24, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.blue, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.blue, fontSize: 15, fontWeight: '600' },
});
