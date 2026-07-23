import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import { shadow } from '../theme/colors';
import { CLASSES, SCHOOL2_CLASSES, attendanceHistory } from '../data/mock';
import { getTeacherAllowedClasses, hasPermission, classId, filterClassesForProfile } from '../data/access';
import { getParentChildren, getStudentByInternalId, getClassById } from '../data/identity';
import { useAppData } from '../context/AppDataContext';
import { selectStudentsByClass } from '../utils/dataSelectors';
import { saveClassAttendance, getClassMarksMap, getStudentAttendance, getAttendanceHistoryForParent, getAttendanceHistoryForStudent, reasonRequired } from '../services/attendanceStorage';

/* preset reasons offered when a student is not present */
const REASONS = ['Jirro', 'Fasax la ogolyahay', 'Sabab qoyseed', 'Gaadiid la waayay', 'Kale'];
const ATT_DATE = '2026-06-22';      // the register's date (ISO) for the prototype
const ATT_DATE_LABEL = '22 Juun 2026';

/* The four attendance states, shared by the editor and the viewer. */
const STATES = [
  { key: 'present', label: 'Jooga', tone: '#16A34A', icon: 'check' },
  { key: 'late', label: 'Soo daahay', tone: '#CFAD5E', icon: 'clock' },
  { key: 'excused', label: 'Erid', tone: '#2F6BF0', icon: 'note' },
  { key: 'absent', label: 'Maqan', tone: '#E5484D', icon: 'close' },
];
const ST = STATES.reduce((m, s) => ((m[s.key] = s), m), {});

/* ============================================================
   Xaadirinta — role-aware.

   • Editors (Super Admin / School Admin / Teacher) MARK attendance:
     class picker (a teacher only sees assigned classes), bulk tools,
     per-student state buttons and a save bar.
   • Viewers (Parent / Student) get a READ-ONLY history: they cannot
     change anything — only their own child(ren) / themselves are shown.
   ============================================================ */
export default function AttendanceScreen({ navigation }) {
  const { profile } = useRole();
  const isViewer = profile.scope === 'children' || profile.scope === 'self';
  // Maamulaha (Super/School Admin) sees a GENERAL overview of every class;
  // a teacher marks inside their own class (assigned classes only).
  const isAdmin = profile.scope === 'platform' || profile.scope === 'school';
  if (isViewer) return <ViewerAttendance profile={profile} navigation={navigation} />;
  if (isAdmin) return <AdminAttendance profile={profile} navigation={navigation} />;
  return <EditorAttendance profile={profile} navigation={navigation} />;
}

/* -------- shared header back button -------- */
function BackBtn({ navigation, c }) {
  return (
    <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}
      style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Icon name="back" size={20} color={c.ink} />
    </TouchableOpacity>
  );
}

/* ============================================================
   ADMIN — Maamulaha sees a GENERAL attendance overview of EVERY
   class (xadiris guud). Each class shows today's joog/maqan tally;
   tapping a class opens its register to mark/inspect.
   ============================================================ */
const ALL_CLASSES_ADMIN = [...CLASSES, ...SCHOOL2_CLASSES];

