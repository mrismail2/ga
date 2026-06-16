import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/colors';

interface ErrorStateProps { message?: string; onRetry?: () => void; }

export const ErrorState: React.FC<ErrorStateProps> = ({ message = 'Something went wrong. Please try again.', onRetry }) => (
  <View style={styles.wrap}>
    <Text style={styles.icon}>⚠️</Text>
    <Text style={styles.text}>{message}</Text>
    {onRetry && <TouchableOpacity onPress={onRetry} style={styles.btn}><Text style={styles.btnText}>Try Again</Text></TouchableOpacity>}
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: Colors.background },
  icon: { fontSize: 44, marginBottom: 12 },
  text: { fontSize: 15, color: Colors.text2, textAlign: 'center', lineHeight: 22 },
  btn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: Colors.blue, borderRadius: 12 },
  btnText: { color: Colors.surface, fontWeight: '700', fontSize: 14 },
});
