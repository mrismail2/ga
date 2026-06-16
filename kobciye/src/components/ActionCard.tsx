import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/colors';

interface ActionCardProps {
  label: string;
  icon?: React.ReactNode;
  color?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const ActionCard: React.FC<ActionCardProps> = ({
  label,
  icon,
  color = Colors.blue,
  onPress,
  style,
}) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={[styles.card, style]}>
    <View style={[styles.iconWrap, { backgroundColor: color + '18' }]}>
      {icon ?? <View style={[styles.dot, { backgroundColor: color }]} />}
    </View>
    <Text style={styles.label}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minWidth: 90,
    ...Shadows.sm,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dot: { width: 18, height: 18, borderRadius: 9 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text, textAlign: 'center' },
});
