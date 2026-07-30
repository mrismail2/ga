/* ============================================================
   Kobciye — Super Admin school selector

   Two pieces used by the school-specific screens:

     • SchoolSelectPrompt — the full "Dooro dugsiga aad rabto inaad
       maamusho." instruction/empty state shown while a Super Admin has NOT
       yet picked a school. It lists the REAL schools from Supabase and lets
       them pick one; picking stores the real uuid as the active school.

     • SuperAdminSchoolBar — a compact banner shown at the top of a school
       screen once a school IS selected, showing its name and a "Beddel
       dugsi" button to switch (clears the selection → the prompt returns).

   Both are inert for a School Admin (they never render). Nothing here can
   send a non-uuid to a query — selection always goes through
   SchoolContext.setActiveSchool, which only accepts a real uuid.
   ============================================================ */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useSchools } from '../context/SchoolContext';
import Icon from './Icon';

export function SchoolSelectPrompt() {
  const { c } = useTheme();
  const { schools, schoolsLoading, schoolsError, setActiveSchool, reloadSchools } = useSchools();

  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]}>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.iconBadge, { backgroundColor: c.blueSoft }]}>
          <Icon name="building" size={24} color={c.blue} strokeWidth={2} />
        </View>
        <Text style={[styles.title, { color: c.ink }]}>Dooro Dugsi</Text>
        <Text style={[styles.sub, { color: c.muted }]}>Dooro dugsiga aad rabto inaad maamusho.</Text>

        {schoolsLoading ? (
          <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
        ) : schoolsError ? (
          <View style={styles.state}>
            <Text style={[styles.err, { color: c.rose }]}>{schoolsError}</Text>
            <TouchableOpacity onPress={reloadSchools}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity>
          </View>
        ) : schools.length === 0 ? (
          <View style={styles.state}>
            <Text style={[styles.sub, { color: c.muted }]}>Weli dugsi lama abuurin. Ka abuur "Register New School".</Text>
            <TouchableOpacity onPress={reloadSchools}><Text style={[styles.retry, { color: c.blue }]}>Dib u cusboonaysii</Text></TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={{ width: '100%', maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {schools.map((s) => (
              <TouchableOpacity key={s.id} onPress={() => setActiveSchool(s.id)} activeOpacity={0.85}
                style={[styles.row, { borderColor: c.line, backgroundColor: c.bg }]}>
                <View style={[styles.rowEmblem, { backgroundColor: c.blueSoft }]}>
                  <Text style={[styles.rowEmblemTxt, { color: c.blue }]}>{(s.name || '?').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowName, { color: c.ink }]} numberOfLines={1}>{s.name}</Text>
                  <Text style={[styles.rowMeta, { color: c.muted }]} numberOfLines={1}>{[s.city, s.status].filter(Boolean).join(' · ')}</Text>
                </View>
                <Icon name="chevronRight" size={16} color={c.muted2} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

export function SuperAdminSchoolBar() {
  const { c } = useTheme();
  const { isSuperAdmin, active, setActiveSchool } = useSchools();
  if (!isSuperAdmin || !active) return null;
  return (
    <View style={[styles.bar, { backgroundColor: c.blueSoft, borderColor: c.line }]}>
      <Icon name="building" size={15} color={c.blue} strokeWidth={2.2} />
      <Text style={[styles.barName, { color: c.navy || c.ink }]} numberOfLines={1}>{active.name}</Text>
      <TouchableOpacity onPress={() => setActiveSchool(null)} hitSlop={8} style={styles.barBtn}>
        <Text style={[styles.barBtnTxt, { color: c.blue }]}>Beddel dugsi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 460, borderWidth: 1, borderRadius: 20, padding: 22, alignItems: 'center' },
  iconBadge: { width: 52, height: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 19, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6, lineHeight: 19 },
  state: { alignItems: 'center', paddingVertical: 18, gap: 8 },
  err: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10, width: '100%' },
  rowEmblem: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowEmblemTxt: { fontSize: 16, fontWeight: '800' },
  rowName: { fontSize: 14.5, fontWeight: '800' },
  rowMeta: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12 },
  barName: { flex: 1, fontSize: 13, fontWeight: '800' },
  barBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  barBtnTxt: { fontSize: 12.5, fontWeight: '800' },
});