function AdminAttendance({ profile, navigation }) {
  const { c } = useTheme();
  const { data: appData } = useAppData();
  // school isolation: School Admin → own school only, Super Admin → all.
  const classList = useMemo(
    () => filterClassesForProfile(profile, ALL_CLASSES_ADMIN),
    [profile]
  );

  // per-class saved tally for the register date (joog vs guud)
  const [stats, setStats] = useState({});   // class_id -> { present, total, marked }
  useEffect(() => {
    let alive = true;
    Promise.all(
      classList.map((cl) => {
        const sid = cl[7] || 'school_001';
        const cid = classId(cl);
        const total = selectStudentsByClass(appData.students, sid, cid).length;
        return getClassMarksMap(sid, cid, ATT_DATE).then((map) => {
          const codes = Object.keys(map);
          const present = codes.filter((k) => (map[k].status || 'present') === 'present').length;
          return [cid, { present, total, marked: codes.length }];
        });
      })
    ).then((pairs) => {
      if (!alive) return;
      setStats(pairs.reduce((o, [cid, v]) => ((o[cid] = v), o), {}));
    });
    return () => { alive = false; };
  }, [classList, appData.students]);

  // school-wide rollup across every class
  const totals = classList.reduce(
    (o, cl) => {
      const s = stats[classId(cl)];
      if (s) { o.present += s.present; o.total += s.total; o.markedClasses += s.marked > 0 ? 1 : 0; }
      return o;
    },
    { present: 0, total: 0, markedClasses: 0 }
  );
  const schoolPct = totals.total ? Math.round((totals.present / totals.total) * 100) : 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title="Xaadiris Guud"
          subtitle={`Dhammaan fasallada · ${ATT_DATE_LABEL}`}
        />

        {/* school-wide rollup */}
        <View style={[styles.ovHero, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.ovHeroLbl, { color: c.muted }]}>XAADIRISKA DUGSIGA MAANTA</Text>
            <Text style={[styles.ovHeroSub, { color: c.muted2 }]}>
              {totals.markedClasses}/{classList.length} fasal la diiwaangeliyay · {totals.present}/{totals.total} joog
            </Text>
          </View>
          <View style={styles.ovHeroPct}>
            <Text style={[styles.ovHeroPctNum, { color: schoolPct >= 90 ? c.green : schoolPct >= 75 ? c.gold : c.rose }]}>{schoolPct}%</Text>
          </View>
        </View>

        <FlatList
          data={classList}
          keyExtractor={(cl) => classId(cl)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 28 }}
          renderItem={({ item: cl }) => {
            const [nm, , teacher, , , color] = cl;
            const s = stats[classId(cl)] || { present: 0, total: 0, marked: 0 };
            const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
            const tone = s.marked === 0 ? c.muted2 : pct >= 90 ? c.green : pct >= 75 ? c.gold : c.rose;
            return (
              <TouchableOpacity
                style={[styles.ovRow, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}
                onPress={() => navigation.navigate('ClassDetail', { cls: cl })}
                activeOpacity={0.85}
              >
                <View style={[styles.ovEmblem, { backgroundColor: color || c.blue }]}>
                  <Text style={styles.ovEmblemTxt}>{nm.replace(/[^0-9]/g, '') || '★'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <Text style={[styles.ovName, { color: c.ink }]} numberOfLines={1}>{nm}</Text>
                  <Text style={[styles.ovMeta, { color: c.muted }]} numberOfLines={1}>
                    {s.marked === 0 ? `${teacher} · weli lama diiwaangelin` : `${s.present}/${s.total} joog · ${teacher}`}
                  </Text>
                </View>
                <View style={styles.ovRight}>
                  <Text style={[styles.ovPct, { color: tone }]}>{s.marked === 0 ? '—' : pct + '%'}</Text>
                  <Icon name="chevronRight" size={18} color={c.muted2} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
   EDITOR — teachers & admins mark daily attendance
   ============================================================ */
function EditorAttendance({ profile, navigation }) {
  const { c } = useTheme();
  const { data: appData } = useAppData();
  // a teacher only sees the classes assigned to them. getTeacherAllowedClasses
  // returns canonical class_ids, so compare against classId(cl), not the name.
  const allowedIds = getTeacherAllowedClasses(profile);
  const allowed = profile.scope === 'assigned'
    ? CLASSES.filter((cl) => allowedIds.indexOf(classId(cl)) !== -1)
    : CLASSES;
  const classList = allowed.length ? allowed : CLASSES;
  const canMark = hasPermission(profile, 'attendance.mark');

  const [clsIdx, setClsIdx] = useState(0);
  const cls = classList[clsIdx];
  const attSchoolId = cls[7] || 'school_001';
  const attClassId = classId(cls);
  // roster comes from the ONE central store (school_id + class_id)
  const roster = useMemo(
    () => selectStudentsByClass(appData.students, attSchoolId, attClassId),
    [appData.students, attSchoolId, attClassId]
  );
  const [marks, setMarks] = useState({});    // code -> status
  const [reasons, setReasons] = useState({}); // code -> reason
  const [saved, setSaved] = useState(false);
  const [reasonFor, setReasonFor] = useState(null); // code awaiting a reason

  // hydrate from storage whenever the selected class changes, so a saved
  // register reappears when the screen is reopened.
  useEffect(() => {
    let alive = true;
    getClassMarksMap(attSchoolId, attClassId, ATT_DATE).then((map) => {
      if (!alive) return;
      const m = {}, r = {};
      Object.keys(map).forEach((code) => { m[code] = map[code].status; if (map[code].reason) r[code] = map[code].reason; });
      setMarks(m); setReasons(r); setSaved(Object.keys(map).length > 0);
    });
    return () => { alive = false; };
  }, [cls]);

  const choose = (code, status) => {
    setMarks((m) => ({ ...m, [code]: status }));
    setSaved(false);
    if (reasonRequired(status)) setReasonFor(code);        // ask for a reason
    else setReasons((r) => { const n = { ...r }; delete n[code]; return n; });
  };
  const setReason = (code, reason) => {
    setReasons((r) => ({ ...r, [code]: reason }));
    setReasonFor(null);
  };
  const setAll = (status) => {
    const m = {}; roster.forEach((s) => { m[s.student_internal_id] = status; });
    setMarks(m); setSaved(false);
    if (!reasonRequired(status)) setReasons({});
  };

  const counts = STATES.reduce((o, s) => {
    o[s.key] = roster.filter((st) => (marks[st.student_internal_id] || 'present') === s.key).length; return o;
  }, {});
  const present = counts.present;

  const save = async () => {
    const records = roster.map((s) => ({
      student_internal_id: s.student_internal_id,
      status: marks[s.student_internal_id] || 'present',
      reason: reasons[s.student_internal_id] || '',
      notes: '',
    }));
    try {
      await saveClassAttendance(attSchoolId, attClassId, ATT_DATE, records, {
        school_id: profile.school_id || 'school_001',
        recorded_by: profile.name,
      });
      setSaved(true);
    } catch (e) {
      if (e.code === 'reason_required' && e.students && e.students.length) {
        setReasonFor(e.students[0]); // jump to the first student missing a reason
      }
    }
  };

  // teacher without the attendance.mark grant gets a locked state
  if (!canMark) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader title="Xaadirinta" subtitle={cls[0]} right={<BackBtn navigation={navigation} c={c} />} />
          <View style={[styles.locked, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="shield" size={26} color={c.muted} />
            <Text style={[styles.lockedTitle, { color: c.ink }]}>School Admin permission required</Text>
            <Text style={[styles.lockedSub, { color: c.muted }]}>Ogolaanshaha "attendance.mark" lagama helin. La xidhiidh Maamulaha Dugsiga.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const reasonStudent = reasonFor ? roster.find((s) => s.student_internal_id === reasonFor) : null;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title="Xaadirinta"
          subtitle={`${cls[0]} · ${present}/${roster.length} joog · ${ATT_DATE_LABEL}`}
          right={<BackBtn navigation={navigation} c={c} />}
        />

        {/* class picker (filtered per role) */}
        {classList.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
            {classList.map((cl, i) => {
              const on = i === clsIdx;
              return (
                <TouchableOpacity key={cl[0]} onPress={() => { setClsIdx(i); }}
                  style={[styles.chip, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blue : c.surface }]}>
                  <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>{cl[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* live summary */}
        <View style={[styles.summary, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
          {STATES.map((s) => (
            <View key={s.key} style={styles.sumCell}>
              <Text style={[styles.sumNum, { color: s.tone }]}>{counts[s.key]}</Text>
              <Text style={[styles.sumLbl, { color: c.muted }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* bulk tools */}
        <View style={styles.bulk}>
          <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: c.greenSoft }]} onPress={() => setAll('present')}>
            <Icon name="check" size={15} color={c.green} />
            <Text style={[styles.bulkTxt, { color: c.green }]}>Dhammaan Joog</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.bulkBtn, { backgroundColor: c.roseSoft }]} onPress={() => setAll('absent')}>
            <Icon name="close" size={15} color={c.rose} />
            <Text style={[styles.bulkTxt, { color: c.rose }]}>Dhammaan Maqan</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={roster}
          keyExtractor={(s) => s.student_internal_id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
          renderItem={({ item }) => {
            const status = marks[item.student_internal_id] || 'present';
            const reason = reasons[item.student_internal_id];
            return (
              <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <Avatar name={item.name} code={item.student_internal_id} size={36} />
                <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                  <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                  {reason ? (
                    <TouchableOpacity onPress={() => setReasonFor(item.student_internal_id)}>
                      <Text style={[styles.sub, { color: ST[status] ? ST[status].tone : c.muted }]} numberOfLines={1}>Sabab: {reason}</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>{item.student_id}</Text>
                  )}
                </View>
                <View style={styles.states}>
                  {STATES.map((st) => {
                    const on = status === st.key;
                    return (
                      <TouchableOpacity key={st.key}
                        onPress={() => choose(item.student_internal_id, st.key)}
                        style={[styles.stBtn, { borderColor: st.tone, backgroundColor: on ? st.tone : 'transparent' }]}>
                        <Icon name={st.icon} size={14} color={on ? '#fff' : st.tone} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      </View>

      {/* save bar */}
      <View style={[styles.saveBar, { backgroundColor: c.surface, borderTopColor: c.line }]}>
        <Text style={[styles.saveInfo, { color: saved ? c.green : c.muted }]}>
          {saved ? '✓ Xaadiriska waa la kaydiyay' : `${roster.length} arday · diyaar in la kaydiyo`}
        </Text>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: c.blue }]} onPress={save}>
          <Icon name="check" size={16} color="#fff" />
          <Text style={styles.saveBtnTxt}>Kaydi Xaadiriska</Text>
        </TouchableOpacity>
      </View>

      {/* reason picker — required for Maqan / Soo daahay / Erid */}
      <Modal visible={!!reasonFor} transparent animationType="fade" onRequestClose={() => setReasonFor(null)}>
        <TouchableOpacity style={styles.reasonOverlay} activeOpacity={1} onPress={() => setReasonFor(null)}>
          <View style={[styles.reasonSheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.reasonTitle, { color: c.ink }]}>Sababta {reasonStudent ? '· ' + reasonStudent.name : ''}</Text>
            <Text style={[styles.reasonSub, { color: c.muted }]}>Maqan / Soo daahay / Erid waa inay sabab leeyihiin.</Text>
            {REASONS.map((r) => (
              <TouchableOpacity key={r} style={[styles.reasonRow, { borderColor: c.line }]} onPress={() => setReason(reasonFor, r)}>
                <Text style={[styles.reasonTxt, { color: c.ink }]}>{r}</Text>
                <Icon name="chevronRight" size={16} color={c.muted2} />
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

/* ============================================================
   VIEWER — parent & student see a read-only attendance record
   ============================================================ */
function ViewerAttendance({ profile, navigation }) {
  const { c } = useTheme();

  // build the list of people this viewer may see — resolved from the stable
  // identity registry (student_internal_id), never from names/class strings.
  const people = useMemo(() => {
    const recs = profile.scope === 'self'
      ? [getStudentByInternalId(profile.student_internal_id)].filter(Boolean)
      : getParentChildren(profile);
    return recs.map((r) => ({
      name: r.full_name,
      student_internal_id: r.student_internal_id,
      student_id: r.student_id,
      className: (getClassById(r.class_id) || {}).name || '—',
      att: r.att != null ? r.att : 90,
    }));
  }, [profile]);

  const [sel, setSel] = useState(0);
  const person = people[sel] || people[0] || { name: '—', student_internal_id: null, student_id: '', className: '—', att: 90 };
  const demo = useMemo(() => attendanceHistory(person.student_internal_id, person.att, 14), [person]);

  // load this child's / own SAVED attendance from AsyncStorage (by internal id)
  const [savedRows, setSavedRows] = useState([]);
  useEffect(() => {
    let alive = true;
    getStudentAttendance(profile.school_id, person.student_internal_id).then((rows) => {
      if (!alive) return;
      setSavedRows(rows.map((r) => ({
        date: r.attendance_date, weekday: 'La kaydiyay', status: r.status, reason: r.reason, saved: true,
      })));
    });
    return () => { alive = false; };
  }, [person]);

  const history = [...savedRows, ...demo];
  const tally = history.reduce((o, h) => ((o[h.status] = (o[h.status] || 0) + 1), o), {});
  const total = history.length;
  const presentPct = Math.round(((tally.present || 0) + (tally.late || 0) * 0.5) / total * 100);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title="Xaadirinta"
          subtitle={profile.scope === 'self' ? 'Xaadiriskaaga' : 'Xaadiriska caruurtaada'}
          right={<BackBtn navigation={navigation} c={c} />}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
          {/* child switcher (parent only) */}
          {people.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 8 }}>
              {people.map((p, i) => {
                const on = i === sel;
                return (
                  <TouchableOpacity key={p.student_internal_id} onPress={() => setSel(i)}
                    style={[styles.chip, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blue : c.surface }]}>
                    <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>{p.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* hero card with the big % */}
          <View style={[styles.hero, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
            <Avatar name={person.name} code={person.student_internal_id} size={48} />
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text style={[styles.heroName, { color: c.ink }]} numberOfLines={1}>{person.name}</Text>
              <Text style={[styles.heroSub, { color: c.muted }]} numberOfLines={1}>{person.className} · {person.student_id}</Text>
            </View>
            <View style={styles.heroPct}>
              <Text style={[styles.heroPctNum, { color: presentPct >= 90 ? c.green : presentPct >= 75 ? c.gold : c.rose }]}>{presentPct}%</Text>
              <Text style={[styles.heroPctLbl, { color: c.muted }]}>Xaadiris</Text>
            </View>
          </View>

          {/* stat tiles */}
          <View style={styles.tiles}>
            {STATES.map((s) => (
              <View key={s.key} style={[styles.tile, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={[styles.tileDot, { backgroundColor: s.tone + '22' }]}>
                  <Icon name={s.icon} size={15} color={s.tone} />
                </View>
                <Text style={[styles.tileNum, { color: c.ink }]}>{tally[s.key] || 0}</Text>
                <Text style={[styles.tileLbl, { color: c.muted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* read-only notice */}
          <View style={[styles.notice, { backgroundColor: c.blueSoft }]}>
            <Icon name="shield" size={15} color={c.blue} />
            <Text style={[styles.noticeTxt, { color: c.blue }]}>
              Xogtan macalinka ayaa diiwaan geliya — wax ma badeli kartid.
            </Text>
          </View>

          {/* daily history (read-only) */}
          <Text style={[styles.histLbl, { color: c.muted2 }]}>TAARIIKHDA XAADIRISKA</Text>
          {history.map((h, i) => {
            const s = ST[h.status];
            return (
              <View key={i} style={[styles.histRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={[styles.histIcon, { backgroundColor: s.tone + '1A' }]}>
                  <Icon name={s.icon} size={15} color={s.tone} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.histDate, { color: c.ink }]}>{h.weekday}, {h.date}</Text>
                  {h.saved ? <Text style={[styles.savedTag, { color: c.blue }]}>{h.reason ? 'Sabab: ' + h.reason : '● La kaydiyay'}</Text> : null}
                </View>
                <View style={[styles.histBadge, { backgroundColor: s.tone + '1A' }]}>
                  <Text style={[styles.histBadgeTxt, { color: s.tone }]}>{s.label}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipTxt: { fontSize: 13, fontWeight: '700' },

  // admin overview (xadiris guud)
  ovHero: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  ovHeroLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  ovHeroSub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  ovHeroPct: { alignItems: 'center', marginLeft: 12 },
  ovHeroPctNum: { fontSize: 26, fontWeight: '800' },
  ovRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  ovEmblem: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ovEmblemTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  ovName: { fontSize: 14.5, fontWeight: '700' },
  ovMeta: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  ovRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ovPct: { fontSize: 15, fontWeight: '800' },

  // editor
  summary: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, paddingVertical: 12, marginBottom: 12 },
  sumCell: { flex: 1, alignItems: 'center' },
  sumNum: { fontSize: 19, fontWeight: '800' },
  sumLbl: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  bulk: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  bulkBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 11, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bulkTxt: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  name: { fontSize: 13.5, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 1 },
  states: { flexDirection: 'row', gap: 6 },
  stBtn: { width: 32, height: 32, borderWidth: 1.4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1 },
  saveInfo: { fontSize: 12.5, fontWeight: '600', flex: 1 },
  saveBtn: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12 },
  saveBtnTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  locked: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 16, borderWidth: 1, marginTop: 20 },
  lockedTitle: { fontSize: 15, fontWeight: '800' },
  lockedSub: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  reasonOverlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'flex-end' },
  reasonSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  reasonTitle: { fontSize: 16, fontWeight: '800' },
  reasonSub: { fontSize: 12.5, fontWeight: '600', marginTop: 3, marginBottom: 12 },
  reasonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderTopWidth: 1 },
  reasonTxt: { fontSize: 14.5, fontWeight: '700' },
  savedTag: { fontSize: 10, fontWeight: '800', marginTop: 1 },

  // viewer
  hero: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  heroName: { fontSize: 16, fontWeight: '800' },
  heroSub: { fontSize: 12, marginTop: 2 },
  heroPct: { alignItems: 'center' },
  heroPctNum: { fontSize: 24, fontWeight: '800' },
  heroPctLbl: { fontSize: 10.5, fontWeight: '600', marginTop: 1 },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  tileDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileNum: { fontSize: 17, fontWeight: '800' },
  tileLbl: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  notice: { flexDirection: 'row', gap: 9, alignItems: 'center', padding: 11, borderRadius: 12, marginBottom: 18 },
  noticeTxt: { flex: 1, fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  histLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  histRow: { flexDirection: 'row', alignItems: 'center', padding: 11, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  histIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  histDate: { fontSize: 13.5, fontWeight: '700' },
  histBadge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 8 },
  histBadgeTxt: { fontSize: 11.5, fontWeight: '700' },
});
