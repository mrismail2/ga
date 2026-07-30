import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Icon from './Icon';

const TYPES = ['Khilaaf macalin', 'Soo daahid joogto ah', 'Diidmo shaqo-guri', 'Hadal xun', 'Burburin hanti', 'Cay/dulmi (bullying)'];
const SEV = [
  { key: 'low', label: 'Hoose' },
  { key: 'medium', label: 'Dhexe' },
  { key: 'high', label: 'Sare' },
  { key: 'critical', label: 'Halis' },
];

function Field({ label, value, onChangeText, placeholder, multiline }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted2}
        multiline={multiline}
        style={[styles.input, multiline && styles.area, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
      />
    </View>
  );
}

/* Real report-incident form. On save it prepends a new incident row. */
export default function AddIncidentModal({ visible, onClose, onAdd }) {
  const { c } = useTheme();
  const [student, setStudent] = useState('');
  const [cls, setCls] = useState('');
  const [type, setType] = useState(0);
  const [sev, setSev] = useState(0);
  const [desc, setDesc] = useState('');

  const reset = () => { setStudent(''); setCls(''); setType(0); setSev(0); setDesc(''); };

  const save = () => {
    if (!student.trim()) return;
    // [student, class, type, severity, desc, reporter, when, status, parentNotified]
    onAdd([student.trim(), cls.trim() || 'Form 5A', TYPES[type], SEV[sev].key, desc.trim() || '—', 'Macalin Maxamuud', 'Maanta', 'open', 'Maya']);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <Text style={[styles.title, { color: c.ink }]}>Kiis Cusub Diiwaangeli</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={20} color={c.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Field label="ARDAYGA" value={student} onChangeText={setStudent} placeholder="Magaca ardayga" />
            <Field label="FASALKA" value={cls} onChangeText={setCls} placeholder="tusaale: Form 5A" />

            <Text style={[styles.fLabel, { color: c.muted }]}>NOOCA KIISKA</Text>
            <View style={styles.chips}>
              {TYPES.map((t, i) => (
                <TouchableOpacity key={t} onPress={() => setType(i)} style={[styles.chip, { borderColor: c.line, backgroundColor: type === i ? c.blue : 'transparent' }]}>
                  <Text style={[styles.chipTxt, { color: type === i ? '#fff' : c.ink2 }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fLabel, { color: c.muted, marginTop: 14 }]}>HEERKA HALISTA</Text>
            <View style={styles.seg}>
              {SEV.map((s, i) => (
                <TouchableOpacity key={s.key} onPress={() => setSev(i)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: sev === i ? c.navy : 'transparent' }]}>
                  <Text style={[styles.segTxt, { color: sev === i ? '#fff' : c.ink2 }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 14 }}>
              <Field label="SHARAXAAD — MAXAA DHACAY?" value={desc} onChangeText={setDesc} placeholder="Sharax si cad waxa dhacay…" multiline />
            </View>

            <View style={styles.foot}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]} onPress={onClose}>
                <Text style={[styles.btnTxt, { color: c.ink2 }]}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: student.trim() ? c.blue : c.muted2 }]} onPress={save} disabled={!student.trim()}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
                <Text style={[styles.btnTxt, { color: '#fff' }]}>Kaydi Kiiska</Text>
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
  field: { marginBottom: 14 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14 },
  area: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  segTxt: { fontSize: 12, fontWeight: '700' },
  foot: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
