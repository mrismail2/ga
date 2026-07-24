import React, { useState, useMemo, useId } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { shadow } from '../theme/colors';
import { useLessons } from '../context/LessonsContext';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import StatCard from '../components/StatCard';
import StudentProfileModal from '../components/StudentProfileModal';
import LessonDetailModal from '../components/LessonDetailModal';
import { studentDetail } from '../data/mock';
import { TEACHERS } from '../data/datasets';

/* ============================================================
   Ministry (Wasaarad) portal — reached from the landing page, gated by the
   school's review code. The ministry is NOT a logged-in user: with a valid
   code it gets a READ-ONLY window on exactly SIX things and nothing else:
     1. the school's total number of students,
     2. how many teachers work there,
     3. every guardian's (waalid) mobile number,
     4. each student's profile (same UI the school itself uses),
     5. student attendance,
     6. the lesson plans the admin has APPROVED (with cabasho/talo feedback
        the teacher then sees in the app).
   No exams, finance, incidents or messages ever reach this screen.
   ============================================================ */

// the review code belongs to ONE school — Dugsiga Hidaayada (school_001)
const SCHOOL_ID = 'school_001';

const TABS = [
  { key: 'guud', label: 'Guud', icon: 'dashboard' },
  { key: 'arday', label: 'Ardayda', icon: 'students' },
  { key: 'xaadiris', label: 'Xaadiriska', icon: 'attendance' },
  { key: 'cashar', label: 'Casharrada', icon: 'lessons' },
];

function attTone(c, att) {
  return att >= 90 ? c.green : att >= 80 ? c.gold700 : c.rose;
}

/* a box filled with a diagonal navy gradient (same technique as StatCard).
   viewBox + preserveAspectRatio stretch the rect to any size safely. */
function GradientBox({ g1 = '#13458F', g2 = '#0A2E6B', style, children }) {
  const gid = 'mg' + useId().replace(/[:]/g, '');
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={g1} />
            <Stop offset="1" stopColor={g2} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#${gid})`} />
      </Svg>
      {children}
    </View>
  );
}

