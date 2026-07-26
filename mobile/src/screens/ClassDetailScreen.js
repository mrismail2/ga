import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { radius, shadow } from '../theme/colors';
import StudentRow from '../components/StudentRow';
import StudentProfileModal from '../components/StudentProfileModal';
import AddStudentModal from '../components/AddStudentModal';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import { FEE_LABELS, attendanceHistory } from '../data/mock';
import { calculateStudentResult, getClassSubjects } from '../data/results';
import { SEVERITY, INC_STATUS } from '../data/datasets';
import { saveClassAttendance, getClassMarksMap, getStudentAttendance } from '../services/attendanceStorage';
import { getRollOrder, saveRollOrder, applyRollOrder } from '../services/rollOrderStorage';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { deactivateStudent } from '../services/appDataRepository';
import useCanonicalRows from '../hooks/useCanonicalRows';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../components/SchoolSelector';
import { p4ClassExistsInMySchool } from '../services/phase4';
import { selectStudentsByClass, filterStudentsForProfile, getIncidentsByClass } from '../utils/dataSelectors';
import {
  canPerformAction, classId, canEditPayment,
  canAccessClassDetail, getClassDetailModeForProfile, getAllowedClassTabs, redirectUnauthorizedClassAccess,
} from '../data/access';

const TABS = ['Ardayda', 'Xaadiris', 'Natiijada', 'Lacagta', 'Kiisaska'];

