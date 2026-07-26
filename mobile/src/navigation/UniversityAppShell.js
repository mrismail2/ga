/* ============================================================
   Kobciye — University Mode shell (Phase 3 foundation)

   Completely separate from School Mode's RootNavigator/DesktopShell — see
   App.js's NavWrapper, which renders this ONLY when the signed-in user's
   school has institution_type === 'university' (config/institutionTypes.js).
   A university user must never see School Mode terminology or nav
   (Fasallada, Waalidiinta, Primary/Secondary, Streams, …) and a school user
   must never see this shell — enforced by keeping the two completely
   separate files/components rather than branching inside a shared one.

   Phase 4: the core-management items (Faculties, Departments, Programmes,
   Academic Years, Semesters, Courses, Lecturers, Students, Registration)
   are REAL now — each renders the generic P4ModuleView over the Phase 4
   university tables (live Supabase data under the caller's own JWT; RLS
   enforces isolation). Transcripts and Results stay honest "not built yet"
   states (Phase 5+); Cohorts/Levels are captured per-student (foundation).
   ============================================================ */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Icon from '../components/Icon';
import P4ModuleView from '../components/P4ModuleView';
import { UNIVERSITY_MODULES, UNIVERSITY_COUNT_TABLES } from '../config/phase4Modules';
import { p4Counts, p4FriendlyError } from '../services/phase4';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { UNIVERSITY_NAV_ITEMS, UNIVERSITY_PRIMARY_TAB_KEYS } from '../config/navigationByInstitutionType';
import TranscriptsScreen from '../screens/phase5/TranscriptsScreen';

