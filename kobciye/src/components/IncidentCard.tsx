import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Shadows, Radius } from '../constants/colors';
import { Avatar } from './Avatar';
import { StatusBadge } from './StatusBadge';

interface IncidentCardProps {
  studentName: string; studentCode?: string; className: string; incidentType: string;
  severity: 'low' | 'medium' | 'high' | 'critical'; date: string; reportedBy: string;
  description: string; status: 'open' | 'underReview' | 'resolved' | 'escalated'; onViewDetails?: () => void;
}

export const IncidentCard: React.FC<IncidentCardProps> = ({ studentName, studentCode, className, incidentType, severity, date, reportedBy, description, status, onViewDetails }) => {
  const initials = studentName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar initials={initials} size={44} color={Colors.navy} />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{studentName}</Text>
          <Text style={styles.meta}>{studentCode ? `#${studentCode} · ` : ''}{className}</Text>
        </View>
        <StatusBadge variant={severity} />
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <View style={styles.field}><Text style={styles.fieldLabel}>Type</Text><Text style={styles.fieldValue}>{incidentType}</Text></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>Date</Text><Text style={styles.fieldValue}>{date}</Text></View>
        <View style={styles.field}><Text style={styles.fieldLabel}>Reported By</Text><Text style={styles.fieldValue}>{reportedBy}</Text></View>
      </View>
      <Text style={styles.desc} numberOfLines={2}>{description}</Text>
      <View style={styles.footer}>
        <StatusBadge variant={status} />
        <TouchableOpacity onPress={onViewDetails} style={styles.detailBtn}><Text style={styles.detailBtnText}>View Details</Text></TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, marginBottom: 12, ...Shadows.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  headerInfo: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 12, color: Colors.muted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.border, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  field: { flex: 1 },
  fieldLabel: { fontSize: 10, color: Colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  fieldValue: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  desc: { fontSize: 13, color: Colors.text2, lineHeight: 18, marginBottom: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailBtn: { backgroundColor: Colors.blueSoft, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  detailBtnText: { color: Colors.blue, fontSize: 13, fontWeight: '600' },
});