const ATT_STATES = [
  { key: 'present', label: 'Jooga', tone: '#16A34A', icon: 'check' },
  { key: 'absent', label: 'Maqan', tone: '#E5484D', icon: 'close' },
  { key: 'late', label: 'Soo daahay', tone: '#CFAD5E', icon: 'clock' },
  { key: 'excused', label: 'Erid', tone: '#2F6BF0', icon: 'note' },
];
const ABSENCE_REASONS = ['Jiro', 'Qoys degdeg ah', 'Gaadiid', 'Fasax la siiyay', 'Hawl dugsi', 'Lama oga', 'Kale'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Abr', 'May', 'Juun', 'Lul', 'Agt', 'Sept', 'Okt', 'Nov', 'Dis'];
const CASE_TYPES = ['Cay/dulmi (bullying)', 'Khilaaf macalin', 'Soo daahid joogto ah', 'Diidmo shaqo-guri', 'Burburin hanti dugsi', 'Hadal xun', 'Carqalad fasalka', 'Kale'];
const CASE_SEV = [{ key: 'low', label: 'Hoose', tone: 'green' }, { key: 'medium', label: 'Dhexe', tone: 'gold' }, { key: 'high', label: 'Sare', tone: 'gold' }, { key: 'critical', label: 'Halis', tone: 'rose' }];

/* one label/value line inside an expanded case */
function CaseRow({ c, label, value }) {
  return (
    <View style={styles.caseInfoRow}>
      <Text style={[styles.caseInfoLbl, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.caseInfoVal, { color: c.ink }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

export default function ClassDetailScreen({ route, navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { data: appData, reload } = useAppData();
  const { isLive, roleKey } = useAuth();
  const params = route.params || {};

  // ---- LIVE: routed by a stable canonical classId ONLY — never a demo
  // array/object, never a name-derived id (see AddClassModal/ClassesScreen:
  // navigation.navigate('ClassDetail', isLive ? { classId } : { cls })).
  // The class is loaded from the canonical repository and authorized
  // server-side by RLS (RLS narrows `classes` to: admin sees their whole
  // school; teacher sees only their assigned classes) — a returned row IS
  // the authorization. Only School Admin / Super Admin / Teacher may even
  // attempt this; Parent/Student/Accountant are denied outright, no query
  // ever attempted. DEMO mode below is completely unchanged. ----
  const liveRouteClassId = isLive ? (params.classId || null) : null;
  // the RESOLVED active school (own school for School Admin/Teacher, the
  // picked school for Super Admin) — never the raw, possibly-null
  // profile.school_id.
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const liveRoleMayAttempt = roleKey === 'superadmin' || roleKey === 'schooladmin' || roleKey === 'teacher';
  const liveClasses = useCanonicalRows('classes', schoolId, { enabled: isLive && !!schoolId && !!liveRouteClassId && liveRoleMayAttempt });
  const liveClassRow = liveRouteClassId ? (liveClasses.rows.find((r) => r.id === liveRouteClassId) || null) : null;
  const liveStillLoading = isLive && !!schoolId && !!liveRouteClassId && liveRoleMayAttempt && liveClasses.loading;
  const liveClassError = isLive && liveRoleMayAttempt ? liveClasses.error : null;
  const liveNotYetResolved = isLive && !!schoolId && !!liveRouteClassId && liveRoleMayAttempt && !liveClassRow && !liveStillLoading && !liveClassError;

  // once the RLS-scoped list has settled and the class isn't in it, find out
  // WHY — "genuinely doesn't exist" vs "exists in my school but I'm not
  // authorized" — via a single safe boolean that never leaks class data and
  // never confirms/denies existence outside the caller's own school.
  const [liveExistsButDenied, setLiveExistsButDenied] = useState(null);
  useEffect(() => {
    setLiveExistsButDenied(null);
    if (!liveNotYetResolved) return undefined;
    let alive = true;
    p4ClassExistsInMySchool(liveRouteClassId)
      .then((exists) => { if (alive) setLiveExistsButDenied(exists); })
      .catch(() => { if (alive) setLiveExistsButDenied(false); });
    return () => { alive = false; };
  }, [liveNotYetResolved, liveRouteClassId]);

  // synthesize the SAME tuple shape the rest of this (large, pre-existing)
  // screen already consumes, from the canonical row — nothing below this
  // point needs to know whether the data came from live or demo.
  const cls = isLive
    ? (liveClassRow
        ? [liveClassRow.name, liveClassRow.code || '', liveClassRow.code || 'Fasal', 0, liveClassRow.capacity || 0, '#5B5BD6', null, liveClassRow.school_id, liveClassRow.id]
        : null)
    : (params.cls || null);
  const [name, grade, teacher, students, cap, color, att] = cls || ['', '', '', 0, 0, '#5B5BD6', null];

  // ---- strict access guard: verify BEFORE showing any class data ----
  // LIVE: a returned canonical row (found + role-eligible) IS the
  // authorization — RLS already enforced it server-side. DEMO: unchanged
  // client-side guard (canAccessClassDetail/getClassDetailModeForProfile).
  const allowed = isLive ? (liveRoleMayAttempt && !!cls) : (cls ? canAccessClassDetail(profile, cls) : false);
  const mode = isLive ? (allowed ? 'full' : 'denied') : (cls ? getClassDetailModeForProfile(profile, cls) : 'denied');
  // LIVE: only Ardayda has real Phase 1-4 canonical wiring (the active-
  // enrollment roster). Xaadiris/Natiijada/Lacagta/Kiisaska still read the
  // Phase 1/2 demo/AsyncStorage store (empty in Live Mode) — later-phase
  // modules that must not be offered to an authenticated Live Mode user.
  // Reuses the SAME existing mechanism the tab bar already has for
  // hiding a tab (simply omitting it from this array) — no new UI.
  const LIVE_TABS = ['Ardayda'];
  const allowedTabs = isLive ? (allowed ? LIVE_TABS : []) : (cls ? getAllowedClassTabs(profile, cls) : []);
  const readOnly = mode === 'readonly';
  // a genuinely-missing class vs an unauthorized one get distinct copy
  const liveDenialKind = isLive && !allowed && !liveStillLoading && !liveClassError && !needsSchoolSelection
    ? (liveExistsButDenied ? 'denied' : 'not_found')
    : null;

  // auto-redirect an unauthorized user back to a safe screen (not while a
  // live lookup is still in flight, and not for a still-undetermined denial)
  useEffect(() => {
    if (allowed || liveStillLoading || (isLive && liveDenialKind === null)) return undefined;
    const t = setTimeout(() => redirectUnauthorizedClassAccess(navigation), 2500);
    return () => clearTimeout(t);
  }, [allowed, liveStillLoading, isLive, liveDenialKind]);

  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  // this class's canonical identifiers (multi-school safe — LIVE never
  // falls back to a fixed school; a class with no canonical id is simply
  // not loaded, never silently treated as some default school's data).
  const liveClassId = isLive ? (liveClassRow ? liveClassRow.id : null) : null;
  const clsSchoolId = isLive ? (liveClassRow ? liveClassRow.school_id : null) : (cls ? cls[7] : null);
  const clsClassId = liveClassId || (cls ? classId(name, clsSchoolId) : null);
  // LIVE: class membership comes from the canonical ACTIVE enrollment
  // collection (never students.class_id directly, and never a fallback
  // school) — the same source ClassesScreen/dashboard counts use.
  const liveEnrollments = useCanonicalRows('student_enrollments', schoolId, { enabled: isLive && !!liveClassId, watch: ['admissions'] });
  const liveStudents = useCanonicalRows('students', schoolId, { enabled: isLive && !!liveClassId, watch: ['admissions'] });
  // read-only roles (parent/student) only ever see their own child / self —
  // never the class-wide roster. The roster is the ONE central store filtered
  // by school_id + class_id; added students already live there and persist.
  const roster = useMemo(() => {
    if (isLive && liveClassId) {
      const activeStudentIds = new Set(
        liveEnrollments.rows.filter((e) => e.status === 'active' && e.class_id === liveClassId).map((e) => e.student_id)
      );
      return liveStudents.rows
        .filter((s) => activeStudentIds.has(s.id))
        .map((s) => ({ ...s, student_internal_id: s.id, name: s.full_name, att: null, className: name }));
    }
    if (!cls || !clsSchoolId || !clsClassId) return [];
    const full = selectStudentsByClass(appData.students, clsSchoolId, clsClassId)
      .map((s) => ({ ...s, name: s.full_name || s.name, className: name }));
    return readOnly ? filterStudentsForProfile(profile, full) : full;
  }, [isLive, liveClassId, liveEnrollments.rows, liveStudents.rows, cls, appData.students, clsSchoolId, clsClassId, readOnly, profile, name]);
  // the header KPI always reflects the ACTUAL roster length (never a
  // possibly-stale count carried through navigation) live or demo.
  const displayStudentCount = isLive ? roster.length : students;
  const [att2, setAtt2] = useState({});      // code -> { status, reason }
  const [attSaved, setAttSaved] = useState(false);
  const [month, setMonth] = useState(5);     // 0-indexed, Juun
  const [includeWeekend, setIncludeWeekend] = useState(false); // Khamiis/Jimce off by default
  const [fees, setFees] = useState({});      // code -> fee override
  const [feeSaved, setFeeSaved] = useState(false);
  const [openResult, setOpenResult] = useState(null);
  const [reasonFor, setReasonFor] = useState(null); // student awaiting absence reason
  const [roSaved, setRoSaved] = useState({});       // parent/student: saved attendance per student_internal_id
  // ---- Kiisaska (cases) ----
  const [extraCases, setExtraCases] = useState([]);
  const classCases = getIncidentsByClass(clsClassId, profile, [...extraCases, ...appData.incidents]);
  const [caseOpen, setCaseOpen] = useState(null);   // expanded case index
  const [showAddCase, setShowAddCase] = useState(false);
  const [caseStudent, setCaseStudent] = useState(null); // student_internal_id being reported
  const [caseLocked, setCaseLocked] = useState(false);  // student fixed (from profile) — no picker
  const [caseTypeText, setCaseTypeText] = useState(''); // typed case type
  const [caseSev, setCaseSev] = useState(1);
  const [caseDesc, setCaseDesc] = useState('');         // typed reason / details
  const [caseAction, setCaseAction] = useState('');     // typed action taken
  // ---- Roll numbers (lambarka xaadiriska) ----
  const [rollOrder, setRollOrder] = useState({ order: [], left: [] });
  const [rollFor, setRollFor] = useState(null);   // student whose number is being changed
  const [rollInput, setRollInput] = useState(''); // typed new number
  const canRenumber = !isLive && mode === 'full' && canPerformAction(profile, 'attendance.mark');

  // load this class's saved roll order (numbers a left student freed up)
  useEffect(() => {
    if (isLive || !clsSchoolId || !clsClassId) { setRollOrder({ order: [], left: [] }); return undefined; }
    let alive = true;
    getRollOrder(clsSchoolId, clsClassId).then((ro) => { if (alive) setRollOrder(ro); });
    return () => { alive = false; };
  }, [isLive, clsSchoolId, clsClassId]);

  // the roster as the user has ordered it (left students dropped, custom order applied)
  const orderedRoster = useMemo(() => isLive ? roster : applyRollOrder(roster, rollOrder), [isLive, roster, rollOrder]);

  const filtered = useMemo(
    () => orderedRoster.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())),
    [orderedRoster, q]
  );

  // new students persist to the central store (AddStudentModal) and the roster
  // recomputes from context automatically — nothing to do here.
  const addStudent = () => {};

  // open the "Beddel Lambar" sheet for a student (shows their current number)
  const openRoll = (student) => {
    if (!canRenumber) return;
    const n = orderedRoster.findIndex((s) => s.student_internal_id === student.student_internal_id);
    setRollFor(student);
    setRollInput(n >= 0 ? String(n + 1) : '');
  };

  // give a student a roll number — a PURE SWAP: only this student and the one
  // who currently holds that number exchange places. Everyone else is untouched.
  const applyRollNumber = () => {
    if (!rollFor) return;
    const target = parseInt(rollInput, 10);
    const ids = orderedRoster.map((s) => s.student_internal_id);
    const from = ids.indexOf(rollFor.student_internal_id);
    if (from < 0 || !target || target < 1) { setRollFor(null); return; }
    const to = Math.max(0, Math.min(ids.length - 1, target - 1));
    const swapped = [ids[from], ids[to]];
    ids[from] = swapped[1];
    ids[to] = swapped[0];
    const next = { order: ids, left: rollOrder.left };
    setRollOrder(next);
    saveRollOrder(clsSchoolId, clsClassId, next);
    setRollFor(null);
  };

  // a student left the class — free their number so another can take it AND
  // mark them 'left' in the central store so billing drops them immediately.
  const markStudentLeft = () => {
    if (!rollFor) return;
    const id = rollFor.student_internal_id;
    const ids = orderedRoster.map((s) => s.student_internal_id).filter((x) => x !== id);
    const next = { order: ids, left: [...rollOrder.left.filter((x) => x !== id), id] };
    setRollOrder(next);
    saveRollOrder(clsSchoolId, clsClassId, next);
    deactivateStudent(id, 'left').then(() => reload());
    setRollFor(null);
  };

  // attendance date key — one register per month for this class (ISO-ish)
  const attDateKey = `2026-${String(month + 1).padStart(2, '0')}-15`;
  // storage keys are school + class scoped — NEVER the class display name

  // re-hydrate the saved register (by student_internal_id) when class/month
  // changes, so a saved register reappears when the Xaadiris tab is reopened.
  useEffect(() => {
    // Attendance is Phase 5/local-demo functionality. In authenticated Live
    // Mode the tab is suppressed and no AsyncStorage attendance read may run.
    if (isLive || !clsSchoolId || !clsClassId) {
      setAtt2({});
      setAttSaved(false);
      return undefined;
    }
    let alive = true;
    getClassMarksMap(clsSchoolId, clsClassId, attDateKey).then((map) => {
      if (!alive) return;
      const next = {};
      Object.keys(map).forEach((sid) => { next[sid] = { status: map[sid].status, reason: map[sid].reason }; });
      setAtt2(next);
      setAttSaved(Object.keys(map).length > 0);
    });
    return () => { alive = false; };
  }, [isLive, clsSchoolId, clsClassId, attDateKey]);

  const setAtt = (sid, status) => {
    setAttSaved(false);
    setAtt2((m) => ({ ...m, [sid]: { ...(m[sid] || {}), status } }));
    if (status !== 'present') setReasonFor(sid);
  };
  const setReason = (sid, reason) => {
    setAtt2((m) => ({ ...m, [sid]: { ...(m[sid] || {}), reason } }));
    setReasonFor(null);
  };
  // parent/student: load their own SAVED attendance from AsyncStorage
  useEffect(() => {
    if (isLive || !readOnly || !clsSchoolId) {
      if (isLive) setRoSaved({});
      return undefined;
    }
    let alive = true;
    (async () => {
      const map = {};
      for (const s of roster) map[s.student_internal_id] = await getStudentAttendance(clsSchoolId, s.student_internal_id);
      if (alive) setRoSaved(map);
    })();
    return () => { alive = false; };
  }, [isLive, readOnly, clsSchoolId, roster]);

  // teachers may only mark attendance if the School Admin granted it
  const canMark = canPerformAction(profile, 'attendance.mark');

  // persist the whole register (keyed by student_internal_id) to AsyncStorage
  const saveAttendance = async () => {
    if (!canMark) return;
    const records = orderedRoster.map((s) => ({
      student_internal_id: s.student_internal_id,
      status: (att2[s.student_internal_id] && att2[s.student_internal_id].status) || 'present',
      reason: (att2[s.student_internal_id] && att2[s.student_internal_id].reason) || '',
      notes: '',
    }));
    try {
      await saveClassAttendance(clsSchoolId, clsClassId, attDateKey, records, { recorded_by: profile.name });
      setAttSaved(true);
    } catch (e) {
      if (e.code === 'reason_required' && e.students && e.students.length) setReasonFor(e.students[0]);
    }
  };

  // only admins / a permitted teacher may open a case
  const canCreateCase = canPerformAction(profile, 'incidents.create');
  const openAddCase = (sid, locked) => { setCaseStudent(sid || (roster[0] && roster[0].student_internal_id)); setCaseLocked(!!locked); setCaseTypeText(''); setCaseSev(1); setCaseDesc(''); setCaseAction(''); setShowAddCase(true); };
  const submitCase = () => {
    const stu = roster.find((s) => s.student_internal_id === caseStudent) || roster[0];
    if (!stu || !caseDesc.trim()) return;
    const type = caseTypeText.trim() || 'Hab-dhaqan';
    const desc = caseDesc.trim() + (caseAction.trim() ? `\nTallaabada la qaaday: ${caseAction.trim()}` : '');
    const inc = [
      stu.name, name, type, CASE_SEV[caseSev].key, desc,
      profile.name, 'Maanta', 'open', 'Haa',
      clsSchoolId, clsClassId, stu.student_internal_id, caseDesc.trim(),
    ];
    setExtraCases((prev) => [inc, ...prev]);
    setShowAddCase(false);
  };

  const presentCount = Object.values(att2).filter((v) => v.status === 'present').length;
  const absentCount = Object.values(att2).filter((v) => v.status === 'absent').length;
  const lateCount = Object.values(att2).filter((v) => v.status === 'late').length;
  const totalCount = orderedRoster.length;
  const attPct = totalCount ? Math.round((presentCount / totalCount) * 100) : 0;
  const attDateLabel = `${String(month + 1).padStart(2, '0')}/2026`;
  // refresh = discard unsaved marks (reset to the empty register)
  const refreshAttendance = () => { setAtt2({}); setAttSaved(false); };
  // fees are kept PER MONTH, just like attendance, so each month has its own state
  const setFee = (code, key) => { setFees((f) => ({ ...f, [month]: { ...(f[month] || {}), [code]: key } })); setFeeSaved(false); };
  const setAllFees = (key) => setFees((f) => { const m = {}; orderedRoster.forEach((s) => { m[s.student_internal_id] = key; }); return { ...f, [month]: m }; });
  const feeOf = (s) => (fees[month] || {})[s.student_internal_id] || s.fee;

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <SchoolSelectPrompt />
      </SafeAreaView>
    );
  }

  if (liveClassError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.deniedWrap}>
          <View style={[styles.deniedCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="warning" size={30} color={c.rose} />
            <Text style={[styles.deniedTitle, { color: c.ink }]}>Fasalka lama soo dejin karin</Text>
            <Text style={[styles.deniedSub, { color: c.muted }]}>{liveClassError}</Text>
            <TouchableOpacity style={[styles.deniedBtn, { backgroundColor: c.navy }]} onPress={liveClasses.reload}>
              <Text style={styles.deniedBtnTxt}>Isku day mar kale</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---- LIVE: still resolving the class (RLS-scoped query in flight, or the
  // not-found/denied distinction is still loading) — show a plain spinner,
  // never a premature "not found"/"denied" flash and never any class data.
  if (liveStillLoading || (isLive && !allowed && liveDenialKind === null)) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.deniedWrap}>
          <ActivityIndicator color={c.blue} />
        </View>
      </SafeAreaView>
    );
  }

  // ---- access denied / not found: show a clean message + button, never
  // any class data. LIVE distinguishes "Fasalkan lama helin" (the class
  // genuinely does not exist, or exists in a different school) from a
  // permission-denied message (it exists in my school but I'm not
  // authorized) — DEMO keeps its single existing denial message. ----
  if (!allowed) {
    const notFound = isLive && liveDenialKind === 'not_found';
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.deniedWrap}>
          <View style={[styles.deniedCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name={notFound ? 'classes' : 'shield'} size={30} color={notFound ? c.muted2 : c.rose} />
            <Text style={[styles.deniedTitle, { color: c.ink }]}>
              {notFound ? 'Fasalkan lama helin' : 'Ma lihid oggolaansho aad ku furto fasalkan.'}
            </Text>
            <Text style={[styles.deniedSub, { color: c.muted }]}>Si toos ah ayaa laguu celin doonaa.</Text>
            <TouchableOpacity style={[styles.deniedBtn, { backgroundColor: c.navy }]} onPress={() => redirectUnauthorizedClassAccess(navigation)}>
              <Text style={styles.deniedBtnTxt}>Ku Noqo Fasallada</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // active tab is resolved against the role-allowed tab list
  const activeTab = allowedTabs[tab] || allowedTabs[0];
  // only admins may add students; parent/student/teacher cannot. LIVE: the
  // add-student sheet writes to the DEMO store, which is a guarded no-op in
  // live mode — so it is never offered live (Admissions is the live path).
  const canAddStudents = !isLive && mode === 'full' && (profile.scope === 'platform' || profile.scope === 'school');
  // only Super/School Admin + Accountant may change fees; parent/student read-only
  const canEditFees = mode === 'full' && canEditPayment(profile, null);
  const FEE_AMOUNT = 25; // standard monthly fee (prototype)
  const feeBreakdown = (key) => {
    if (key === 'exempt') return { expected: 0, paid: 0, remaining: 0 };
    if (key === 'partial') return { expected: FEE_AMOUNT, paid: 15, remaining: FEE_AMOUNT - 15 };
    if (key === 'due') return { expected: FEE_AMOUNT, paid: 0, remaining: FEE_AMOUNT };
    return { expected: FEE_AMOUNT, paid: FEE_AMOUNT, remaining: 0 }; // full
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      {/* hero */}
      <View style={[styles.hero, { backgroundColor: color }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back} hitSlop={10}>
          <Text style={styles.backTxt}>‹ Dib</Text>
        </TouchableOpacity>
        <Text style={styles.hName}>{name}</Text>
        <Text style={styles.hMeta}>{teacher} · {grade}</Text>
        <View style={styles.hKpis}>
          <View><Text style={styles.hKpiVal}>{displayStudentCount}</Text><Text style={styles.hKpiLbl}>Arday</Text></View>
          <View><Text style={styles.hKpiVal}>{att == null ? '—' : `${att}%`}</Text><Text style={styles.hKpiLbl}>Xaadir</Text></View>
          <View><Text style={styles.hKpiVal}>{cap}</Text><Text style={styles.hKpiLbl}>Kaadhka</Text></View>
        </View>
      </View>

      {/* tabs — role-aware (only the tabs this profile may see) */}
      <View style={[styles.tabRow, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
          {allowedTabs.map((t, i) => (
            <TouchableOpacity key={t} onPress={() => setTab(i)} style={styles.tabBtn}>
              <Text style={[styles.tabTxt, { color: tab === i ? c.navy : c.muted }]}>{t}</Text>
              {tab === i && <View style={[styles.tabBar, { backgroundColor: c.blue }]} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* TAB — Ardayda (roster) */}
      {activeTab === 'Ardayda' && (
        <View style={{ flex: 1, padding: 16 }}>
          <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="search" size={18} color={c.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Raadi arday…"
              placeholderTextColor={c.muted2}
              style={[styles.searchInput, { color: c.ink }]}
            />
          </View>
          {isLive && (liveEnrollments.loading || liveStudents.loading) ? (
            <View style={styles.liveRosterState}><ActivityIndicator color={c.blue} /></View>
          ) : isLive && (liveEnrollments.error || liveStudents.error) ? (
            <View style={styles.liveRosterState}>
              <Text style={[styles.deniedSub, { color: c.rose }]}>{liveEnrollments.error || liveStudents.error}</Text>
              <TouchableOpacity onPress={() => { liveEnrollments.reload(); liveStudents.reload(); }}>
                <Text style={{ color: c.blue, fontWeight: '800', marginTop: 8 }}>Isku day mar kale</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.student_internal_id}
              renderItem={({ item, index }) => (
                <StudentRow student={item} index={index} onPress={setSelected} liveMode={isLive} onRoll={canRenumber ? openRoll : undefined} />
              )}
              ListEmptyComponent={isLive ? <Text style={[styles.mutedNote, { color: c.muted, textAlign: 'center', padding: 24 }]}>Weli arday firfircoon kuma jiro fasalkan.</Text> : null}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 90 }}
            />
          )}
        </View>
      )}

      {/* TAB 1 — Xaadiris: parent/student get a READ-ONLY history of their
          own child / self (never the class-wide register) */}
      {activeTab === 'Xaadiris' && readOnly && (
        <FlatList
          style={{ flex: 1 }}
          data={orderedRoster}
          keyExtractor={(item) => item.student_internal_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          renderItem={({ item }) => {
            // saved attendance (from AsyncStorage) comes FIRST, then a sample history
            const saved = (roSaved[item.student_internal_id] || []).map((r) => ({ date: 'La kaydiyay', status: r.status, reason: r.reason, saved: true }));
            const hist = [...saved, ...attendanceHistory(item.student_internal_id, item.att || 90, 8)];
            const present = hist.filter((h) => h.status === 'present').length;
            return (
              <View style={[styles.feeRow, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.feeTop}>
                  <Text style={[styles.hName2, { color: c.ink, flex: 1 }]} numberOfLines={1}>{item.name}</Text>
                  <Badge label={`${present}/${hist.length} jooga`} tone="green" />
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {hist.map((h, i) => {
                    const st = ATT_STATES.find((s) => s.key === h.status) || ATT_STATES[0];
                    return (
                      <View key={i} style={{ alignItems: 'center', width: 56 }}>
                        <View style={[styles.attBtn, { borderColor: st.tone, backgroundColor: st.tone }]}>
                          <Icon name={st.icon} size={12} color="#fff" strokeWidth={2.4} />
                        </View>
                        <Text style={{ fontSize: 9.5, color: c.muted, marginTop: 3 }}>{h.date}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.attReason, { color: c.blue, marginTop: 10 }]}>Macalinka ayaa diiwaan geliya.</Text>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* TAB 1 — Xaadiris: teacher without attendance.mark sees a locked state */}
      {activeTab === 'Xaadiris' && !readOnly && !canMark && (
        <View style={styles.lockedWrap}>
          <View style={[styles.lockedCard, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name="shield" size={26} color={c.muted} />
            <Text style={[styles.lockedTitle, { color: c.ink }]}>School Admin permission required</Text>
            <Text style={[styles.lockedSub, { color: c.muted }]}>Ogolaanshaha "attendance.mark" lagama helin. La xidhiidh Maamulaha Dugsiga.</Text>
          </View>
        </View>
      )}

      {/* TAB 1 — Xaadiris (attendance: Jooga/Maqan/Soo daahay/Erid + reason + Save) */}
      {activeTab === 'Xaadiris' && !readOnly && canMark && (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.student_internal_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* date + month picker + refresh */}
              <View style={[styles.xCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.xDateRow}>
                  <View style={[styles.xDateBox, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="attendance" size={16} color={c.navy} />
                    <Text style={[styles.xDateTxt, { color: c.ink }]}>{`22/${attDateLabel}`}</Text>
                  </View>
                  <TouchableOpacity style={[styles.xRefresh, { backgroundColor: c.blue }]} onPress={refreshAttendance}>
                    <Icon name="download" size={18} color="#fff" strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>
                {/* month chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity key={m} onPress={() => setMonth(i)}
                      style={[styles.monthChip, { borderColor: c.line, backgroundColor: i === month ? c.navy : c.bg }]}>
                      <Text style={[styles.monthTxt, { color: i === month ? '#fff' : c.ink2 }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {/* 4 summary chips: Jooga / Maqan / Soo daahay / Wadar */}
                <View style={styles.xChips}>
                  <View style={[styles.xChip, { backgroundColor: c.greenSoft }]}><Icon name="check" size={14} color={c.green} strokeWidth={2.6} /><Text style={[styles.xChipTxt, { color: c.green }]}>{presentCount}</Text></View>
                  <View style={[styles.xChip, { backgroundColor: c.roseSoft }]}><Icon name="close" size={14} color={c.rose} strokeWidth={2.6} /><Text style={[styles.xChipTxt, { color: c.rose }]}>{absentCount}</Text></View>
                  <View style={[styles.xChip, { backgroundColor: c.goldSoft }]}><Icon name="clock" size={14} color={c.gold700} strokeWidth={2.6} /><Text style={[styles.xChipTxt, { color: c.gold700 }]}>{lateCount}</Text></View>
                  <View style={[styles.xChip, { backgroundColor: c.blueSoft }]}><Icon name="students" size={14} color={c.navy} strokeWidth={2.4} /><Text style={[styles.xChipTxt, { color: c.navy }]}>{totalCount}</Text></View>
                </View>
              </View>

              {/* progress bar */}
              <View style={[styles.xCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.xProgTop}>
                  <Text style={[styles.xProgTitle, { color: c.ink }]}>Xaadiris-ka</Text>
                  <Text style={[styles.xProgPct, { color: c.blue }]}>{attPct}%</Text>
                </View>
                <View style={[styles.xProgTrack, { backgroundColor: c.line }]}>
                  <View style={[styles.xProgFill, { width: `${attPct}%`, backgroundColor: c.green }]} />
                </View>
              </View>

              {/* search + mark-all-present (green) */}
              <View style={styles.xSearchRow}>
                <View style={[styles.xSearch, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Icon name="search" size={16} color={c.muted} />
                  <TextInput value={q} onChangeText={setQ} placeholder="Raadi…" placeholderTextColor={c.muted2} style={[styles.xSearchInput, { color: c.ink }]} />
                </View>
                <TouchableOpacity style={[styles.xAllBtn, { backgroundColor: c.green }]} onPress={() => setAll('present')}>
                  <Icon name="check" size={15} color="#fff" strokeWidth={2.6} /><Text style={styles.xAllTxt}>Dhammaan</Text>
                </TouchableOpacity>
              </View>
              {/* mark-all-absent (red) + save (blue) */}
              <View style={styles.xActionRow}>
                <TouchableOpacity style={[styles.xAllBtn, { backgroundColor: c.rose, flex: 1 }]} onPress={() => setAll('absent')}>
                  <Icon name="close" size={15} color="#fff" strokeWidth={2.6} /><Text style={styles.xAllTxt}>Dhammaan</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.xAllBtn, { backgroundColor: attSaved ? c.green : c.blue, flex: 1 }]} onPress={saveAttendance}>
                  <Icon name="check" size={15} color="#fff" strokeWidth={2.4} /><Text style={styles.xAllTxt}>{attSaved ? 'La kaydiyay' : 'Keydi'}</Text>
                </TouchableOpacity>
              </View>

              {/* table header */}
              <View style={[styles.tblCardTop, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={styles.tblTitleRow}>
                  <Text style={[styles.tblTitle, { color: c.ink }]}>Xaadiris-ka Ardayda</Text>
                  <Text style={[styles.tblDate, { color: c.muted2 }]}>2026-{attDateLabel.slice(0, 2)}-22</Text>
                </View>
                <View style={[styles.tblHead, { borderTopColor: c.line, borderBottomColor: c.line }]}>
                  <Text style={[styles.thHash, { color: c.muted2 }]}>#</Text>
                  <Text style={[styles.thName, { color: c.muted2 }]}>MAGACA / ID</Text>
                  <Text style={[styles.thAction, { color: c.muted2 }]}>XAALAD · FICIL</Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={[styles.mutedNote, { color: c.muted, textAlign: 'center', padding: 20 }]}>🪑 Lama helin</Text>}
          renderItem={({ item, index }) => {
            const rec = att2[item.student_internal_id] || {};
            return (
              <View style={[styles.tblRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                {canRenumber ? (
                  <TouchableOpacity onPress={() => openRoll(item)} hitSlop={8} style={[styles.hashBtn, { backgroundColor: c.blueSoft }]}>
                    <Text style={[styles.hashBtnTxt, { color: c.navy }]}>{String(index + 1).padStart(2, '0')}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.tdHash, { color: c.muted }]}>{String(index + 1).padStart(2, '0')}</Text>
                )}
                <View style={styles.tdName}>
                  <Text style={[styles.tdNameTxt, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.tdId, { color: c.muted }]} numberOfLines={1}>{item.student_id}{rec.reason ? ` · ${rec.reason}` : ''}</Text>
                </View>
                <View style={styles.tdAction}>
                  {ATT_STATES.map((st) => {
                    const on = rec.status === st.key;
                    return (
                      <TouchableOpacity key={st.key} onPress={() => setAtt(item.student_internal_id, st.key)}
                        style={[styles.tBtn, { borderColor: st.tone, backgroundColor: on ? st.tone : 'transparent' }]}>
                        <Icon name={st.icon} size={12} color={on ? '#fff' : st.tone} strokeWidth={2.6} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          }}
        />
      )}

      {/* TAB 2 — Natiijada (gradebook: subjects as columns, students as rows) */}
      {activeTab === 'Natiijada' && (() => {
        const subjects = getClassSubjects(grade);
        const abbr = (n) => n.replace(/[^A-Za-z]/g, '').slice(0, 3);
        const rowsData = orderedRoster.map((s) => ({ s, r: calculateStudentResult(s, grade) }));
        const classAvg = rowsData.length ? Math.round(rowsData.reduce((a, x) => a + x.r.average, 0) / rowsData.length) : 0;
        const passN = rowsData.filter((x) => x.r.passed).length;
        const ROW_H = 46, HEAD_H = 34, CELL_W = 46, NAME_W = 132, AVG_W = 54;
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* class summary band */}
            <View style={[styles.gbSummary, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
              <View style={styles.gbSumCell}>
                <Text style={[styles.gbSumVal, { color: c.navy }]}>{classAvg}%</Text>
                <Text style={[styles.gbSumLbl, { color: c.muted }]}>Celcelis fasalka</Text>
              </View>
              <View style={[styles.gbSumDiv, { backgroundColor: c.line }]} />
              <View style={styles.gbSumCell}>
                <Text style={[styles.gbSumVal, { color: c.green }]}>{passN}/{rowsData.length}</Text>
                <Text style={[styles.gbSumLbl, { color: c.muted }]}>Gudbay</Text>
              </View>
              <View style={[styles.gbSumDiv, { backgroundColor: c.line }]} />
              <View style={styles.gbSumCell}>
                <Text style={[styles.gbSumVal, { color: c.rose }]}>{rowsData.length - passN}</Text>
                <Text style={[styles.gbSumLbl, { color: c.muted }]}>Dhacay</Text>
              </View>
            </View>
            <Text style={[styles.mutedNote, { color: c.muted }]}>Riix magaca ardayga si aad u aragto faahfaahinta · jiid si aad u aragto maadooyinka oo dhan.</Text>

            {/* gradebook: frozen name column + horizontally-scrollable subjects + avg */}
            <View style={[styles.gbWrap, { borderColor: c.line, backgroundColor: c.surface }, shadow.sm]}>
              <View style={{ flexDirection: 'row' }}>
                {/* frozen name column */}
                <View style={{ width: NAME_W }}>
                  <View style={[styles.gbHeadCell, { height: HEAD_H, borderBottomColor: c.line, borderRightColor: c.line, borderRightWidth: 1, alignItems: 'flex-start', paddingLeft: 12 }]}>
                    <Text style={[styles.gbHeadTxt, { color: c.muted }]}>ARDAY</Text>
                  </View>
                  {rowsData.map(({ s }, i) => (
                    <TouchableOpacity key={s.student_internal_id} onPress={() => setSelected(s)} activeOpacity={0.6}
                      style={[styles.gbNameCell, { height: ROW_H, borderBottomColor: c.line, borderRightColor: c.line, backgroundColor: i % 2 ? c.bg : 'transparent' }]}>
                      <Text style={[styles.gbName, { color: c.ink }]} numberOfLines={1}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* scrollable subject columns + average */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={{ flexDirection: 'row' }}>
                      {subjects.map((su) => (
                        <View key={su} style={[styles.gbHeadCell, { width: CELL_W, height: HEAD_H, borderBottomColor: c.line }]}>
                          <Text style={[styles.gbHeadTxt, { color: c.muted }]}>{abbr(su)}</Text>
                        </View>
                      ))}
                      <View style={[styles.gbHeadCell, { width: AVG_W, height: HEAD_H, borderBottomColor: c.line, backgroundColor: c.blueSoft }]}>
                        <Text style={[styles.gbHeadTxt, { color: c.navy }]}>CEL</Text>
                      </View>
                    </View>
                    {rowsData.map(({ s, r }, i) => (
                      <View key={s.student_internal_id} style={{ flexDirection: 'row', backgroundColor: i % 2 ? c.bg : 'transparent' }}>
                        {r.rows.map((row) => (
                          <View key={row.subject} style={[styles.gbCell, { width: CELL_W, height: ROW_H, borderBottomColor: c.line }]}>
                            <Text style={[styles.gbMark, { color: row.passed ? c.green : c.rose }]}>{row.marks}</Text>
                          </View>
                        ))}
                        <View style={[styles.gbCell, { width: AVG_W, height: ROW_H, borderBottomColor: c.line, backgroundColor: c.blueSoft }]}>
                          <Text style={[styles.gbAvg, { color: r.passed ? c.green : c.rose }]}>{r.average}%</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          </ScrollView>
        );
      })()}

      {/* TAB 3 — Lacagta (Bixiyay/Ma Bixin/Qayb/Bilaash + mark free) */}
      {activeTab === 'Lacagta' && (() => {
        const paidN = orderedRoster.filter((s) => feeOf(s) === 'full').length;
        const partN = orderedRoster.filter((s) => feeOf(s) === 'partial').length;
        const dueN = orderedRoster.filter((s) => feeOf(s) === 'due').length;
        const collectedPct = totalCount ? Math.round((paidN / totalCount) * 100) : 0;
        const FEE_ICON = { full: 'check', partial: 'clock', due: 'close', exempt: 'note' };
        const FEE_TONE = { full: c.green, partial: c.gold700, due: c.rose, exempt: c.blue };
        return (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(item) => item.student_internal_id}
          contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* month selector + 4 summary chips (like attendance) */}
              <View style={[styles.xCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.xDateRow}>
                  <View style={[styles.xDateBox, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Icon name="finance" size={16} color={c.navy} />
                    <Text style={[styles.xDateTxt, { color: c.ink }]}>{MONTHS[month]} 2026</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 10 }}>
                  {MONTHS.map((m, i) => (
                    <TouchableOpacity key={m} onPress={() => setMonth(i)}
                      style={[styles.monthChip, { borderColor: c.line, backgroundColor: i === month ? c.navy : c.bg }]}>
                      <Text style={[styles.monthTxt, { color: i === month ? '#fff' : c.ink2 }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={styles.xChips}>
                  <View style={[styles.xChip, { backgroundColor: c.greenSoft }]}><Icon name="check" size={14} color={c.green} strokeWidth={2.6} /><Text style={[styles.xChipTxt, { color: c.green }]}>{paidN}</Text></View>
                  <View style={[styles.xChip, { backgroundColor: c.goldSoft }]}><Icon name="clock" size={14} color={c.gold700} strokeWidth={2.6} /><Text style={[styles.xChipTxt, { color: c.gold700 }]}>{partN}</Text></View>
                  <View style={[styles.xChip, { backgroundColor: c.roseSoft }]}><Icon name="close" size={14} color={c.rose} strokeWidth={2.6} /><Text style={[styles.xChipTxt, { color: c.rose }]}>{dueN}</Text></View>
                  <View style={[styles.xChip, { backgroundColor: c.blueSoft }]}><Icon name="students" size={14} color={c.navy} strokeWidth={2.4} /><Text style={[styles.xChipTxt, { color: c.navy }]}>{totalCount}</Text></View>
                </View>
              </View>
              {/* collected progress */}
              <View style={[styles.xCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={styles.xProgTop}>
                  <Text style={[styles.xProgTitle, { color: c.ink }]}>La Uruuriyay</Text>
                  <Text style={[styles.xProgPct, { color: c.green }]}>{collectedPct}%</Text>
                </View>
                <View style={[styles.xProgTrack, { backgroundColor: c.line }]}>
                  <View style={[styles.xProgFill, { width: `${collectedPct}%`, backgroundColor: c.green }]} />
                </View>
              </View>
              {/* search + bulk actions (admins/accountant) */}
              <View style={styles.xSearchRow}>
                <View style={[styles.xSearch, { backgroundColor: c.surface, borderColor: c.line, flex: 1 }]}>
                  <Icon name="search" size={16} color={c.muted} />
                  <TextInput value={q} onChangeText={setQ} placeholder="Raadi…" placeholderTextColor={c.muted2} style={[styles.xSearchInput, { color: c.ink }]} />
                </View>
                {canEditFees ? (
                  <TouchableOpacity style={[styles.xAllBtn, { backgroundColor: c.green }]} onPress={() => { setAllFees('full'); setFeeSaved(false); }}>
                    <Icon name="check" size={15} color="#fff" strokeWidth={2.6} /><Text style={styles.xAllTxt}>Dhammaan</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {/* mark-all-due (red) + save (blue) */}
              {canEditFees ? (
                <View style={styles.xActionRow}>
                  <TouchableOpacity style={[styles.xAllBtn, { backgroundColor: c.rose, flex: 1 }]} onPress={() => { setAllFees('due'); setFeeSaved(false); }}>
                    <Icon name="close" size={15} color="#fff" strokeWidth={2.6} /><Text style={styles.xAllTxt}>Ma Bixin</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.xAllBtn, { backgroundColor: feeSaved ? c.green : c.blue, flex: 1 }]} onPress={() => setFeeSaved(true)}>
                    <Icon name="check" size={15} color="#fff" strokeWidth={2.4} /><Text style={styles.xAllTxt}>{feeSaved ? 'La kaydiyay' : 'Keydi'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {/* list title (NOT a table — proper payment cards) */}
              <View style={styles.feeListHead}>
                <Text style={[styles.tblTitle, { color: c.ink }]}>Lacagta Ardayda</Text>
                <Text style={[styles.tblDate, { color: c.muted2 }]}>$25 / bishii</Text>
              </View>
            </View>
          }
          ListEmptyComponent={<Text style={[styles.mutedNote, { color: c.muted, textAlign: 'center', padding: 20 }]}>🪑 Lama helin</Text>}
          renderItem={({ item, index }) => {
            const key = feeOf(item);
            const fee = FEE_LABELS[key] || FEE_LABELS.full;
            const bd = feeBreakdown(key);
            return (
              <View style={[styles.feeCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                {/* top: name + ID + current status */}
                <View style={styles.feeCardTop}>
                  <Text style={[styles.tdHash, { color: c.muted }]}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.tdNameTxt, { color: c.ink }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.tdId, { color: c.muted }]} numberOfLines={1}>{item.student_id} · ${bd.paid}/${bd.expected}</Text>
                  </View>
                  <Badge label={fee.label} tone={fee.tone} />
                </View>

                {canEditFees ? (
                  /* labeled, tappable payment options */
                  <View style={styles.feeOpts}>
                    {[['full', 'Bixiyay', c.green, c.greenSoft], ['partial', 'Qayb ahaan', c.gold700, c.goldSoft], ['exempt', 'Free', c.blue, c.blueSoft], ['due', 'Ma bixin', c.rose, c.roseSoft]].map(([k, lbl, tone, soft]) => {
                      const on = key === k;
                      return (
                        <TouchableOpacity key={k} onPress={() => setFee(item.student_internal_id, k)}
                          style={[styles.feeOpt, { borderColor: on ? tone : c.line, backgroundColor: on ? tone : soft }]}>
                          <Icon name={on ? 'check' : 'finance'} size={13} color={on ? '#fff' : tone} strokeWidth={2.4} />
                          <Text style={[styles.feeOptTxt, { color: on ? '#fff' : tone }]}>{lbl}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  /* parent / student — read-only breakdown */
                  <View style={styles.feeReadGrid}>
                    <View style={styles.feeReadCell}><Text style={[styles.feeReadVal, { color: c.ink }]}>${bd.expected}</Text><Text style={[styles.feeReadLbl, { color: c.muted }]}>La filayo</Text></View>
                    <View style={styles.feeReadCell}><Text style={[styles.feeReadVal, { color: c.green }]}>${bd.paid}</Text><Text style={[styles.feeReadLbl, { color: c.muted }]}>La bixiyay</Text></View>
                    <View style={styles.feeReadCell}><Text style={[styles.feeReadVal, { color: bd.remaining ? c.rose : c.muted }]}>${bd.remaining}</Text><Text style={[styles.feeReadLbl, { color: c.muted }]}>Hadhay</Text></View>
                  </View>
                )}
              </View>
            );
          }}
        />
        );
      })()}

      {/* TAB 4 — Kiisaska (incidents for this class — school + class scoped,
          never by class-name alone) */}
      {activeTab === 'Kiisaska' && (
        <FlatList
          style={{ flex: 1 }}
          data={classCases}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.feeListHead}>
              <Text style={[styles.tblTitle, { color: c.ink }]}>Kiisaska Fasalka</Text>
              {canCreateCase ? (
                <TouchableOpacity style={[styles.addCaseBtn, { backgroundColor: c.blue }]} onPress={() => openAddCase(null)}>
                  <Icon name="plus" size={15} color="#fff" strokeWidth={2.4} /><Text style={styles.addCaseTxt}>Ku dar Kiis</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Text style={[styles.mutedNote, { color: c.muted, textAlign: 'center' }]}>Kiis kuma jiro fasalkan.</Text>
              {canCreateCase ? <Text style={[styles.hPhone, { color: c.blue }]} onPress={() => openAddCase(null)}>Riix "Ku dar Kiis" si aad u gasho</Text> : null}
            </View>
          }
          renderItem={({ item, index }) => {
            const open = caseOpen === index;
            const sev = SEVERITY[item[3]] || SEVERITY.low;
            return (
              <View style={[styles.caseCard, { backgroundColor: c.surface, borderColor: open ? c.blue : c.line }, shadow.sm]}>
                {/* tap to reveal full detail */}
                <TouchableOpacity style={styles.caseHead} activeOpacity={0.7} onPress={() => setCaseOpen(open ? null : index)}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.hName2, { color: c.ink }]} numberOfLines={1}>{item[0]}</Text>
                    <Text style={[styles.hPhone, { color: c.muted }]} numberOfLines={1}>{item[2]} · {item[6]}</Text>
                  </View>
                  <Badge label={sev.label} tone={sev.tone} />
                  <View style={{ transform: [{ rotate: open ? '90deg' : '0deg' }], marginLeft: 6 }}>
                    <Icon name="chevronRight" size={18} color={c.muted2} />
                  </View>
                </TouchableOpacity>

                {open ? (
                  <View style={[styles.caseBody, { borderTopColor: c.line }]}>
                    <CaseRow c={c} label="NOOCA KIISKA" value={item[2]} />
                    <CaseRow c={c} label="DARAJADA" value={sev.label} />
                    <Text style={[styles.caseLbl, { color: c.muted }]}>SABABTA / FAAHFAAHIN</Text>
                    <Text style={[styles.caseDesc, { color: c.ink2 }]}>{item[4]}</Text>
                    <CaseRow c={c} label="SOO SHEEGAY" value={item[5]} />
                    <CaseRow c={c} label="TAARIIKHDA" value={item[6]} />
                    <CaseRow c={c} label="XAALADDA" value={(INC_STATUS[item[7]] || {}).label || item[7]} />
                    <CaseRow c={c} label="WAALID LA OGEYSIIYAY" value={item[8]} />
                    {item[12] ? (<><Text style={[styles.caseLbl, { color: c.muted }]}>KOOBKA WAALIDKA</Text><Text style={[styles.caseDesc, { color: c.ink2 }]}>{item[12]}</Text></>) : null}
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      {/* Add Case sheet — pick student + type + severity + reason */}
      <Modal visible={showAddCase} transparent animationType="slide" onRequestClose={() => setShowAddCase(false)}>
        <View style={styles.reasonOverlay}>
          <View style={[styles.addCaseSheet, { backgroundColor: c.surface }]}>
            <View style={styles.addCaseHeadRow}>
              <Text style={[styles.reasonTitle, { color: c.ink }]}>Kiis Cusub · Ku dar</Text>
              <TouchableOpacity onPress={() => setShowAddCase(false)} hitSlop={10}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={[styles.caseLbl, { color: c.muted }]}>ARDAYGA</Text>
              {caseLocked ? (
                /* opened from the profile — student is auto-captured, no picker */
                <View style={[styles.caseField, { backgroundColor: c.blueSoft, borderColor: c.blueSoft, justifyContent: 'center' }]}>
                  <Text style={[styles.caseChipTxt, { color: c.navy }]} numberOfLines={1}>
                    {(roster.find((s) => s.student_internal_id === caseStudent) || {}).name || '—'}
                  </Text>
                </View>
              ) : (
                <View style={styles.caseChips}>
                  {roster.map((s) => {
                    const on = caseStudent === s.student_internal_id;
                    return (
                      <TouchableOpacity key={s.student_internal_id} onPress={() => setCaseStudent(s.student_internal_id)}
                        style={[styles.caseChip, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blue : c.bg }]}>
                        <Text style={[styles.caseChipTxt, { color: on ? '#fff' : c.ink2 }]} numberOfLines={1}>{s.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Text style={[styles.caseLbl, { color: c.muted }]}>NOOCA KIISKA</Text>
              <TextInput value={caseTypeText} onChangeText={setCaseTypeText} placeholder="tusaale: Soo daahid, Khilaaf, Hadal xun…" placeholderTextColor={c.muted2}
                style={[styles.caseField, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} />
              <Text style={[styles.caseLbl, { color: c.muted }]}>DARAJADA</Text>
              <View style={styles.caseChips}>
                {CASE_SEV.map((s, i) => {
                  const on = caseSev === i;
                  return (
                    <TouchableOpacity key={s.key} onPress={() => setCaseSev(i)}
                      style={[styles.caseChip, { borderColor: on ? c[s.tone] : c.line, backgroundColor: on ? c[s.tone] : c.bg }]}>
                      <Text style={[styles.caseChipTxt, { color: on ? '#fff' : c.ink2 }]}>{s.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.caseLbl, { color: c.muted }]}>SABABTA / FAAHFAAHIN *</Text>
              <TextInput value={caseDesc} onChangeText={setCaseDesc} placeholder="Qor si faahfaahsan waxa dhacay…" placeholderTextColor={c.muted2}
                multiline style={[styles.caseInput, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} />
              <Text style={[styles.caseLbl, { color: c.muted }]}>TALLAABADA LA QAADAY</Text>
              <TextInput value={caseAction} onChangeText={setCaseAction} placeholder="tusaale: Waalidka waa la wacay…" placeholderTextColor={c.muted2}
                multiline style={[styles.caseInput, { backgroundColor: c.bg, borderColor: c.line, color: c.ink, minHeight: 56 }]} />
            </ScrollView>
            <TouchableOpacity style={[styles.caseSave, { backgroundColor: c.blue }]} onPress={submitCase}>
              <Icon name="check" size={16} color="#fff" strokeWidth={2.4} /><Text style={styles.caseSaveTxt}>Kaydi Kiiska</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* absence reason picker */}
      {reasonFor ? (
        <View style={styles.reasonOverlay}>
          <View style={[styles.reasonSheet, { backgroundColor: c.surface }]}>
            <Text style={[styles.reasonTitle, { color: c.ink }]}>Sababta maqnaanshaha</Text>
            <View style={styles.reasonChips}>
              {ABSENCE_REASONS.map((r) => (
                <TouchableOpacity key={r} style={[styles.reasonChip, { backgroundColor: c.blueSoft }]} onPress={() => setReason(reasonFor, r)}>
                  <Text style={[styles.reasonChipTxt, { color: c.navy }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setReasonFor(null)}><Text style={[styles.reasonSkip, { color: c.muted }]}>Ka bax</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Floating + button — admins only, on the Ardayda tab */}
      {activeTab === 'Ardayda' && canAddStudents && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: c.blue }, shadow.card]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      )}

      <StudentProfileModal
        visible={!!selected}
        student={selected}
        className={name}
        onClose={() => setSelected(null)}
        liveMode={isLive}
        cases={selected ? classCases.filter((it) => it[11] === selected.student_internal_id) : []}
        onReportCase={canCreateCase ? (s) => { setSelected(null); openAddCase(s.student_internal_id, true); } : undefined}
      />

      <AddStudentModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={addStudent}
        classId={clsClassId}
      />

      {/* Beddel Lambar — reassign a roll number (freed when a student leaves) */}
      <Modal visible={!!rollFor} transparent animationType="fade" onRequestClose={() => setRollFor(null)}>
        <TouchableOpacity style={styles.rollOverlay} activeOpacity={1} onPress={() => setRollFor(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.rollSheet, { backgroundColor: c.surface }]}>
            <View style={styles.rollHead}>
              <Text style={[styles.rollTitle, { color: c.ink }]}>Beddel Lambarka</Text>
              <TouchableOpacity onPress={() => setRollFor(null)} hitSlop={10}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
            </View>
            <Text style={[styles.rollName, { color: c.ink }]} numberOfLines={1}>{rollFor ? rollFor.name : ''}</Text>
            <Text style={[styles.rollHint, { color: c.muted }]}>Geli lambarka cusub. Wuxuu lambarka kula beddelan doonaa ardayga hadda haysta — ardayda kale isma beddelaan.</Text>
            <View style={styles.rollInputRow}>
              <Text style={[styles.rollHash, { color: c.muted }]}>#</Text>
              <TextInput
                value={rollInput}
                onChangeText={setRollInput}
                keyboardType="number-pad"
                placeholder="tusaale: 1"
                placeholderTextColor={c.muted2}
                style={[styles.rollInput, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
              />
              <TouchableOpacity onPress={applyRollNumber} style={[styles.rollGo, { backgroundColor: c.blue }]}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.4} />
                <Text style={styles.rollGoTxt}>Beddel</Text>
              </TouchableOpacity>
            </View>
            {/* student left — frees the number for someone else */}
            <TouchableOpacity onPress={markStudentLeft} style={[styles.rollLeft, { borderColor: c.roseSoft, backgroundColor: c.roseSoft }]}>
              <Icon name="close" size={15} color={c.rose} strokeWidth={2.4} />
              <Text style={[styles.rollLeftTxt, { color: c.rose }]}>Wuu baxay — ka saar fasalka</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  hero: { padding: 20, paddingTop: 14 },
  back: { marginBottom: 8 },
  backTxt: { color: 'rgba(255,255,255,.9)', fontSize: 15, fontWeight: '700' },
  hName: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hMeta: { color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 4 },
  hKpis: { flexDirection: 'row', gap: 28, marginTop: 16 },
  hKpiVal: { color: '#fff', fontSize: 18, fontWeight: '800' },
  hKpiLbl: { color: 'rgba(255,255,255,.75)', fontSize: 11, marginTop: 1 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' },
  tabTxt: { fontSize: 14, fontWeight: '700' },
  tabBar: { height: 3, borderRadius: 3, width: '100%', marginTop: 8, position: 'absolute', bottom: 0 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14 },
  mutedNote: { fontSize: 12.5, fontWeight: '600', marginBottom: 14, lineHeight: 18 },
  liveRosterState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  lockedWrap: { flex: 1, padding: 24, justifyContent: 'center' },
  lockedCard: { alignItems: 'center', gap: 8, padding: 28, borderRadius: 16, borderWidth: 1 },
  lockedTitle: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  lockedSub: { fontSize: 12.5, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  deniedWrap: { flex: 1, padding: 24, justifyContent: 'center' },
  deniedCard: { alignItems: 'center', gap: 10, padding: 28, borderRadius: 18, borderWidth: 1 },
  deniedTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 22 },
  deniedSub: { fontSize: 12.5, fontWeight: '600', textAlign: 'center' },
  deniedBtn: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 12 },
  deniedBtnTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  feeReadGrid: { flexDirection: 'row', marginTop: 10 },
  feeReadCell: { flex: 1, alignItems: 'center' },
  feeReadVal: { fontSize: 16, fontWeight: '800' },
  feeReadLbl: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  feeListHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 10 },
  feeCard: { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 10 },
  feeCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feeOpts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  feeOpt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1.4, minWidth: '47%', flexGrow: 1 },
  feeOptTxt: { fontSize: 12.5, fontWeight: '800' },
  // ---- Kiisaska (cases) ----
  addCaseBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 },
  addCaseTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  caseCard: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  caseHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13 },
  caseBody: { borderTopWidth: 1, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 13 },
  caseLbl: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, marginTop: 10, marginBottom: 4 },
  caseDesc: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  caseInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 5 },
  caseInfoLbl: { fontSize: 11.5, fontWeight: '700' },
  caseInfoVal: { fontSize: 12.5, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  addCaseSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 26 },
  addCaseHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  caseChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 4 },
  caseChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, maxWidth: '100%' },
  caseChipTxt: { fontSize: 12.5, fontWeight: '700' },
  caseField: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46, fontSize: 14, marginTop: 4 },
  caseInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 14, textAlignVertical: 'top', marginTop: 4 },
  caseSave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, marginTop: 16 },
  caseSaveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  // ---- web-style attendance / fees table ----
  xCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  xDateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  xDateBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  xDateTxt: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  xRefresh: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monthChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  monthTxt: { fontSize: 12.5, fontWeight: '700' },
  xChips: { flexDirection: 'row', gap: 8 },
  xChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12 },
  xChipTxt: { fontSize: 15, fontWeight: '800' },
  xProgTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  xProgTitle: { fontSize: 14.5, fontWeight: '800' },
  xProgPct: { fontSize: 16, fontWeight: '800' },
  xProgTrack: { height: 12, borderRadius: 6, overflow: 'hidden' },
  xProgFill: { height: 12, borderRadius: 6 },
  xSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  xSearch: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  xSearchInput: { flex: 1, fontSize: 14 },
  xAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 16, height: 46, borderRadius: 12 },
  xAllTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
  xActionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tblCardTop: { borderRadius: 16, borderWidth: 1, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingTop: 14, paddingHorizontal: 14, marginBottom: -1 },
  tblTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tblTitle: { fontSize: 15, fontWeight: '800' },
  tblDate: { fontSize: 12.5, fontWeight: '700' },
  tblHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderBottomWidth: 1 },
  thHash: { width: 28, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  thName: { flex: 1, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  thAction: { width: 132, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, textAlign: 'right' },
  tblRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderTopWidth: 0, paddingVertical: 9, paddingHorizontal: 14 },
  tdHash: { width: 28, fontSize: 12.5, fontWeight: '700' },
  hashBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hashBtnTxt: { fontSize: 12.5, fontWeight: '800' },
  rollOverlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  rollSheet: { width: '100%', maxWidth: 420, borderRadius: 20, padding: 20 },
  rollHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rollTitle: { fontSize: 17, fontWeight: '800' },
  rollName: { fontSize: 15, fontWeight: '700', marginTop: 10 },
  rollHint: { fontSize: 12.5, fontWeight: '500', lineHeight: 18, marginTop: 6 },
  rollInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  rollHash: { fontSize: 18, fontWeight: '800' },
  rollInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 16, fontWeight: '700' },
  rollGo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 48, borderRadius: 12 },
  rollGoTxt: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  rollLeft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 12, marginTop: 14 },
  rollLeftTxt: { fontSize: 13.5, fontWeight: '700' },
  tdName: { flex: 1, minWidth: 0, paddingRight: 6 },
  tdNameTxt: { fontSize: 13.5, fontWeight: '700' },
  tdId: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  tdAction: { width: 132, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  tBtn: { width: 28, height: 28, borderWidth: 1.4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  hName2: { fontSize: 14.5, fontWeight: '700' },
  // attendance
  weekendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 12, marginHorizontal: 16, marginTop: 10 },
  weekendTxt: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  weekendPill: { borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 },
  weekendPillTxt: { fontSize: 11, fontWeight: '700' },
  attSummary: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 6 },
  attCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  attVal: { fontSize: 20, fontWeight: '800' },
  attLbl: { fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  attRow: { padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  attTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  attBtns: { flexDirection: 'row', gap: 6 },
  attBtn: { flex: 1, flexDirection: 'row', gap: 4, borderWidth: 1.3, borderRadius: 9, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  attBtnTxt: { fontSize: 11, fontWeight: '700' },
  attReason: { fontSize: 11.5, fontWeight: '600', marginTop: 8 },
  saveBar: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  saveBarTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  // results
  resWrap: { borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: 'hidden' },
  resHead: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  resBody: { borderTopWidth: 1, padding: 14, gap: 6 },
  resSub: { flexDirection: 'row', alignItems: 'center' },
  resSubName: { flex: 1, fontSize: 13, fontWeight: '600' },
  resSubMark: { width: 60, fontSize: 12.5, textAlign: 'center' },
  resSubGrade: { width: 28, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  resSubPF: { width: 56, fontSize: 11.5, fontWeight: '700', textAlign: 'right' },
  resTotal: { borderTopWidth: 1, marginTop: 6, paddingTop: 10 },
  resTotalLbl: { fontSize: 13, fontWeight: '700' },
  resTotalRes: { fontSize: 13.5, fontWeight: '800', marginTop: 3 },
  gbSummary: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 12, marginBottom: 12 },
  gbSumCell: { flex: 1, alignItems: 'center' },
  gbSumVal: { fontSize: 19, fontWeight: '800' },
  gbSumLbl: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  gbSumDiv: { width: 1, height: 30 },
  gbWrap: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  gbHeadCell: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1 },
  gbHeadTxt: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  gbNameCell: { justifyContent: 'center', borderBottomWidth: 1, borderRightWidth: 1, paddingLeft: 12, paddingRight: 6 },
  gbName: { fontSize: 12.5, fontWeight: '700' },
  gbCell: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1 },
  gbMark: { fontSize: 13, fontWeight: '700' },
  gbAvg: { fontSize: 12.5, fontWeight: '800' },
  // fees
  feeRow: { padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  feeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  feeBtns: { flexDirection: 'row', gap: 6 },
  feeBtn: { flex: 1, borderWidth: 1, borderRadius: 9, paddingVertical: 7, alignItems: 'center' },
  feeBtnTxt: { fontSize: 11.5, fontWeight: '700' },
  // reason picker
  reasonOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  reasonSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  reasonTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },
  reasonChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reasonChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20 },
  reasonChipTxt: { fontSize: 13, fontWeight: '700' },
  reasonSkip: { textAlign: 'center', marginTop: 14, fontSize: 13, fontWeight: '600' },
  hPhone: { fontSize: 12, marginTop: 2 },
  fab: {
    position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
  },
  fabTxt: { color: '#fff', fontSize: 30, fontWeight: '300', marginTop: -2 },
});
