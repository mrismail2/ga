import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { shadow } from '../theme/colors';
import Avatar from './Avatar';
import Badge from './Badge';
import Icon from './Icon';
import { FEE_LABELS } from '../data/mock';

/* A tappable student card. Tapping anywhere opens the full profile.
   No email clutter — just name + ID + a clear "tap to view" hint.
   A slim left accent is tinted by attendance for an at-a-glance read. */
export default function StudentRow({ student, index, onPress, onRoll }) {
  const { c } = useTheme();
  const fee = FEE_LABELS[student.fee] || FEE_LABELS.full;
  const attTone = student.att == null ? c.line : student.att >= 90 ? c.green : student.att >= 80 ? c.gold700 : c.rose;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}
      onPress={() => onPress(student)}
      activeOpacity={0.7}
    >
      <View style={[styles.accent, { backgroundColor: attTone }]} />
      {onRoll ? (
        <TouchableOpacity onPress={() => onRoll(student)} hitSlop={8} style={[styles.idxBtn, { backgroundColor: c.blueSoft }]}>
          <Text style={[styles.idxOn, { color: c.navy }]}>{String(index + 1).padStart(2, '0')}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.idx, { color: c.muted2 }]}>{String(index + 1).padStart(2, '0')}</Text>
      )}
      <Avatar name={student.name} code={student.student_internal_id} size={44} />
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{student.name}</Text>
        <Text style={[styles.hint, { color: c.muted }]}>{student.student_id}</Text>
      </View>
      <View style={styles.right}>
        <Badge label={fee.label} tone={fee.tone} />
        <Text style={[styles.att, { color: student.att == null ? c.muted : student.att >= 90 ? c.green : student.att >= 80 ? c.gold700 : c.rose }]}>
          {student.att == null ? '—' : `${student.att}%`}
        </Text>
      </View>
      <View style={{ marginLeft: 6 }}>
        <Icon name="chevronRight" size={18} color={c.muted2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 12, paddingLeft: 16, borderRadius: 14,
    borderWidth: 1, marginBottom: 10, overflow: 'hidden',
  },
  accent: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  idx: { width: 22, fontSize: 12, fontWeight: '700' },
  idxBtn: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  idxOn: { fontSize: 12, fontWeight: '800' },
  name: { fontSize: 14.5, fontWeight: '700' },
  hint: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  right: { alignItems: 'flex-end', gap: 4 },
  att: { fontSize: 13, fontWeight: '700' },
});