export default function MinistryReviewScreen({ onBack }) {
  const { c } = useTheme();
  const { lessons, reviewCode, addMinistryFeedback } = useLessons();
  const { data } = useAppData();

  const [code, setCode] = useState('');
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('guud');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null); // student for the profile modal
  const [lessonDetail, setLessonDetail] = useState(null); // approved lesson modal

  // only ADMIN-APPROVED lesson plans ever reach the ministry
  const approved = useMemo(() => lessons.filter((l) => l.status === 'approved'), [lessons]);
  // keep the open lesson in sync with context updates (new feedback)
  const liveLessonDetail = lessonDetail ? lessons.find((l) => l.id === lessonDetail.id) || lessonDetail : null;

  // ---- the ONLY data the ministry may read (one school, active students) ----
  const school = useMemo(
    () => (data.schools || []).find((s) => s.school_id === SCHOOL_ID) || { name: 'Dugsiga', school_id: SCHOOL_ID },
    [data.schools]
  );
  const classNameById = useMemo(() => {
    const m = {};
    (data.classes || []).forEach((k) => { if (k.school_id === SCHOOL_ID) m[k.class_id] = k.name; });
    return m;
  }, [data.classes]);
  const students = useMemo(() => {
    const list = (data.students || []).filter((s) => s.school_id === SCHOOL_ID && s.status === 'active');
    // enrich once: class name + deterministic guardian contact (same source
    // the school's own profile modal uses, so both views always agree)
    return list
      .map((s) => {
        const d = studentDetail(s.name || s.full_name, s.student_id || '', s);
        return { ...s, className: classNameById[s.class_id] || '—', parentName: d.parent, parentPhone: d.phone };
      })
      .sort((a, b) => (a.className + a.name).localeCompare(b.className + b.name));
  }, [data.students, classNameById]);

  const teacherCount = TEACHERS.length;
  const avgAtt = students.length ? Math.round(students.reduce((a, s) => a + (s.att || 0), 0) / students.length) : 0;
  const lowAtt = students.filter((s) => (s.att || 0) < 80);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      [s.name, s.student_id, s.className, s.parentName, s.parentPhone]
        .some((v) => String(v || '').toLowerCase().indexOf(q) !== -1));
  }, [students, query]);

  const byAtt = useMemo(() => [...students].sort((a, b) => (a.att || 0) - (b.att || 0)), [students]);

  const submit = () => {
    if (code.trim().toUpperCase() === reviewCode.toUpperCase()) { setGranted(true); setError(''); }
    else setError('Lambarka eegista waa qaldan yahay. Isku day mar kale.');
  };
  const leave = () => { setGranted(false); setCode(''); setTab('guud'); setQuery(''); };

  // ---- gate: enter the review code (login-ka wasaaradda) ----
  if (!granted) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.gateWrap}>
          {/* soft decorative shapes behind the card */}
          <View style={[styles.blob, { backgroundColor: c.blueSoft, width: 300, height: 300, top: -110, right: -90 }]} />
          <View style={[styles.blob, { backgroundColor: c.goldSoft, width: 240, height: 240, bottom: -90, left: -70 }]} />
          <View style={[styles.blob, { backgroundColor: c.greenSoft, width: 130, height: 130, top: '30%', left: -60 }]} />

          <TouchableOpacity onPress={onBack} hitSlop={10} style={styles.backLink}>
            <Icon name="back" size={20} color={c.muted} />
            <Text style={[styles.backTxt, { color: c.muted }]}>Ku noqo</Text>
          </TouchableOpacity>

          <View style={[styles.gateCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.card]}>
            {/* gradient shield emblem */}
            <GradientBox style={styles.gateEmblem}>
              <View style={styles.gateEmblemInner}>
                <Icon name="shield" size={34} color="#fff" />
              </View>
            </GradientBox>

            <Text style={[styles.gateTitle, { color: c.ink }]}>Eegista Wasaaradda</Text>
            <View style={[styles.goldLine, { backgroundColor: c.gold }]} />
            <Text style={[styles.gateSub, { color: c.muted }]}>
              Geli lambarka eegista ee dugsigu ku siiyay si aad u aragto xogta dugsiga.
            </Text>

            <View style={[styles.inputWrap, { backgroundColor: c.bg, borderColor: error ? c.rose : c.line }]}>
              <Icon name="key" size={18} color={error ? c.rose : c.muted} />
              <TextInput
                value={code}
                onChangeText={(t) => { setCode(t.toUpperCase()); setError(''); }}
                onSubmitEditing={submit}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="WAS-XXXX-XXXX"
                placeholderTextColor={c.muted2}
                style={[styles.codeInput, { color: c.ink }]}
              />
            </View>
            {error ? (
              <View style={styles.errRow}>
                <Icon name="alert" size={14} color={c.rose} />
                <Text style={[styles.errTxt, { color: c.rose }]}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              onPress={submit} disabled={!code.trim()} activeOpacity={0.85}
              style={{ width: '100%', opacity: code.trim() ? 1 : 0.5 }}
            >
              <GradientBox style={styles.gateBtn}>
                <View style={styles.gateBtnRow}>
                  <Icon name="shield" size={16} color="#fff" />
                  <Text style={styles.gateBtnTxt}>Gal Eegista</Text>
                </View>
              </GradientBox>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---- portal: read-only dashboard (5 allowed items, nothing else) ----
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      {/* header */}
      <View style={[styles.header, { borderBottomColor: c.line, backgroundColor: c.surface }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.bg, borderColor: c.line }]}>
          <Icon name="back" size={20} color={c.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={[styles.hTitle, { color: c.ink }]} numberOfLines={1}>Eegista Wasaaradda</Text>
          <Text style={[styles.hSub, { color: c.muted }]} numberOfLines={1}>{school.name}</Text>
        </View>
        <Badge label={reviewCode} tone="green" />
        <TouchableOpacity onPress={leave} hitSlop={10} style={[styles.leaveBtn, { borderColor: c.line }]}>
          <Text style={[styles.leaveTxt, { color: c.rose }]}>Ka bax</Text>
        </TouchableOpacity>
      </View>

      {/* tabs */}
      <View style={[styles.tabs, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, on && { backgroundColor: c.blueSoft }]} activeOpacity={0.8}>
              <Icon name={t.icon} size={16} color={on ? c.navy : c.muted} />
              <Text style={[styles.tabTxt, { color: on ? c.navy : c.muted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 1) GUUD — the school at a glance */}
      {tab === 'guud' ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: c.navy }]}>
            <View style={styles.heroEmblem}>
              <Text style={[styles.heroInitials, { color: c.navy }]}>
                {String(school.name || 'D').replace(/^Dugsiga\s+/i, '').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
              <Text style={styles.heroName} numberOfLines={1}>{school.name}</Text>
              <Text style={styles.heroSub}>Warbixinta guud ee Wasaaradda</Text>
            </View>
          </View>

          <View style={styles.grid}>
            <StatCard label="Tirada Guud ee Ardayda" value={String(students.length)} icon="students" tone="blue" />
            <StatCard label="Macallimiinta Hawlgala" value={String(teacherCount)} icon="teachers" tone="gold" />
            <StatCard label="Celceliska Xaadiriska" value={avgAtt + '%'} icon="attendance" tone="green" />
            <StatCard label="Xaadiris Hooseeya (<80%)" value={String(lowAtt.length)} icon="alert" tone="rose" />
          </View>
        </ScrollView>
      ) : null}

      {/* 2) ARDAYDA — profiles + guardian mobile numbers */}
      {tab === 'arday' ? (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.student_internal_id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="search" size={17} color={c.muted} />
              <TextInput
                value={query} onChangeText={setQuery}
                placeholder="Raadi arday (magac, ID, fasal, waalid…)"
                placeholderTextColor={c.muted2}
                style={[styles.searchInput, { color: c.ink }]}
              />
              <Text style={[styles.countTxt, { color: c.muted }]}>{filtered.length}</Text>
            </View>
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>🔍 Arday lama helin.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
              activeOpacity={0.85} onPress={() => setDetail(item)}
            >
              <View style={styles.cardTop}>
                <Avatar name={item.name} code={item.student_internal_id} size={40} />
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.stuMeta, { color: c.muted }]} numberOfLines={1}>{item.student_id || '—'} · {item.className}</Text>
                </View>
                <Icon name="chevronRight" size={16} color={c.muted2} />
              </View>
              {/* mobile-ka waalidka — always visible on the row */}
              <View style={[styles.parentRow, { backgroundColor: c.bg }]}>
                <Icon name="phone" size={14} color={c.green} />
                <Text style={[styles.parentName, { color: c.ink2 }]} numberOfLines={1}>{item.parentName}</Text>
                <Text style={[styles.parentPhone, { color: c.navy }]}>{item.parentPhone}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : null}

      {/* 3) XAADIRISKA — attendance, lowest first so problems surface */}
      {tab === 'xaadiris' ? (
        <FlatList
          data={byAtt}
          keyExtractor={(s) => s.student_internal_id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.chipRow}>
              <Badge label={`Fiican ≥90%: ${students.filter((s) => (s.att || 0) >= 90).length}`} tone="green" />
              <Badge label={`Dhexe 80–89%: ${students.filter((s) => (s.att || 0) >= 80 && (s.att || 0) < 90).length}`} tone="gold" />
              <Badge label={`Hooseeya <80%: ${lowAtt.length}`} tone="rose" />
            </View>
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>🗂️ Xog xaadiris lama helin.</Text>}
          renderItem={({ item }) => {
            const att = item.att || 0;
            const tone = attTone(c, att);
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
                activeOpacity={0.85} onPress={() => setDetail(item)}
              >
                <View style={styles.cardTop}>
                  <Avatar name={item.name} code={item.student_internal_id} size={36} />
                  <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                    <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.stuMeta, { color: c.muted }]} numberOfLines={1}>{item.className}</Text>
                  </View>
                  <Text style={[styles.attPct, { color: tone }]}>{att}%</Text>
                </View>
                <View style={[styles.attTrack, { backgroundColor: c.line }]}>
                  <View style={[styles.attFill, { width: `${Math.max(0, Math.min(100, att))}%`, backgroundColor: tone }]} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : null}

      {/* 4) CASHARRADA — admin-approved lesson plans (sidii hore), read-only
             plus the ministry's cabasho/talo feedback the teacher then sees */}
      {tab === 'cashar' ? (
        <FlatList
          data={approved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.chipRow}>
              <Badge label={`${approved.length} cashar la ansixiyay`} tone="green" />
            </View>
          }
          ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>🗂️ Weli cashar la ansixiyay ma jiro.</Text>}
          renderItem={({ item }) => {
            const fbN = (item.ministry_feedback || []).length;
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
                activeOpacity={0.85} onPress={() => setLessonDetail(item)}
              >
                <View style={styles.lessonTop}>
                  <Text style={[styles.lessonTitle, { color: c.ink }]} numberOfLines={1}>{item.title}</Text>
                  <Icon name="chevronRight" size={16} color={c.muted} />
                </View>
                <View style={styles.lessonMetaRow}>
                  <Icon name="lessons" size={13} color={c.muted} />
                  <Text style={[styles.lessonMeta, { color: c.muted }]}>{item.subject} · {item.cls}</Text>
                </View>
                <View style={styles.lessonMetaRow}>
                  <Avatar name={item.teacher} code={item.teacher} size={22} />
                  <Text style={[styles.lessonMeta, { color: c.ink2 }]}>{item.teacher}</Text>
                  {fbN ? (
                    <View style={[styles.fbCount, { backgroundColor: c.roseSoft }]}>
                      <Icon name="shield" size={11} color={c.rose} />
                      <Text style={[styles.fbCountTxt, { color: c.rose }]}>{fbN}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : null}

      {/* the SAME student profile UI the school uses — locked to read-only */}
      <StudentProfileModal
        visible={!!detail}
        student={detail}
        className={detail ? detail.className : ''}
        readOnly
        onClose={() => setDetail(null)}
      />

      {/* approved lesson detail — ministry mode allows leaving cabasho/talo */}
      <LessonDetailModal
        visible={!!liveLessonDetail}
        lesson={liveLessonDetail}
        ministryMode
        onFeedback={addMinistryFeedback}
        onClose={() => setLessonDetail(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },

  /* gate */
  gateWrap: { flex: 1, padding: 20, justifyContent: 'center', overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  backLink: { position: 'absolute', top: 16, left: 16, flexDirection: 'row', alignItems: 'center', gap: 4, zIndex: 2 },
  backTxt: { fontSize: 13.5, fontWeight: '700' },
  gateCard: { borderWidth: 1, borderRadius: 26, paddingVertical: 32, paddingHorizontal: 28, alignItems: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' },
  gateEmblem: { width: 78, height: 78, borderRadius: 24, marginBottom: 18 },
  gateEmblemInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gateTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  goldLine: { width: 44, height: 4, borderRadius: 2, marginTop: 10 },
  gateSub: { fontSize: 13.5, fontWeight: '500', textAlign: 'center', marginTop: 12, lineHeight: 20, maxWidth: 320 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 16, height: 56, marginTop: 22 },
  codeInput: { flex: 1, fontSize: 16.5, fontWeight: '800', textAlign: 'center', letterSpacing: 3, paddingVertical: 0, height: '100%' },
  errRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  errTxt: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  gateBtn: { width: '100%', height: 54, borderRadius: 14, marginTop: 18 },
  gateBtnRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  gateBtnTxt: { color: '#fff', fontSize: 15.5, fontWeight: '800', letterSpacing: 0.3 },

  /* portal header + tabs */
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hTitle: { fontSize: 16.5, fontWeight: '800' },
  hSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  leaveBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  leaveTxt: { fontSize: 12, fontWeight: '800' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tabTxt: { fontSize: 13, fontWeight: '800' },

  /* shared content column (centered on wide screens) */
  content: { padding: 16, paddingBottom: 32, width: '100%', maxWidth: 860, alignSelf: 'center' },

  /* guud */
  hero: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16 },
  heroEmblem: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroInitials: { fontSize: 17, fontWeight: '900' },
  heroName: { color: '#fff', fontSize: 16.5, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },

  /* ardayda */
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 0 },
  countTxt: { fontSize: 12, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  stuName: { fontSize: 14.5, fontWeight: '800' },
  stuMeta: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 10 },
  parentName: { flex: 1, fontSize: 12.5, fontWeight: '700' },
  parentPhone: { fontSize: 12.5, fontWeight: '800' },
  empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 30 },

  /* xaadiris */
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  attPct: { fontSize: 15, fontWeight: '900', marginLeft: 10 },
  attTrack: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  attFill: { height: 6, borderRadius: 3 },

  /* casharrada (approved lesson plans) */
  lessonTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lessonTitle: { flex: 1, fontSize: 15.5, fontWeight: '800' },
  lessonMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6 },
  lessonMeta: { fontSize: 12.5, fontWeight: '600' },
  fbCount: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 'auto' },
  fbCountTxt: { fontSize: 11, fontWeight: '800' },
});
