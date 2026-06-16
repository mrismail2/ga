import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type BadgeVariant = 'paid' | 'unpaid' | 'partial' | 'free' | 'open' | 'resolved' | 'escalated' | 'underReview' | 'low' | 'medium' | 'high' | 'critical' | 'active' | 'suspended' | 'pending';

const variantMap: Record<BadgeVariant, { bg: string; text: string; label: string }> = {
  paid:        { bg: Colors.greenSoft,  text: Colors.green,  label: 'Paid' },
  unpaid:      { bg: Colors.redSoft,    text: Colors.red,    label: 'Unpaid' },
  partial:     { bg: Colors.orangeSoft, text: Colors.orange, label: 'Partial' },
  free:        { bg: Colors.blueSoft,   text: Colors.blue,   label: 'Free' },
  open:        { bg: Colors.blueSoft,   text: Colors.blue,   label: 'Open' },
  resolved:    { bg: Colors.greenSoft,  text: Colors.green,  label: 'Resolved' },
  escalated:   { bg: Colors.redSoft,    text: Colors.red,    label: 'Escalated' },
  underReview: { bg: Colors.orangeSoft, text: Colors.orange, label: 'Under Review' },
  low:         { bg: Colors.greenSoft,  text: Colors.green,  label: 'Low' },
  medium:      { bg: Colors.orangeSoft, text: Colors.orange, label: 'Medium' },
  high:        { bg: Colors.redSoft,    text: Colors.red,    label: 'High' },
  critical:    { bg: '#3B0A0B',         text: Colors.red,    label: 'Critical' },
  active:      { bg: Colors.greenSoft,  text: Colors.green,  label: 'Active' },
  suspended:   { bg: Colors.redSoft,    text: Colors.red,    label: 'Suspended' },
  pending:     { bg: Colors.orangeSoft, text: Colors.orange, label: 'Pending' },
};

interface StatusBadgeProps { variant: BadgeVariant; label?: string; small?: boolean; }

export const StatusBadge: React.FC<StatusBadgeProps> = ({ variant, label, small }) => {
  const cfg = variantMap[variant] ?? variantMap.open;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, small && styles.small]}>
      <Text style={[styles.label, { color: cfg.text }, small && styles.smallText]}>{label ?? cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' },
  label: { fontSize: 12, fontWeight: '600' },
  small: { paddingHorizontal: 8, paddingVertical: 2 },
  smallText: { fontSize: 10 },
});
