import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import RowCard from '../components/RowCard';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import SimpleFormModal from '../components/SimpleFormModal';
import ExamWindowModal from '../components/ExamWindowModal';
import ExamMarksModal from '../components/ExamMarksModal';
import ChildResultsGradebook from '../components/ChildResultsGradebook';
import { useAppData } from '../context/AppDataContext';
import { getClassDisplayName } from '../data/identity';
import {
  addTerm, removeTerm, openExamWindow, setExamWindowStatus, addExam, saveExamMarks,
} from '../services/appDataRepository';

/* the active school for a profile — '*' (Super Admin) acts on school_001 */
const schoolOf = (profile) => (profile.school_id === '*' || !profile.school_id ? 'school_001' : profile.school_id);

/* ============================================================
   NASHQADA IMTIXAANKA (new exam design — role aware)
   - Super/School Admin: own the calendar (terms) AND grant per-teacher,
     per-subject, per-term exam windows with a locked marks total (25/50/100).
   - Teacher: sees ONLY the windows the admin opened for their assigned
     subjects; creates an exam inside a window (term + marks are locked) and
     enters scores out of the locked total.
   - Parent / Student: unchanged read-only published results.
   ============================================================ */
export default function ExamsScreen({ navigation }) {
  const { profile } = useRole();
  const readOnly = profile.scope === 'children' || profile.scope === 'self';
  if (readOnly) return <PublishedResults profile={profile} navigation={navigation} />;
  if (profile.key === 'teacher') return <TeacherExams profile={profile} />;
  // accountant has no exam access
  if (profile.scope === 'finance') return <NoAccess />;
  return <ExamSetupAdmin profile={profile} />;
}

