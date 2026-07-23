import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, shadow } from '../theme/colors';
import { usePhotos } from '../context/PhotoContext';
import { useSchools } from '../context/SchoolContext';
import { useRole } from '../context/RoleContext';
import Icon from './Icon';
import { CLASSES, classId } from '../data/mock';

function initials(name) {
  const words = name.replace(/^Dugsiga\s+/i, '').split(' ');
  return (words[0][0] + (words[1] ? words[1][0] : (words[0][1] || ''))).toUpperCase();
}

function Emblem({ school, size, photos }) {
  const { c } = useTheme();
  const logo = photos['school_' + (school.id || school.name)];
  if (logo) return <Image source={{ uri: logo }} style={{ width: size, height: size, borderRadius: size * 0.28 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.navy, fontWeight: '800', fontSize: size * 0.38 }}>{initials(school.name)}</Text>
    </View>
  );
}

/* School identity banner + branch switcher. An admin can run several
   branches (e.g. Hidaaya Primary + Hidaaya Secondary), switch between
   them, upload each one's logo, and add a new branch. */
export default function SchoolHero({ school: forced, typeLabel }) {
  const { c } = useTheme();
  const { photos, pickPhoto } = usePhotos();
  const { schools, active, setActive } = useSchools();
  const { role, profile } = useRole();
  const [open, setOpen] = useState(false);

  // Only the School Admin may upload/replace the school logo.
  const canEditLogo = role === 'schooladmin';

  // Super Admin passes a forced platform "school"; otherwise use the admin's active branch.
  const school = forced || active;
  if (!school) return null;
  // only the School Admin manages branches (switch / add); everyone else
  // sees a static banner for their one school. In LIVE mode (real Supabase
  // school) branch switching/adding is disabled — that path writes the demo
  // AsyncStorage store, and real + demo school data must never mix.
  const isSwitchable = !forced && role === 'schooladmin' && !(school && school.live) && schools.length >= 1;
  const key = 'school_' + (school.id || school.name);
  const logo = photos[key];

  // the banner number is scoped to the role: a teacher sees their own
  // classes' students, a parent their children, a student nothing extra,
  // and an admin/accountant the whole school.
  const heroKpi = () => {
    if (role === 'teacher') {
      // count by CANONICAL assigned_class_ids (global class_id), never by name
      const cls = profile.assigned_class_ids || [];
      const total = CLASSES.filter((cl) => cls.indexOf(classId(cl)) !== -1).reduce((a, cl) => a + (cl[3] || 0), 0);
      return { val: String(total), lbl: 'Ardaydayda' };
    }
    if (role === 'parent') return { val: String((profile.childNames || []).length), lbl: 'Caruur' };
    if (role === 'student') return null; // their class already shows on a card
    if (school.students != null) return { val: String(school.students), lbl: 'Arday' };
    return null;
  };
  const kpi = heroKpi();

  return (
    <>
      <View style={[styles.hero, { backgroundColor: c.navy }, shadow.card]}>
        <View style={[styles.glow, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />

        {/* logo emblem — only the School Admin may upload/replace it */}
        <TouchableOpacity activeOpacity={canEditLogo ? 0.85 : 1} onPress={() => canEditLogo && pickPhoto(key)} style={styles.emblemWrap}>
          {logo ? (
            <Image source={{ uri: logo }} style={styles.emblemImg} />
          ) : (
            <View style={[styles.emblem, { backgroundColor: '#fff' }]}>
              <Text style={[styles.emblemTxt, { color: c.navy }]}>{initials(school.name)}</Text>
            </View>
          )}
          {canEditLogo ? (
            <View style={[styles.camBadge, { backgroundColor: c.blue }]}>
              <Icon name="camera" size={11} color="#fff" strokeWidth={2} />
            </View>
          ) : null}
        </TouchableOpacity>

        {/* name — tap to switch branch */}
        <TouchableOpacity activeOpacity={isSwitchable ? 0.7 : 1} onPress={() => isSwitchable && setOpen(true)} style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{school.name}</Text>
            <View style={[styles.verified, { backgroundColor: c.blue }]}>
              <Icon name="check" size={9} color="#fff" strokeWidth={3} />
            </View>
            {isSwitchable ? <Text style={styles.chev}>▾</Text> : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>{(typeLabel || school.type)} · {school.city}</Text>
        </TouchableOpacity>

        {kpi ? (
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{kpi.val}</Text>
            <Text style={styles.kpiLbl}>{kpi.lbl}</Text>
          </View>
        ) : null}
      </View>

      {/* branch switcher */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.sheetTitle, { color: c.ink }]}>Dugsiyada aad maamusho</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {schools.map((s) => {
                const on = s.id === active.id;
                return (
                  <TouchableOpacity key={s.id} style={[styles.row, on && { backgroundColor: c.blueSoft }]} onPress={() => { setActive(s.id); setOpen(false); }} activeOpacity={0.7}>
                    <Emblem school={s} size={40} photos={photos} />
                    <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                      <Text style={[styles.rName, { color: c.ink }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[styles.rSub, { color: c.muted }]} numberOfLines={1}>{s.type} · {s.city}</Text>
                    </View>
                    {on ? <Icon name="check" size={18} color={c.blue} strokeWidth={2.5} /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, padding: 18, overflow: 'hidden', marginBottom: 14 },
  glow: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60 },
  emblemWrap: { width: 56, height: 56 },
  emblem: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  emblemImg: { width: 56, height: 56, borderRadius: 16 },
  emblemTxt: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  camBadge: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0A2E6B' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: '#fff', fontSize: 19, fontWeight: '800', flexShrink: 1 },
  verified: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chev: { color: 'rgba(255,255,255,.85)', fontSize: 12, marginLeft: 2 },
  meta: { color: 'rgba(255,255,255,.75)', fontSize: 13, marginTop: 3, fontWeight: '600' },
  kpi: { alignItems: 'center', paddingLeft: 10 },
  kpiVal: { color: '#fff', fontSize: 20, fontWeight: '800' },
  kpiLbl: { color: 'rgba(255,255,255,.7)', fontSize: 11, marginTop: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: radius.lg, padding: 16 },
  sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, marginBottom: 4 },
  rName: { fontSize: 14.5, fontWeight: '700' },
  rSub: { fontSize: 12, marginTop: 1 },
});
