import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

const map: Record<AttendanceStatus, { color: string; label: string }> = {
  present: { color: Colors.green, label: 'Present' },
  absent: { color: Colors.red, label: 'Absent' },
  late: { color: Colors.orange, label: 'Late' },
  excused: { color: Colors.blue, label: 'Excused' },
};

export const AttendanceBadge: React.FC<{ status: AttendanceStatus }> = ({ status }) => {
  const cfg = map[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.color + '20' }]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4, alignSelf: 'flex-start' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, fontWeight: '600' },
});