/* ---------- Parent / Student — read-only natiijo gradebook per child ---------- */
function PublishedResults({ profile }) {
  const { c } = useTheme();
  const { data: appData } = useAppData();
  // resolve which student(s) this profile may view: a parent's children, or the
  // student themselves.
  const children = useMemo(() => {
    if (profile.scope === 'self') {
      return (appData.students || []).filter((s) => s.student_internal_id === profile.student_internal_id);
    }
    const ids = profile.child_student_ids || [];
    return (appData.students || []).filter((s) => ids.indexOf(s.student_internal_id) !== -1);
  }, [appData.students, profile]);

  const isParent = profile.scope === 'children';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title={isParent ? 'Natiijada Caruurta' : 'Natiijadayda'}
          subtitle={isParent ? `${children.length} ilmo` : 'Natiijada la daabacay'}
        />
        {children.length ? children.map((child) => (
          <ChildResultsGradebook
            key={child.student_internal_id}
            child={child}
            results={appData.results}
            subjects={appData.subjects}
            terms={appData.terms}
          />
        )) : (
          <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="exams" size={28} color={c.muted2} />
            <Text style={[styles.emptyTxt, { color: c.muted }]}>Weli natiijo lama helin.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoAccess() {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.center}>
        <Icon name="exams" size={40} color={c.muted2} />
        <Text style={[styles.emptyTxt, { color: c.muted }]}>Imtixaanada lama heli karo doorkaaga.</Text>
      </View>
    </SafeAreaView>
  );
}

/* ---------- Admin — terms + exam windows (the "nashqad") ---------- */
function ExamSetupAdmin({ profile }) {
  const { c } = useTheme();
  const { data: appData, reload } = useAppData();
  const schoolId = schoolOf(profile);
  const [showTerm, setShowTerm] = useState(false);
  const [showWindow, setShowWindow] = useState(false);

  const terms = useMemo(
    () => (appData.terms || []).filter((t) => t.school_id === schoolId).sort((a, b) => (a.order || 0) - (b.order || 0)),
    [appData.terms, schoolId]
  );
  const teachers = useMemo(
    () => (appData.teacher_permissions || []).filter((t) => t.school_id === schoolId),
    [appData.teacher_permissions, schoolId]
  );
  const windows = useMemo(
    () => (appData.exam_windows || []).filter((w) => w.school_id === schoolId),
    [appData.exam_windows, schoolId]
  );
  const subjectName = (sid) => ((appData.subjects || []).find((s) => s.subject_id === sid) || {}).name || sid;
  const termName = (tid) => ((appData.terms || []).find((t) => t.term_id === tid) || {}).name || tid;
  const teacherName = (tid) => ((appData.teacher_permissions || []).find((t) => t.teacher_id === tid) || {}).teacher_name || tid;

  const onAddTerm = async (v) => { await addTerm(schoolId, (v.name || '').trim()); await reload(); };
  const onRemoveTerm = async (termId) => { await removeTerm(termId); await reload(); };
  const onOpenWindow = async ({ teacherId, subjectId, termId, fullMarks }) => {
    await openExamWindow({ schoolId, teacherId, subjectId, termId, fullMarks });
    await reload();
  };
  const onToggle = async (w) => { await setExamWindowStatus(w.window_id, w.status === 'open' ? 'closed' : 'open'); await reload(); };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Nashqada Imtixaanka" subtitle="Maamulaha — terms iyo ogolaansho macalin" />

        {/* TERMS — admin owns the calendar */}
        <View style={styles.secHead}>
          <Text style={[styles.secTitle, { color: c.ink }]}>Terms-ka</Text>
          <TouchableOpacity onPress={() => setShowTerm(true)} style={[styles.addPill, { backgroundColor: c.blueSoft }]}>
            <Icon name="plus" size={14} color={c.navy} strokeWidth={2.4} />
            <Text style={[styles.addPillTxt, { color: c.navy }]}>Term Cusub</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.termWrap}>
          {terms.length ? terms.map((t) => (
            <View key={t.term_id} style={[styles.termChip, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[styles.termTxt, { color: c.ink }]}>{t.name}</Text>
              <TouchableOpacity onPress={() => onRemoveTerm(t.term_id)} hitSlop={8} style={styles.termX}>
                <Icon name="close" size={13} color={c.rose} />
              </TouchableOpacity>
            </View>
          )) : <Text style={[styles.emptyTxt, { color: c.muted2 }]}>Weli term lama abuurin.</Text>}
        </View>

        {/* WINDOWS — admin grants per teacher + subject + term */}
        <View style={[styles.secHead, { marginTop: 24 }]}>
          <Text style={[styles.secTitle, { color: c.ink }]}>Ogolaanshaha Imtixaanka</Text>
          <TouchableOpacity onPress={() => setShowWindow(true)} style={[styles.addPill, { backgroundColor: c.goldSoft }]}>
            <Icon name="plus" size={14} color={c.gold700} strokeWidth={2.4} />
            <Text style={[styles.addPillTxt, { color: c.gold700 }]}>Fur Ogolaansho</Text>
          </TouchableOpacity>
        </View>
        {windows.length ? windows.map((w) => (
          <RowCard
            key={w.window_id}
            title={`${teacherName(w.teacher_id)} — ${subjectName(w.subject_id)}`}
            subtitle={`${termName(w.term_id)} · /${w.full_marks} dhibcood`}
            badge={{ label: w.status === 'open' ? 'FURAN' : 'XIRAN', tone: w.status === 'open' ? 'green' : 'rose' }}
            onPress={() => onToggle(w)}
          />
        )) : <Text style={[styles.emptyTxt, { color: c.muted2 }]}>Weli ogolaansho lama furin. Riix “Fur Ogolaansho”.</Text>}
        <Text style={[styles.note, { color: c.muted2 }]}>Riix kaarka ogolaanshaha si aad u furto / u xirto.</Text>
      </ScrollView>

      <SimpleFormModal
        visible={showTerm}
        title="Term Cusub Samee"
        saveLabel="Kaydi Term-ka"
        fields={[{ key: 'name', label: 'MAGACA TERM-KA', placeholder: 'tusaale: Term 3', required: true }]}
        onClose={() => setShowTerm(false)}
        onSubmit={onAddTerm}
      />
      <ExamWindowModal
        visible={showWindow}
        teachers={teachers}
        subjects={appData.subjects || []}
        terms={terms}
        onClose={() => setShowWindow(false)}
        onSubmit={onOpenWindow}
      />
    </SafeAreaView>
  );
}

