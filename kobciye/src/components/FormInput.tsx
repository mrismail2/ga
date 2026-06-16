import React from 'react';
import { View, Text, TextInput, StyleSheet, ViewStyle, KeyboardTypeOptions } from 'react-native';
import { Colors, Radius } from '../constants/colors';

interface FormInputProps {
  label: string; value: string; onChangeText: (text: string) => void;
  placeholder?: string; secureTextEntry?: boolean; keyboardType?: KeyboardTypeOptions;
  multiline?: boolean; numberOfLines?: number; style?: ViewStyle; hint?: string;
}

export const FormInput: React.FC<FormInputProps> = ({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType = 'default', multiline, numberOfLines = 1, style, hint }) => (
  <View style={[styles.wrap, style]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder ?? label} placeholderTextColor={Colors.muted} secureTextEntry={secureTextEntry} keyboardType={keyboardType} multiline={multiline} numberOfLines={numberOfLines} style={[styles.input, multiline && styles.multiline]} />
    {hint && <Text style={styles.hint}>{hint}</Text>}
  </View>
);

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: Colors.text2, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: Colors.text },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  hint: { fontSize: 11, color: Colors.muted, marginTop: 4 },
});
