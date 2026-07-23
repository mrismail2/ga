import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Icon from './Icon';

const GRADES = ['Dugsi Hoose', 'Dugsi Dhexe', 'Dugsi Sare'];
const COLORS = ['#5B5BD6', '#16A34A', '#CFAD5E', '#2F6BF0', '#0891B2', '#7C3AED', '#E5484D', '#B45309'];

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted2}
        keyboardType={keyboardType}
        style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
      />
    </View>
  );
}

/* Real add-class form — name, grade, teacher, capacity and colour. On
   save it appends a new class row to the grid. */
export default function AddClassModal({ visible, onClose, onAdd }) {
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [teacher, setTeacher] = useState('');
  const [grade, setGrade] = useState(0);
  const [cap, setCap] = useState('40');
  const [color, setColor] = useState(0);

  const reset = () => { setName(''); setTeacher(''); setGrade(0); setCap('40'); setColor(0); };

  const save = () => {
    if (!name.trim()) return;
    // [name, grade, teacher, students, capacity, color, attendance%]
    onAdd([name.trim(), GRADES[grade], teacher.trim() || 'Macalin', 0, parseInt(cap, 10) || 40, COLORS[color], 100]);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <Text style={[styles.title, { color: c.ink }]}>Fasal Cusub Ku Dar</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={20} color={c.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Field label="MAGACA FASALKA" value={name} onChangeText={setName} placeholder="tusaale: Form 7B" />
            <Field label="MACALINKA" value={teacher} onChangeText={setTeacher} placeholder="Magaca macalinka" />
            <Field label="QADKA ARDAYDA (CAPACITY)" value={cap} onChangeText={setCap} placeholder="40" keyboardType="number-pad" />

            <Text style={[styles.fLabel, { color: c.muted }]}>HEERKA</Text>
            <View style={styles.seg}>
              {GRADES.map((g, i) => (
                <TouchableOpacity key={g} onPress={() => setGrade(i)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: grade === i ? c.blue : 'transparent' }]}>
                  <Text style={[styles.segTxt, { color: grade === i ? '#fff' : c.ink2 }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fLabel, { color: c.muted, marginTop: 14 }]}>MIDABKA</Text>
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
                <Text style={[styles.btnTxt, { color: '#fff' }]}>Kaydi Fasalka</Text>
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
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  body: { padding: 20, paddingBottom: 36 },
  field: { marginBottom: 14 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14 },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  segTxt: { fontSize: 12, fontWeight: '700' },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 38, height: 38, borderRadius: 19 },
  foot: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
