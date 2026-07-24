import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Pressable, TextInput, Platform } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useViewMode, VIEW_MODES } from '../context/ViewModeContext';
import Icon from './Icon';

/* Dashboard view-mode bar (School Admin only). It shows ONLY the modes the
   admin has added; the dashed "+" opens a picker to add another
   (Primary / Secondary / University) AND name it. Tapping an added pill
   switches the whole dashboard UI to that institution mode — each mode shows
   only its own wording (see ViewModeContext). */
const NAME_PLACEHOLDER = {
  primary: 'Tusaale: Dugsiga Hoose',
  secondary: 'Tusaale: Dugsiga Sare',
  university: 'Tusaale: Jaamacadda Gabiley',
};

export default function SchoolSectionsBar() {
  const { c } = useTheme();
  const { mode, enabled, available, nameFor, setMode, addMode } = useViewMode();

  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(available[0] ? available[0].key : null);
  const [name, setName] = useState('');

  const pills = VIEW_MODES.filter((m) => enabled.includes(m.key));

  const openPicker = () => { setPick(available[0] ? available[0].key : null); setName(''); setOpen(true); };
  const closePicker = () => { setOpen(false); setName(''); };
  const confirmAdd = () => { if (pick) addMode(pick, name); closePicker(); };

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {pills.map((m) => {
          const on = m.key === mode;
          return (
            <TouchableOpacity key={m.key} onPress={() => setMode(m.key)} activeOpacity={0.85}
              accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={[styles.pill, { backgroundColor: on ? c.blueSoft : c.surface, borderColor: on ? c.blue : c.line2 }]}>
              <Icon name={m.icon} size={15} color={on ? c.blue : c.muted} strokeWidth={2} />
              <Text style={[styles.pillTxt, { color: on ? c.blue : c.ink2 }]} numberOfLines={1}>{nameFor(m.key)}</Text>
            </TouchableOpacity>
          );
        })}
        {available.length > 0 ? (
          <TouchableOpacity onPress={openPicker} activeOpacity={0.85}
            style={[styles.addBtn, { borderColor: c.blue, backgroundColor: c.surface }]} accessibilityLabel="Ku dar qaybta dugsiga">
            <Icon name="plus" size={16} color={c.blue} strokeWidth={2.6} />
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* add-mode picker + name */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={closePicker}>
        <Pressable style={styles.overlay} onPress={closePicker}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surface }, cardShadow]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.ink }]}>Ku dar qaybta dugsiga</Text>
              <TouchableOpacity onPress={closePicker} hitSlop={10}>
                <Icon name="close" size={18} color={c.muted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.label, { color: c.muted }]}>Nooca qaybta</Text>
            <View style={styles.typeRow}>
              {available.map((m) => {
                const on = pick === m.key;
                return (
                  <TouchableOpacity key={m.key} onPress={() => setPick(m.key)} activeOpacity={0.85}
                    style={[styles.typeChip, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
                    <Icon name={m.icon} size={18} color={on ? c.blue : c.muted} strokeWidth={2} />
                    <Text style={[styles.typeTxt, { color: on ? c.blue : c.muted }]} numberOfLines={1}>{m.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: c.muted, marginTop: 16 }]}>Magaca qaybta</Text>
            <TextInput value={name} onChangeText={setName}
              placeholder={NAME_PLACEHOLDER[pick] || 'Magaca qaybta'} placeholderTextColor={c.muted2}
              autoCapitalize="words" style={[styles.input, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />

            <TouchableOpacity onPress={confirmAdd} activeOpacity={0.9} disabled={!pick}
              style={[styles.addFull, { backgroundColor: c.blue, opacity: pick ? 1 : 0.5 }]}>
              <Text style={styles.addFullTxt}>Ku dar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const cardShadow = Platform.OS === 'web'
  ? { boxShadow: '0 18px 48px rgba(20,40,80,0.14)' }
  : { shadowColor: '#142850', shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 };

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2, paddingRight: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5 },
  pillTxt: { fontSize: 13.5, fontWeight: '700', maxWidth: 170 },
  addBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  sheet: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 20 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  label: { fontSize: 12.5, fontWeight: '700', marginBottom: 9 },
  typeRow: { flexDirection: 'row', gap: 9 },
  typeChip: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 14, borderWidth: 1.5 },
  typeTxt: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  input: { height: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14.5, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : null) },
  addFull: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  addFullTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
