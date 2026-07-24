import React from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import Avatar from './Avatar';
import Icon from './Icon';
import Badge from './Badge';

function InfoCell({ label, children }) {
  const { c } = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: c.muted }]}>{label}</Text>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

/* Full teacher detail with editable photo — opens when a teacher row is
   tapped. DEMO: fields are derived deterministically so every teacher is
   complete (like the web teacher cards). LIVE: pass the canonical row as
   `live` — only its REAL fields show ('—' when empty), nothing is ever
   fabricated for a real teacher. */
export default function TeacherProfileModal({ visible, teacher, onClose, onDelete, live }) {
  const { c } = useTheme();
  const { role } = useRole();
  const canDelete = (role === 'superadmin' || role === 'schooladmin') && !!onDelete;

  if (!teacher) return null;
  const [name, subject, classes, exp, color] = teacher;
  const s = name.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  // LIVE: canonical values only. DEMO: the deterministic preview values.
  const code = live ? String(live.id || '').slice(0, 8).toUpperCase() : 'TCH-' + name.replace(/\s/g, '').slice(0, 6).toUpperCase();
  const phone = live ? (live.phone || '—') : '+252 63 ' + (3000000 + (s % 6999999));
  const email = live ? (live.email || '—') : name.toLowerCase().split(' ')[0] + '@hidaayada.edu';
  const city = live ? '—' : ['Gabiley', 'Hargeysa', 'Burco'][s % 3];

  const call = () => { if (phone && phone !== '—') Linking.openURL('tel:' + phone.replace(/\s/g, '')); };

  const handleDelete = () => {
    Alert.alert(
      'Dib u baase Macalin',
      `Ma hubtaa inaad dib u baxaysay ${name}?`,
      [
        { text: 'Jooji', style: 'cancel' },
        {
          text: 'Hah, Dib u baase',
          style: 'destructive',
          onPress: () => {
            if (onDelete) onDelete(teacher);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.header, { borderBottomColor: c.line }]}>
            <Avatar name={name} code={code} size={60} editable />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.name, { color: c.ink }]}>{name}</Text>
              <Text style={[styles.sub, { color: c.muted }]}>{subject}</Text>
              <Badge label={`${exp} sano khibrad`} tone="gold" style={{ marginTop: 6 }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {canDelete && (
                <TouchableOpacity onPress={handleDelete} hitSlop={10}>
                  <Icon name="delete" size={18} color={c.rose} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <Icon name="close" size={20} color={c.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.uploadHint, { color: c.muted2 }]}>Riix sawirka si aad u beddesho (📷)</Text>
            <View style={styles.grid}>
              <InfoCell label="MAADDOOYINKA"><Text style={[styles.val, { color: c.ink }]}>{subject}</Text></InfoCell>
              <InfoCell label="FASALLADA"><Text style={[styles.val, { color: c.ink }]}>{classes}</Text></InfoCell>
              <InfoCell label="KHIBRAD"><Text style={[styles.val, { color: c.ink }]}>{exp} sano</Text></InfoCell>
              <InfoCell label="MAGAALADA"><Text style={[styles.val, { color: c.ink }]}>{city}</Text></InfoCell>
              <InfoCell label="EMAIL"><Text style={[styles.val, { color: c.ink2, fontSize: 12.5 }]}>{email}</Text></InfoCell>
              <InfoCell label="ID MACALIN"><Text style={[styles.val, { color: c.ink }]}>{code}</Text></InfoCell>
            </View>

            <TouchableOpacity style={[styles.contactRow, { backgroundColor: c.blueSoft }]} onPress={call} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactLbl, { color: c.muted }]}>TALEEFOON</Text>
                <Text style={[styles.contactPhone, { color: c.blue }]}>{phone}</Text>
              </View>
              <View style={[styles.callBtn, { backgroundColor: c.blue }]}>
                <Icon name="phone" size={15} color="#fff" strokeWidth={2} />
                <Text style={styles.callTxt}>Wac</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  name: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  body: { padding: 20, paddingBottom: 36 },
  uploadHint: { fontSize: 11.5, fontWeight: '600', marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cell: { minWidth: '44%', flex: 1, marginBottom: 12 },
  cellLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  val: { fontSize: 14, fontWeight: '600' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, marginTop: 8 },
  contactLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  contactPhone: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  callTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
