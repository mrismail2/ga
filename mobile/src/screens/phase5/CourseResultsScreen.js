/* Natiijooyinka koorsada (Jaamacad) — university course results entry (§14).

   A university admin/lecturer picks a course, enrols students into it
   (create_course_enrollment) and enters a per-student result
   (upsert_course_result: score → grade snapshot feeds the transcript GPA).
   LIVE Supabase under the caller's own JWT; RLS + the tenant guards are the
   authority, so a result can only be written for this university's own
   enrolment. No demo data, no device-local storage; each Save is
   duplicate-click protected. Rendered inside the University shell, so it
   needs no navigation prop. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listCourseEnrollments, createCourseEnrollment, listCourseResults, upsertCourseResult, p5FriendlyError } from '../../services/phase5';

export default function CourseResultsScreen() {
  const { c } = useTheme();
  const { schoolId } = useActiveSchoolId();

  const [courses, setCourses] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(null);
  const [course, setCourse] = useState(null);
  const [scores, setScores] = useState({}); // enrollment_id -> string
  const [busyId, setBusyId] = useState(null);
  const [rowMsg, setRowMsg] = useState({});
  const [enrollId, setEnrollId] = useState(''); // university_student_id to enrol
  const [enrolling, setEnrolling] = useState(false);
  const [enrollMsg, setEnrollMsg] = useState('');

  const load = useCallback(async () => {
    if (!schoolId) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const [cs, st, en, rs] = await Promise.all([
        p4List('courses', schoolId),
        p4List('university_students', schoolId),
        listCourseEnrollments(schoolId),
        listCourseResults(schoolId),
      ]);
      setCourses(cs); setStudents(st); setEnrollments(en); setResults(rs);
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);

  const studentName = (id) => (students.find((s) => s.id === id) || {}).full_name || 'Arday';
  const courseEnrollments = course ? enrollments.filter((e) => e.course_id === course.id) : [];
  const resultFor = (enrollmentId) => results.find((r) => r.course_enrollment_id === enrollmentId) || null;
  const enrolledIds = new Set(courseEnrollments.map((e) => e.university_student_id));
  const notEnrolled = students.filter((s) => !enrolledIds.has(s.id));

  const enrol = async () => {
    if (enrolling || !enrollId || !course) return;
    setEnrolling(true); setEnrollMsg('');
    try {
      await createCourseEnrollment({
        school_id: schoolId, course_id: course.id, university_student_id: enrollId,
        semester_id: course.semester_id || null,
      });
      setEnrollMsg('Ardayga waa la diiwaangeliyay.');
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
    if (isNaN(val) || val < 0 || val > 100) { setRowMsg((m) => ({ ...m, [enrollment.id]: 'Dhibcaha waa 0 – 100.' })); return; }
    setBusyId(enrollment.id);
    try {
      await upsertCourseResult({
        school_id: schoolId, course_enrollment_id: enrollment.id,
        university_student_id: enrollment.university_student_id, course_id: course.id,
        semester_id: course.semester_id || enrollment.semester_id || null,
        score: val, credit_hours: course.credit_hours != null ? Number(course.credit_hours) : null,
      });
      setRowMsg((m) => ({ ...m, [enrollment.id]: 'La kaydiyay ✓' }));
      await load();
    } catch (e) { setRowMsg((m) => ({ ...m, [enrollment.id]: p5FriendlyError(e) })); }
    finally { setBusyId(null); }
  };

  if (!schoolId) {
    return (
      <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.boxSub, { color: c.muted }]}>Jaamacad sax ah laguma xidhna akoonkan.</Text>
      </View>
    );
  }
  if (loading) return <View style={styles.state}><ActivityIndicator color={c.blue} /></View>;
  if (loadErr) {
    return (
      <View style={[styles.box, { backgroundColor: c.roseSoft }]}>
        <Text style={[styles.boxSub, { color: c.rose }]}>{loadErr}</Text>
        <TouchableOpacity onPress={load}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity>
      </View>
    );
  }

  if (!course) {
    return (
      <View>
        <Text style={[styles.lbl, { color: c.muted }]}>DOORO KOORSADA</Text>
        {courses.length === 0 ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="lessons" size={24} color={c.muted2} />
            <Text style={[styles.boxSub, { color: c.muted }]}>Weli koorso lama abuurin. U gudub Courses.</Text>
          </View>
        ) : courses.map((co) => (
          <TouchableOpacity key={co.id} onPress={() => { setCourse(co); setScores({}); setRowMsg({}); setEnrollMsg(''); }} activeOpacity={0.85}
            style={[styles.courseRow, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.courseName, { color: c.ink }]} numberOfLines={1}>{co.name}</Text>
              <Text style={[styles.courseSub, { color: c.muted }]}>{[co.code, co.credit_hours != null ? co.credit_hours + ' CH' : null].filter(Boolean).join(' · ') || '—'}</Text>
            </View>
            <Icon name="back" size={16} color={c.muted2} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <View>
      <View style={styles.headRow}>
        <TouchableOpacity onPress={() => setCourse(null)} style={[styles.backBtn, { borderColor: c.line }]}>
          <Icon name="back" size={16} color={c.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.courseName, { color: c.ink }]} numberOfLines={1}>{course.name}</Text>
          <Text style={[styles.courseSub, { color: c.muted }]}>{courseEnrollments.length} arday diiwaan-gashan</Text>
        </View>
      </View>

      {/* enrol a student into this course */}
      <View style={[styles.enrolCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.lbl, { color: c.muted }]}>KU DAR ARDAY</Text>
        {notEnrolled.length === 0 ? (
          <Text style={[styles.boxSub, { color: c.muted2, textAlign: 'left' }]}>Dhammaan ardayda waa la diiwaangeliyay.</Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingVertical: 2 }}>
              {notEnrolled.slice(0, 40).map((s) => {
                const on = enrollId === s.id;
                return (
                  <TouchableOpacity key={s.id} onPress={() => setEnrollId(on ? '' : s.id)}
                    style={[styles.chip, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
                    <Text style={[styles.chipTxt, { color: on ? c.blue : c.muted }]} numberOfLines={1}>{s.full_name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={enrol} disabled={enrolling || !enrollId} activeOpacity={0.9}
              style={[styles.enrolBtn, { backgroundColor: c.blue, opacity: enrolling || !enrollId ? 0.5 : 1 }]}>
              {enrolling ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveTxt}>Diiwaangeli</Text>}
            </TouchableOpacity>
          </>
        )}
        {enrollMsg ? <Text style={[styles.rowMsg, { color: c.muted }]}>{enrollMsg}</Text> : null}
      </View>

      {/* per-student result entry */}
      {courseEnrollments.length === 0 ? (
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.boxSub, { color: c.muted }]}>Weli arday koorsadan laguma diiwaangelin.</Text>
        </View>
      ) : courseEnrollments.map((en) => {
        const r = resultFor(en.id);
        const busy = busyId === en.id;
        return (
          <View key={en.id} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{studentName(en.university_student_id)}</Text>
              {r && r.score != null ? <Text style={[styles.savedTxt, { color: c.green }]}>Natiijo: {r.score}{r.grade ? ' · ' + r.grade : ''}</Text> : null}
              {rowMsg[en.id] ? <Text style={[styles.rowMsg, { color: c.muted }]}>{rowMsg[en.id]}</Text> : null}
            </View>
            <TextInput value={scores[en.id] || ''} onChangeText={(t) => setScores((m) => ({ ...m, [en.id]: t }))}
              placeholder="0–100" placeholderTextColor={c.muted2} keyboardType="numeric"
              style={[styles.scoreInput, { backgroundColor: c.bg, borderColor: c.line2, color: c.ink }]} />
            <TouchableOpacity onPress={() => saveResult(en)} disabled={busy}
              style={[styles.saveBtn, { backgroundColor: c.blue, opacity: busy ? 0.6 : 1 }]}>
              {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveTxt}>Kaydi</Text>}
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', paddingVertical: 40 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 8 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  lbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 8 },
  courseRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 9 },
  courseName: { fontSize: 15, fontWeight: '800' },
  courseSub: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  enrolCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, maxWidth: 180 },
  chipTxt: { fontSize: 12, fontWeight: '700' },
  enrolBtn: { height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  stuName: { fontSize: 14, fontWeight: '700' },
  savedTxt: { fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  rowMsg: { fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  scoreInput: { width: 72, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, fontSize: 14, textAlign: 'center' },
  saveBtn: { height: 42, minWidth: 60, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  saveTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
