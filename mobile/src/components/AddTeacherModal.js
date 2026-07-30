import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Avatar from './Avatar';
import Icon from './Icon';

function Field({ label, value, onChangeText, placeholder }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={c.muted2}
        style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
      />
    </View>
  );
}

const COLORS = ['#5B5BD6', '#16A34A', '#CFAD5E', '#2F6BF0', '#0891B2', '#7C3AED'];

/* Real add-teacher form (photo + details). Save prepends a teacher row. */
export default function AddTeacherModal({ visible, onClose, onAdd }) {
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [classes, setClasses] = useState('');
  const [exp, setExp] = useState('');
  const [color, setColor] = useState(0);
  const [code] = useState(() => 'TCH-' + Math.floor(1000 + Math.random() * 9000));

  const reset = () => { setName(''); setSubject(''); setClasses(''); setExp(''); setColor(0); };
  const save = () => {
    if (!name.trim()) return;
    onAdd([name.trim(), subject.trim() || 'Maadda', classes.trim() || '—', exp.trim() || '1', COLORS[color]]);
    reset(); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <Text style={[styles.title, { color: c.ink }]}>Macalin Cusub Ku Dar</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.photoRow}>
              <Avatar name={name || '??'} code={code} size={72} editable />
              <Text style={[styles.photoHint, { color: c.muted }]}>Riix si aad sawir u gelis</Text>
            </View>
            <Field label="MAGACA BUUXA" value={name} onChangeText={setName} placeholder="tusaale: Maxamuud Faraax" />
            <Field label="MAADDOOYINKA" value={subject} onChangeText={setSubject} placeholder="tusaale: Xisaab & Sayniska" />
            <Field label="FASALLADA" value={classes} onChangeText={setClasses} placeholder="tusaale: 5A, 6B" />
            <Field label="SANNADAHA KHIBRADDA" value={exp} onChangeText={setExp} placeholder="tusaale: 8" />

            <Text style={[styles.fLabel, { color: c.muted }]}>MIDABKA</Text>
            <View style={styles.colors}>
              {COLORS.map((col, i) => (
                <TouchableOpacity key={col} onPress={() => setColor(i)} style={[styles.swatch, { backgroundColor: col, borderWidth: color === i ? 3 : 0, borderColor: c.ink }]} />
              ))}
            </View>

            <View style={styles.foot}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]} onPress={onClose}>
                <Text style={[styles.btnTxt, { color: c.ink2 }]}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: name.trim() ? c.blue : c.muted2 }]} onPress={save} disabled={!name.trim()}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
                <Text style={[styles.btnTxt, { color: '#fff' }]}>Kaydi Macalinka</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  body: { padding: 20, paddingBottom: 36 },
  photoRow: { alignItems: 'center', marginBottom: 18, gap: 8 },
  photoHint: { fontSize: 12, fontWeight: '600' },
  field: { marginBottom: 14 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  foot: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