/* ---------- Teacher — create exams inside the admin's open windows ---------- */
function TeacherExams({ profile }) {
  const { c } = useTheme();
  const { data: appData, reload } = useAppData();
  const schoolId = schoolOf(profile);
  const teacherId = profile.teacher_id || 'teacher_001';
  const [windowFor, setWindowFor] = useState(null); // window the teacher is creating an exam for
  const [marksFor, setMarksFor] = useState(null);    // exam to enter marks for

  const openWindows = useMemo(
    () => (appData.exam_windows || []).filter((w) => w.school_id === schoolId && w.teacher_id === teacherId && w.status === 'open'),
    [appData.exam_windows, schoolId, teacherId]
  );
  const myExams = useMemo(
    () => (appData.exams || []).filter((e) => e.school_id === schoolId && e.teacher_id === teacherId && e.window_id),
    [appData.exams, schoolId, teacherId]
  );
  const subjectName = (sid) => ((appData.subjects || []).find((s) => s.subject_id === sid) || {}).name || sid;
  const termName = (tid) => ((appData.terms || []).find((t) => t.term_id === tid) || {}).name || tid;

  const classOptions = (profile.assigned_class_ids || []).map(getClassDisplayName);

  const createExam = async (v) => {
    if (!windowFor) return;
    const clsName = v.cls || classOptions[0] || 'Fasalka';
    const cid = (profile.assigned_class_ids || []).find((id) => getClassDisplayName(id) === clsName)
      || (profile.assigned_class_ids || [])[0] || null;
    await addExam({
      school_id: schoolId,
      class_id: cid,
      subject_id: windowFor.subject_id,
      subject_name: subjectName(windowFor.subject_id),
      class_name: clsName,
      term_id: windowFor.term_id,
      term: termName(windowFor.term_id),
      teacher_id: teacherId,
      window_id: windowFor.window_id,
      full_marks: windowFor.full_marks,
      title: `${subjectName(windowFor.subject_id)} — ${termName(windowFor.term_id)}`,
      status: 'draft',
    });
    setWindowFor(null);
    await reload();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Imtixaanadayda" subtitle="Maadooyinka lagugu ogolaaday" />

        <Text style={[styles.secTitle, { color: c.ink, marginBottom: 10 }]}>Ogolaansho Furan</Text>
        {openWindows.length ? openWindows.map((w) => (
          <RowCard
            key={w.window_id}
            title={`${subjectName(w.subject_id)} · ${termName(w.term_id)}`}
            subtitle={`Cadadka buuxa: /${w.full_marks} dhibcood`}
            badge={{ label: 'SAMEE', tone: 'blue' }}
            onPress={() => setWindowFor(w)}
          />
        )) : (
          <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="exams" size={28} color={c.muted2} />
            <Text style={[styles.emptyTxt, { color: c.muted }]}>Maamulaha weli kuuma furin ogolaansho imtixaan.</Text>
          </View>
        )}

        {myExams.length ? (
          <>
            <Text style={[styles.secTitle, { color: c.ink, marginTop: 24, marginBottom: 10 }]}>Imtixaannada aan sameeyay</Text>
            {myExams.map((e) => (
              <RowCard
                key={e.exam_id}
                title={`${e.subject_name} — ${e.class_name}`}
                subtitle={`${e.term} · /${e.full_marks || 100}${e.status === 'draft' ? ' · QABYO' : ''}`}
                badge={{ label: 'Dhibco', tone: 'navy' }}
                onPress={() => setMarksFor(e)}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* create exam inside the chosen window — only class + (optional) note; term & marks locked */}
      <SimpleFormModal
        visible={!!windowFor}
        title={windowFor ? `Imtixaan: ${subjectName(windowFor.subject_id)}` : 'Imtixaan'}
        saveLabel="Samee Imtixaanka"
        fields={[
          { key: 'cls', label: 'FASALKA', options: classOptions.length ? classOptions : ['Fasalka'] },
        ]}
        onClose={() => setWindowFor(null)}
        onSubmit={createExam}
      />

      <ExamMarksModal
        visible={!!marksFor}
        subject={marksFor ? marksFor.subject_name : ''}
        className={marksFor ? marksFor.class_name : ''}
        schoolId={marksFor ? marksFor.school_id : null}
        classId={marksFor ? marksFor.class_id : null}
        fullMarks={marksFor ? (marksFor.full_marks || 100) : null}
        termLabel={marksFor ? marksFor.term : ''}
        onClose={() => setMarksFor(null)}
        onSave={async ({ entries }) => {
          if (marksFor && entries && entries.length) { await saveExamMarks(marksFor, entries); await reload(); }
          setMarksFor(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  secHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  secTitle: { fontSize: 16, fontWeight: '800' },
  addPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20 },
  addPillTxt: { fontSize: 12.5, fontWeight: '700' },
  termWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  termChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingLeft: 14, paddingRight: 8 },
  termTxt: { fontSize: 13, fontWeight: '700' },
  termX: { padding: 2 },
  emptyTxt: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  emptyCard: { alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 16, padding: 28 },
  note: { fontSize: 11.5, fontWeight: '500', marginTop: 12 },
});
