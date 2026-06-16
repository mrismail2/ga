import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading dashboard...' }) => (
  <View style={styles.wrap}>
    <ActivityIndicator size="large" color={Colors.blue} />
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: Colors.background },
  text: { fontSize: 14, color: Colors.muted, fontWeight: '500' },
});
