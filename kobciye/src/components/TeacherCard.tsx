import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/colors';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

interface TeacherCardProps { name: string; subject: string; classes?: string; status: 'active' | 'suspended' | 'pending'; onPress?: () => void; }

export const TeacherCard: React.FC<TeacherCardProps> = ({ name, subject, classes, status, onPress }) => {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      <Avatar initials={initials} size={46} color={Colors.navy600} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.subject}>{subject}</Text>
        {classes && <Text style={styles.meta}>{classes}</Text>}
      </View>
      <StatusBadge variant={status} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, ...Shadows.sm, marginBottom: 8 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  subject: { fontSize: 12, color: Colors.blue, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 11, color: Colors.muted },
});
