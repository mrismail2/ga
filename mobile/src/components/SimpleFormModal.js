import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Icon from './Icon';

/* Generic add form driven by a `fields` spec:
   [{ key, label, placeholder, multiline, options }]. `options` makes a
   chip selector. onSubmit receives an object of the entered values. */
export default function SimpleFormModal({ visible, title, saveLabel, fields, onClose, onSubmit }) {
  const { c } = useTheme();
  const [vals, setVals] = useState({});

  useEffect(() => {
    if (visible) {
      const init = {};
      fields.forEach((f) => { init[f.key] = f.options ? f.options[0] : ''; });
      setVals(init);
    }
  }, [visible]);

  const required = fields.find((f) => f.required);
  const ok = !required || (vals[required.key] && String(vals[required.key]).trim());

  const submit = () => { if (!ok) return; onSubmit(vals); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {fields.map((f) => (
              <View key={f.key} style={styles.field}>
                <Text style={[styles.fLabel, { color: c.muted }]}>{f.label}</Text>
                {f.options ? (
                  <View style={styles.chips}>
                    {f.options.map((o) => (
                      <TouchableOpacity key={o} onPress={() => setVals({ ...vals, [f.key]: o })}
                        style={[styles.chip, { borderColor: c.line, backgroundColor: vals[f.key] === o ? c.blue : 'transparent' }]}>
                        <Text style={[styles.chipTxt, { color: vals[f.key] === o ? '#fff' : c.ink2 }]}>{o}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    value={vals[f.key]} onChangeText={(t) => setVals({ ...vals, [f.key]: t })}
                    placeholder={f.placeholder} placeholderTextColor={c.muted2} multiline={f.multiline}
                    style={[styles.input, f.multiline && styles.area, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
                  />
                )}
              </View>
            ))}
            <View style={styles.foot}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]} onPress={onClose}>
                <Text style={[styles.btnTxt, { color: c.ink2 }]}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: ok ? c.blue : c.muted2 }]} onPress={submit} disabled={!ok}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
                <Text style={[styles.btnTxt, { color: '#fff' }]}>{saveLabel || 'Kaydi'}</Text>
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
  area: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  foot: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