export default function UniversityAppShell() {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { schoolName, profile, signOut } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const [activeKey, setActiveKey] = useState('dashboard');
  const [showMore, setShowMore] = useState(false);

  // Phase 5: Transcripts is now real (course results snapshot → GPA). Only
  // 'results' remains a later-phase university detail view.
  const phase4Items = UNIVERSITY_NAV_ITEMS.filter((item) => item.key !== 'results');
  const active = phase4Items.find((i) => i.key === activeKey) || phase4Items[0];
  const primaryItems = phase4Items.filter((i) => UNIVERSITY_PRIMARY_TAB_KEYS.includes(i.key));
  const moreItems = phase4Items.filter((i) => !UNIVERSITY_PRIMARY_TAB_KEYS.includes(i.key));

  const select = (key) => { setActiveKey(key); setShowMore(false); };

  // Phase 4: real per-university counts. An empty university legitimately
  // returns zeroes; a network/RLS failure is kept separate and shown instead
  // of being rendered as misleading zero data.
  const [countState, setCountState] = useState({ counts: null, loading: false, error: null });
  const countRequestSeq = React.useRef(0);
  const reloadCounts = React.useCallback(() => {
    const requestId = ++countRequestSeq.current;
    if (!schoolId) {
      setCountState({ counts: null, loading: false, error: 'Jaamacad sax ah laguma xidhna akoonkan.' });
      return () => { if (countRequestSeq.current === requestId) countRequestSeq.current += 1; };
    }
    setCountState((prev) => ({ counts: prev.counts, loading: true, error: null }));
    p4Counts(schoolId, UNIVERSITY_COUNT_TABLES)
      .then((counts) => {
        if (countRequestSeq.current === requestId) setCountState({ counts, loading: false, error: null });
      })
      .catch((error) => {
        if (countRequestSeq.current === requestId) setCountState({ counts: null, loading: false, error: p4FriendlyError(error) });
      });
    return () => { if (countRequestSeq.current === requestId) countRequestSeq.current += 1; };
  }, [schoolId]);
  useEffect(() => reloadCounts(), [reloadCounts, activeKey]);
  const counts = countState.counts;

  const p4Module = UNIVERSITY_MODULES.find((m) => m.key === activeKey) || null;

  const NavList = ({ items }) => (
    <>
      {items.map((item) => {
        const on = item.key === activeKey;
        return (
          <TouchableOpacity key={item.key} onPress={() => select(item.key)} activeOpacity={0.85}
            style={[styles.navItem, on && { backgroundColor: c.navy }]}>
            <Icon name={item.icon} size={18} color={on ? '#fff' : c.muted} />
            <Text style={[styles.navItemTxt, { color: on ? '#fff' : c.ink }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  const content = (
    <View style={styles.content}>
      {active.key === 'settings' ? (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.identityName, { color: c.ink }]}>{(profile && profile.full_name) || 'University Admin'}</Text>
          <Text style={[styles.identitySub, { color: c.muted }]}>{schoolName || 'Kobciye University'}</Text>
          <TouchableOpacity style={[styles.signOutBtn, { borderColor: c.rose }]} onPress={signOut} activeOpacity={0.85}>
            <Icon name="key" size={15} color={c.rose} />
            <Text style={[styles.signOutTxt, { color: c.rose }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      ) : active.key === 'dashboard' ? (
        /* Phase 4: real zero counts for an empty university — no fake data */
        <View style={styles.countGrid}>
          {countState.error ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.rose, width: '100%' }]}>
              <Text style={[styles.emptySub, { color: c.rose, textAlign: 'left', maxWidth: undefined }]}>{countState.error}</Text>
              <TouchableOpacity onPress={() => reloadCounts()} activeOpacity={0.85} style={{ marginTop: 10 }}>
                <Text style={{ color: c.blue, fontWeight: '800' }}>Isku day mar kale</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {countState.loading && !counts ? (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line, width: '100%' }]}>
              <Text style={[styles.emptySub, { color: c.muted, textAlign: 'left', maxWidth: undefined }]}>Tirooyinka jaamacadda waa la soo dejinayaa…</Text>
            </View>
          ) : null}
          {counts ? [
            ['university_students', 'Students', 'students'],
            ['faculties', 'Kulliyadaha', 'building'],
            ['programmes', 'Programmes', 'note'],
            ['courses', 'Courses', 'lessons'],
          ].map(([t, label, icon]) => (
            <View key={t} style={[styles.countTile, { backgroundColor: c.surface, borderColor: c.line }]}>
              <View style={[styles.countIcon, { backgroundColor: c.blueSoft }]}>
                <Icon name={icon} size={18} color={c.blue} strokeWidth={2} />
              </View>
              <Text style={[styles.countVal, { color: c.ink }]}>{String(counts[t] || 0)}</Text>
              <Text style={[styles.countLbl, { color: c.muted }]}>{label}</Text>
            </View>
          )) : null}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line, width: '100%' }]}>
            <Text style={[styles.emptySub, { color: c.muted, textAlign: 'left', maxWidth: undefined }]}>
              Jaamacaddaadu waxay bilaabmaysaa madhan. U gudub Kulliyadaha, Programmes, Courses iyo Students si aad ugu darto diiwaannadaada ugu horreeya.
            </Text>
          </View>
        </View>
      ) : active.key === 'transcripts' ? (
        /* Phase 5: real university transcripts (published course-result GPA snapshot) */
        <TranscriptsScreen />
      ) : p4Module ? (
        /* Phase 4: real CRUD over the university tables (RLS-scoped) */
        <P4ModuleView module={p4Module} />
      ) : active.key === 'cohorts' ? (
        <View style={[styles.card, styles.emptyBox, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name={active.icon} size={28} color={c.muted2} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>{active.label}</Text>
          <Text style={[styles.emptySub, { color: c.muted }]}>
            Cohort-ka iyo Level-ka waxaa lagu qoraa diiwaanka ardayga (Students → Cohort / Level) — liis gaar ah looma baahna.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, styles.emptyBox, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name={active.icon} size={28} color={c.muted2} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>{active.label}</Text>
          <Text style={[styles.emptySub, { color: c.muted }]}>
            Nidaamkan wali lama dhisin — wuxuu iman doonaa marxaladaha soo socda ee horumarinta.
          </Text>
        </View>
      )}
    </View>
  );

  if (wide) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <View style={styles.wideRow}>
          <View style={[styles.sidebar, { backgroundColor: c.surface, borderRightColor: c.line }]}>
            <Text style={[styles.brand, { color: c.navy }]}>Kobciye — Jaamacad</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <NavList items={phase4Items} />
            </ScrollView>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
            <Text style={[styles.contentTitle, { color: c.ink }]}>{active.label}</Text>
            {content}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        <Text style={[styles.contentTitle, { color: c.ink }]}>{active.label}</Text>
        {content}
      </ScrollView>
      <View style={[styles.tabBar, { backgroundColor: c.surface, borderTopColor: c.line }]}>
        {primaryItems.map((item) => {
          const on = item.key === activeKey && !showMore;
          return (
            <TouchableOpacity key={item.key} onPress={() => select(item.key)} style={styles.tabBtn} activeOpacity={0.8}>
              <Icon name={item.icon} size={20} color={on ? c.navy : c.muted2} />
              <Text style={[styles.tabTxt, { color: on ? c.navy : c.muted2 }]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={() => setShowMore((v) => !v)} style={styles.tabBtn} activeOpacity={0.8}>
          <Icon name="settings" size={20} color={showMore ? c.navy : c.muted2} />
          <Text style={[styles.tabTxt, { color: showMore ? c.navy : c.muted2 }]}>Dheeraad</Text>
        </TouchableOpacity>
      </View>
      {showMore ? (
        <View style={[styles.moreSheet, { backgroundColor: c.surface, borderColor: c.line }]}>
          <NavList items={moreItems} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wideRow: { flex: 1, flexDirection: 'row' },
  sidebar: { width: 240, borderRightWidth: 1, padding: 16 },
  brand: { fontSize: 15, fontWeight: '800', marginBottom: 18 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, marginBottom: 4 },
  navItemTxt: { fontSize: 13.5, fontWeight: '700' },
  content: { marginTop: 4 },
  contentTitle: { fontSize: 21, fontWeight: '800', marginBottom: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 20 },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 34 },
  emptyTitle: { fontSize: 15.5, fontWeight: '800', marginTop: 4 },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  identityName: { fontSize: 16, fontWeight: '800' },
  identitySub: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 12, borderWidth: 1.5, marginTop: 20 },
  signOutTxt: { fontSize: 13.5, fontWeight: '800' },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', borderTopWidth: 1, height: 64, paddingBottom: 8, paddingTop: 6 },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabTxt: { fontSize: 10.5, fontWeight: '700' },
  moreSheet: { position: 'absolute', left: 12, right: 12, bottom: 72, borderRadius: 16, borderWidth: 1, padding: 10 },
  countGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  countTile: { flexGrow: 1, minWidth: 140, borderWidth: 1, borderRadius: 16, padding: 14 },
  countIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  countVal: { fontSize: 22, fontWeight: '800', marginTop: 10 },
  countLbl: { fontSize: 12, fontWeight: '600', marginTop: 1 },
});
