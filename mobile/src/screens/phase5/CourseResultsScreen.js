/* University course results — real, role-aware Supabase workflow.
   University Admin enrols students and approves/publishes. Assigned lecturers
   enter and submit scores. University students see only their own published
   results. RLS and server RPCs remain the authority. */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import {
  listCourseEnrollments, createCourseEnrollment, listCourseResults,
  upsertCourseResult, transitionCourseResult, p5FriendlyError,
} from '../../services/phase5';

const STATUS = { draft: 'Qabyo', submitted: 'La gudbiyay', approved: 'La ansixiyay', published: 'La daabacay' };

export default function CourseResultsScreen() {
  const { c } = useTheme();
  const { roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const isAdmin = roleKey === 'schooladmin' || roleKey === 'superadmin';
  const isLecturer = roleKey === 'teacher';
  const isStudent = roleKey === 'student';
  const canEnter = isAdmin || isLecturer;

  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [course, setCourse] = useState(null);
  const [scores, setScores] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [rowMsg, setRowMsg] = useState({});
  const [enrollId, setEnrollId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

  const load = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const [cs, st, ys, sems, en, rs] = await Promise.all([
        p4List('courses', schoolId),
        p4List('university_students', schoolId),
        isAdmin ? p4List('academic_years', schoolId) : Promise.resolve([]),
        isAdmin ? p4List('semesters', schoolId) : Promise.resolve([]),
        listCourseEnrollments(schoolId),
        listCourseResults(schoolId),
      ]);
      setCourses(cs); setStudents(st); setYears(ys); setSemesters(sems);
      setEnrollments(en); setResults(rs);
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [schoolId, isAdmin]);
  useEffect(() => { load(); }, [load]);

  const enrolledCourseIds = useMemo(() => new Set(enrollments.map((e) => e.course_id)), [enrollments]);
  const visibleCourses = isStudent ? courses.filter((co) => enrolledCourseIds.has(co.id)) : courses;
  const studentName = (id) => (students.find((s) => s.id === id) || {}).full_name || (isStudent ? 'Adiga' : 'Arday');
  const courseEnrollments = course ? enrollments.filter((e) => e.course_id === course.id) : [];
  const resultFor = (enrollmentId) => results.find((r) => r.course_enrollment_id === enrollmentId) || null;
  const enrolledIds = new Set(courseEnrollments.map((e) => e.university_student_id));
  const notEnrolled = students.filter((s) => !enrolledIds.has(s.id));
  const semesterOptions = yearId ? semesters.filter((s) => !s.academic_year_id || s.academic_year_id === yearId) : semesters;

  const enrol = async () => {
    if (enrolling || !enrollId || !course || !yearId || !semesterId) {
      setEnrollMsg('Dooro ardayga, sannad-dugsiyeedka iyo semester-ka.'); return;
    }
    setEnrolling(true); setEnrollMsg('');
    try {
      await createCourseEnrollment({
        school_id: schoolId, course_id: course.id, university_student_id: enrollId,
        academic_year_id: yearId, semester_id: semesterId, created_by: null,
      });
      setEnrollMsg('Ardayga waa lagu diiwaangeliyay koorsada.');
      setEnrollId('');
      await load();
    } catch (e) { setEnrollMsg(p5FriendlyError(e)); }
    finally { setEnrolling(false); }
  };

  const saveResult = async (enrollment) => {
    if (busyId) return;
    const raw = (scores[enrollment.id] || '').trim();
    setRowMsg((m) => ({ ...m, [enrollment.id]: null }));
    if (raw === '') { setRowMsg((m) => ({ ...m, [enrollment.id]: 'Geli dhibcaha.' })); return; }
    const val = Number(raw);
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      setRowMsg((m) => ({ ...m, [enrollment.id]: 'Dhibcaha waa 0–100.' })); return;
    }
    setBusyId(enrollment.id);
    try {
      await upsertCourseResult({ school_id: schoolId, course_enrollment_id: enrollment.id, score: val });
      setRowMsg((m) => ({ ...m, [enrollment.id]: 'Qabyada waa la kaydiyay ✓' }));
      await load();
    } catch (e) { setRowMsg((m) => ({ ...m, [enrollment.id]: p5FriendlyError(e) })); }
    finally { setBusyId(null); }
  };

  const transition = async (enrollment, result, next) => {
    if (busyId || !result) return;
    setBusyId(enrollment.id); setRowMsg((m) => ({ ...m, [enrollment.id]: null }));
    try {
      await transitionCourseResult(schoolId, result.id, next);
      setRowMsg((m) => ({ ...m, [enrollment.id]: `${STATUS[next] || next} ✓` }));
      await load();
    } catch (e) { setRowMsg((m) => ({ ...m, [enrollment.id]: p5FriendlyError(e) })); }
    finally { setBusyId(null); }
  };

  if (!schoolId) return <StateBox c={c} text="Jaamacad sax ah laguma xidhna akoonkan." />;
  if (loading) return <View style={styles.state}><ActivityIndicator color={c.blue} /></View>;
  if (loadErr) return <StateBox c={c} text={loadErr} error onRetry={load} />;

  if (!course) {
    return <View>
      <Text style={[styles.lbl, { color: c.muted }]}>DOORO KOORSADA</Text>
      {visibleCourses.length === 0 ? <StateBox c={c} text={isStudent ? 'Weli koorso aad ku diiwaangashan tahay lama helin.' : 'Weli koorso laguu oggol yahay lama helin.'} />
        : visibleCourses.map((co) => <TouchableOpacity key={co.id} onPress={() => { setCourse(co); setScores({}); setRowMsg({}); setEnrollMsg(''); }} activeOpacity={0.85}
          style={[styles.courseRow, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.courseName, { color: c.ink }]} numberOfLines={1}>{co.name}</Text>
            <Text style={[styles.courseSub, { color: c.muted }]}>{[co.code, co.credit_hours != null ? `${co.credit_hours} CH` : null].filter(Boolean).join(' · ') || '—'}</Text></View>
          <Icon name="back" size={16} color={c.muted2} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>)}
    </View>;
  }

  return <View>
    <View style={styles.headRow}>
      <TouchableOpacity onPress={() => setCourse(null)} style={[styles.backBtn, { borderColor: c.line }]}><Icon name="back" size={16} color={c.ink} /></TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.courseName, { color: c.ink }]} numberOfLines={1}>{course.name}</Text>
        <Text style={[styles.courseSub, { color: c.muted }]}>{courseEnrollments.length} arday diiwaan-gashan</Text></View>
    </View>

    {isAdmin ? <View style={[styles.enrolCard, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.lbl, { color: c.muted }]}>KU DAR ARDAY</Text>
      <ChipList c={c} rows={years} value={yearId} onChange={(v) => { setYearId(v); setSemesterId(''); }} label={(r) => r.name} empty="Sannad-dugsiyeed lama helin." />
      <ChipList c={c} rows={semesterOptions} value={semesterId} onChange={setSemesterId} label={(r) => r.name} empty="Semester lama helin." />
      <ChipList c={c} rows={notEnrolled} value={enrollId} onChange={setEnrollId} label={(r) => r.full_name} empty="Dhammaan ardayda waa la diiwaangeliyay." />
      <TouchableOpacity onPress={enrol} disabled={enrolling || !enrollId || !yearId || !semesterId} activeOpacity={0.9}
        style={[styles.enrolBtn, { backgroundColor: c.blue, opacity: enrolling || !enrollId || !yearId || !semesterId ? 0.5 : 1 }]}>
        {enrolling ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveTxt}>Diiwaangeli</Text>}
      </TouchableOpacity>
      {enrollMsg ? <Text style={[styles.rowMsg, { color: c.muted }]}>{enrollMsg}</Text> : null}
    </View> : null}

    {courseEnrollments.length === 0 ? <StateBox c={c} text="Weli arday koorsadan laguma diiwaangelin." />
      : courseEnrollments.map((en) => {
        const r = resultFor(en.id); const busy = busyId === en.id;
        const editable = canEnter && (!r || r.status === 'draft' || r.status === 'submitted');
        return <View key={en.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{studentName(en.university_student_id)}</Text>
            {r ? <Text style={[styles.savedTxt, { color: r.status === 'published' ? c.green : c.blue }]}>
              {r.score == null ? 'Dhibco ma leh' : `${r.score} · ${r.grade || '—'} · ${r.grade_point == null ? '—' : r.grade_point} GPA`} · {STATUS[r.status] || r.status}
            </Text> : <Text style={[styles.savedTxt, { color: c.muted2 }]}>Natiijo lama gelin.</Text>}
            {rowMsg[en.id] ? <Text style={[styles.rowMsg, { color: c.muted }]}>{rowMsg[en.id]}</Text> : null}
          </View>
          {editable ? <>
            <TextInput value={scores[en.id] ?? (r && r.score != null ? String(r.score) : '')} onChangeText={(t) => setScores((m) => ({ ...m, [en.id]: t }))}
              placeholder="0–100" placeholderTextColor={c.muted2} keyboardType="numeric"
              style={[styles.scoreInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
            <Action c={c} label="Kaydi" busy={busy} onPress={() => saveResult(en)} />
          </> : null}
          {r && r.status === 'draft' && canEnter ? <Action c={c} label="Gudbi" busy={busy} outline onPress={() => transition(en, r, 'submitted')} /> : null}
          {r && r.status === 'submitted' && isAdmin ? <Action c={c} label="Ansixi" busy={busy} outline onPress={() => transition(en, r, 'approved')} /> : null}
          {r && r.status === 'approved' && isAdmin ? <Action c={c} label="Daabac" busy={busy} onPress={() => transition(en, r, 'published')} /> : null}
        </View>;
      })}
  </View>;
}

function Action({ c, label, busy, onPress, outline }) {
  return <TouchableOpacity onPress={onPress} disabled={busy} style={[styles.saveBtn, { backgroundColor: outline ? c.surface : c.blue, borderColor: c.blue, borderWidth: outline ? 1 : 0, opacity: busy ? 0.6 : 1 }]}>
    {busy ? <ActivityIndicator color={outline ? c.blue : '#fff'} size="small" /> : <Text style={[styles.saveTxt, outline && { color: c.blue }]}>{label}</Text>}
  </TouchableOpacity>;
}
function ChipList({ c, rows, value, onChange, label, empty }) {
  if (!rows.length) return <Text style={[styles.boxSub, { color: c.muted2, textAlign: 'left', marginBottom: 8 }]}>{empty}</Text>;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 3, marginBottom: 6 }}>
    {rows.slice(0, 100).map((r) => { const on = value === r.id; return <TouchableOpacity key={r.id} onPress={() => onChange(on ? '' : r.id)} style={[styles.chip, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}><Text style={[styles.chipTxt, { color: on ? c.blue : c.muted }]} numberOfLines={1}>{label(r)}</Text></TouchableOpacity>; })}
  </ScrollView>;
}
function StateBox({ c, text, error, onRetry }) {
  return <View style={[styles.box, { backgroundColor: error ? c.roseSoft : c.surface, borderColor: error ? c.rose : c.line }]}><Text style={[styles.boxSub, { color: error ? c.rose : c.muted }]}>{text}</Text>{onRetry ? <TouchableOpacity onPress={onRetry}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity> : null}</View>;
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingVertical: 40 }, box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 8 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 }, retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 8 }, courseRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 9 },
  courseName: { fontSize: 15, fontWeight: '800' }, courseSub: { fontSize: 12, marginTop: 2, fontWeight: '600' }, headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, enrolCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 190 }, chipTxt: { fontSize: 12, fontWeight: '700' },
  enrolBtn: { height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 }, card: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  stuName: { fontSize: 14, fontWeight: '700' }, savedTxt: { fontSize: 11.5, fontWeight: '700', marginTop: 2 }, rowMsg: { fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  scoreInput: { width: 72, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, textAlign: 'center' },
  saveBtn: { height: 42, minWidth: 60, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, saveTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
