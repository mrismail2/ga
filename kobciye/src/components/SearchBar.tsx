import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius } from '../constants/colors';

interface SearchBarProps { value: string; onChangeText: (text: string) => void; placeholder?: string; style?: ViewStyle; }

export const SearchBar: React.FC<SearchBarProps> = ({ value, onChangeText, placeholder = 'Search...', style }) => (
  <View style={[styles.wrap, style]}>
    <Text style={styles.icon}>🔍</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={Colors.muted} style={styles.input} />
  </View>
);

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  icon: { fontSize: 16 },
  input: { flex: 1, fontSize: 14, color: Colors.text },
});
