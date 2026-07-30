/* ============================================================
   The 6 role dashboards. Each export renders the cards that the
   corresponding web-app role sees (from roles.js dashboardCards).
   They share StatCard / Card / Badge for a consistent look.
   ============================================================ */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import StatCard from '../../components/StatCard';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Donut from '../../components/Donut';
import Icon from '../../components/Icon';
import { PLATFORM, FINANCE, MESSAGES, NOTICES, SEVERITY } from '../../data/datasets';
import { useRole } from '../../context/RoleContext';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useSchools } from '../../context/SchoolContext';
import { useViewMode } from '../../context/ViewModeContext';
import { listSchools, listInvitations, getSchoolCounts } from '../../services/supabase';
import { onCanonicalChange } from '../../services/canonicalStore';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { p4Counts } from '../../services/phase4';
import { getTeacherPhase4Summary, getParentPhase4Children, getStudentPhase4Self } from '../../services/liveDashboard';
import { getParentChildren, getClassById } from '../../data/identity';
import {
  getIncidentsForStudent, filterIncidentsForProfile, filterPaymentsForProfile, selectResultsForProfile,
} from '../../utils/dataSelectors';

const cardTitleStyle = (c) => ({ fontSize: 15, fontWeight: '800', marginBottom: 14, color: c.ink });

/* ---- shared bits ---- */
function Section({ title, children, action }) {
  const { c } = useTheme();
  return (
    <>
      <View style={styles.sectionRow}>
        <View style={[styles.sectionBar, { backgroundColor: c.blue }]} />
        <Text style={[styles.section, { color: c.ink }]}>{title}</Text>
        {action ? <View style={{ marginLeft: 'auto' }}>{action}</View> : null}
      </View>
      {children}
    </>
  );
}

function Bars({ data, labels }) {
  const { c } = useTheme();
  const max = Math.max(...data);
  return (
    <View style={styles.bars}>
      {data.map((v, i) => (
        <View key={i} style={styles.barCol}>
          <View style={[styles.barTrack, { backgroundColor: c.line }]}>
            <View style={{ height: `${(v / max) * 100}%`, backgroundColor: c.blue, borderRadius: 6, width: '100%' }} />
          </View>
          <Text style={[styles.barLbl, { color: c.muted }]}>{labels[i]}</Text>
        </View>
      ))}
    </View>
  );
}

function ListRow({ left, right, sub, tone }) {
  const { c } = useTheme();
  return (
    <View style={[styles.lrow, { borderTopColor: c.line }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.lLeft, { color: c.ink }]} numberOfLines={1}>{left}</Text>
        {sub ? <Text style={[styles.lSub, { color: c.muted }]} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {tone ? <Badge label={right} tone={tone} /> : <Text style={[styles.lRight, { color: c.muted }]}>{right}</Text>}
    </View>
  );
}

const grid = (cards) => <View style={styles.grid}>{cards.map((p) => <StatCard key={p.label} {...p} />)}</View>;

/* ====================== SUPER ADMIN ====================== */
export function SuperAdminDash({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { active: activeSchool, needsSchoolSelection } = useSchools();

  // LIVE: real platform figures from Supabase (all zero on a fresh platform).
  const [live, setLive] = useState({ total: 0, active: 0, pending: 0, loaded: false, error: null });
  useEffect(() => {
    let alive = true;
    if (!isLive) { setLive({ total: 0, active: 0, pending: 0, loaded: false, error: null }); return undefined; }
    Promise.all([listSchools(), listInvitations()])
      .then(([rows, invitations]) => {
        if (!alive) return;
        const active = rows.filter((s) => s.status === 'active').length;
        const pending = invitations.filter((i) => i.status === 'pending').length;
        setLive({ total: rows.length, active, pending, loaded: true, error: null });
      })
      .catch((e) => { if (alive) setLive({ total: 0, active: 0, pending: 0, loaded: true, error: (e && e.message) || 'Dugsiyada lama soo dejin karin.' }); });
    return () => { alive = false; };
  }, [isLive]);

  const goRegister = () => navigation && navigation.navigate('SchoolOnboarding');
  // "Dooro Dugsi" first (Fasallada hosts the real school selector); once a
  // school is picked, straight into that school's management screens —
  // never a query with a placeholder school_id in between.
  const goManageSchool = () => navigation && navigation.navigate(needsSchoolSelection ? 'FasalladaStack' : 'Management');

  if (isLive || profile.live) {
    return (
      <>
        <TouchableOpacity style={[styles.cta, { backgroundColor: c.navy }]} onPress={goRegister} activeOpacity={0.9}>
          <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} />
          <Text style={styles.ctaTxt}>Register New School</Text>
        </TouchableOpacity>
        {/* Dooro Dugsi → Maamulka Dugsiga: the ONLY path into a school's data.
            Never runs a school-specific query before a real school is picked. */}
        <TouchableOpacity style={[styles.cta, { backgroundColor: c.blue, marginTop: 10 }]} onPress={goManageSchool} activeOpacity={0.9}>
          <Icon name="building" size={18} color="#fff" strokeWidth={2.2} />
          <Text style={styles.ctaTxt}>{activeSchool ? `Maamul ${activeSchool.name}` : 'Dooro Dugsi'}</Text>
        </TouchableOpacity>
        {grid([
          { label: 'Dugsiyada Guud', value: String(live.total), icon: 'building', tone: 'navy' },
          { label: 'Firfircoon', value: String(live.active), icon: 'building', tone: 'green' },
          { label: 'Casuumaad Sugaya', value: String(live.pending), icon: 'notice', tone: 'gold' },
          { label: 'Dugsi La Doortay', value: activeSchool ? 'Haa' : 'Maya', icon: 'check', tone: 'blue' },
        ])}
        <Section title="Dugsiyada" action={<Text style={{ color: c.blue, fontWeight: '800', fontSize: 12.5 }} onPress={goRegister}>Maaree →</Text>}>
          <Card>
            <Text style={{ color: live.error ? c.rose : c.muted, fontSize: 13.5, lineHeight: 20 }}>
              {live.error || (live.total === 0
                ? 'Weli dugsi lama abuurin. Riix "Register New School" si aad u abuurto midka koowaad oo aad casuumo maamulahiisa.'
                : `Waxaa jira ${live.total} dugsi. U gudub "Dugsiyada" si aad u aragto casuumaadaha & xaaladaha.`)}
            </Text>
          </Card>
        </Section>
      </>
    );
  }

  return (
    <>
      {/* the same entry point exists in demo so the onboarding path is visible */}
      <TouchableOpacity style={[styles.cta, { backgroundColor: c.navy }]} onPress={goRegister} activeOpacity={0.9}>
        <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} />
        <Text style={styles.ctaTxt}>Register New School</Text>
      </TouchableOpacity>
      {grid([
        { label: 'Dugsiyada Guud', value: String(PLATFORM.totalSchools), icon: 'building', tone: 'navy' },
        { label: 'Firfircoon', value: String(PLATFORM.activeSchools), icon: 'building', tone: 'green', delta: '+3' },
        { label: 'Codsiyo Sugaya', value: String(PLATFORM.pendingRequests), icon: 'notice', tone: 'gold' },
        { label: 'Dakhliga Bishan', value: '$' + PLATFORM.monthlyRevenue, icon: 'finance', tone: 'blue', delta: '+8%' },
      ])}
      <Card style={{ marginTop: 16 }}>
        <Text style={cardTitle()}>Dakhliga Platform-ka (USD)</Text>
        <Bars data={PLATFORM.revenueTrend} labels={PLATFORM.revenueLabels} />
      </Card>
      <Section title="Dhaqdhaqaaqa Dugsiyada">
        <Card padded={false}>
          {PLATFORM.recentActivity.map((a, i) => (
            <ListRow key={i} left={a[0]} sub={a[1]} right={a[2]} />
          ))}
        </Card>
      </Section>
    </>
  );
}

/* ====================== SCHOOL ADMIN ====================== */
export function SchoolAdminDash({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { data: appData } = useAppData();
  // wording follows the active mode: Fasallada (Primary) vs Formamka (Secondary)
  const { meta } = useViewMode();

  const goManage = () => navigation && navigation.navigate('Management');

  // LIVE: real per-school counts (all zero for a brand-new school → empty
  // states, never demo records). Each count is a live Supabase head query,
  // re-read whenever ANY screen persists through the canonical repository
  // so the dashboard tiles always reflect the same canonical records.
  const [counts, setCounts] = useState({ students: 0, classes: 0, teachers: 0, subjects: 0, loaded: false, error: null });
  useEffect(() => {
    let alive = true;
    if (!isLive || !profile.school_id) { setCounts({ students: 0, classes: 0, teachers: 0, subjects: 0, loaded: false, error: null }); return undefined; }
    const refresh = () => getSchoolCounts(profile.school_id)
      .then((x) => { if (alive) setCounts({ ...x, loaded: true, error: null }); })
      .catch((e) => { if (alive) setCounts({ students: 0, classes: 0, teachers: 0, subjects: 0, loaded: true, error: (e && e.message) || 'Tirooyinka dugsiga lama soo dejin karin.' }); });
    refresh();
    const unsub = onCanonicalChange(() => refresh());
    return () => { alive = false; unsub(); };
  }, [isLive, profile.school_id]);

  if (isLive || profile.live) {
    return (
      <>
        <TouchableOpacity style={[styles.cta, { backgroundColor: c.navy }]} onPress={goManage} activeOpacity={0.9}>
          <Icon name="building" size={18} color="#fff" strokeWidth={2.2} />
          <Text style={styles.ctaTxt}>Maamulka Dugsiga</Text>
        </TouchableOpacity>
        {grid([
          { label: 'Tirada Ardayda', value: String(counts.students), icon: 'students', tone: 'blue' },
          { label: meta.classLabelPlural, value: String(counts.classes), icon: 'classes', tone: 'green' },
          { label: 'Macalimiin', value: String(counts.teachers), icon: 'teachers', tone: 'gold' },
          { label: 'Maaddooyin', value: String(counts.subjects || 0), icon: 'lessons', tone: 'navy' },
        ])}
        <Section title="Bilaw Dugsigaaga">
          <Card>
            <Text style={{ color: counts.error ? c.rose : c.muted, fontSize: 13.5, lineHeight: 20 }}>
              {counts.error || 'Ku soo dhawoow! Dugsigaagu wuu bilaabmayaa madhan. Riix "Maamulka Dugsiga" si aad ugu darto sannad-dugsiyeedka, fasallada, macallimiinta iyo ardayda — xogtaada dhabta ah ayaa halkan ka muuqan doonta.'}
            </Text>
          </Card>
        </Section>
      </>
    );
  }

  // DEMO: school-scoped students + recent incidents from the AsyncStorage store
  const students = (appData.students || []).filter((s) => s.school_id === profile.school_id);
  const classCount = new Set(students.map((s) => s.class_id).filter(Boolean)).size;
  const incidents = filterIncidentsForProfile(profile, appData.incidents);
  return (
    <>
      {grid([
        { label: 'Tirada Ardayda', value: String(students.length), icon: 'students', tone: 'blue' },
        { label: meta.classLabelPlural, value: String(classCount), icon: 'classes', tone: 'green' },
        { label: 'Macalimiin', value: '24', icon: 'teachers', tone: 'gold', delta: '+2' },
        { label: 'Lacag La Uruuriyay', value: '$4,820', icon: 'finance', tone: 'navy', delta: '+8%' },
      ])}
      <Section title="Kiisaska Dhowaan">
        <Card padded={false}>
          {incidents.slice(0, 4).map((it, i) => (
            <ListRow key={i} left={it[0]} sub={`${it[1]} · ${it[2]}`} right={SEVERITY[it[3]].label} tone={SEVERITY[it[3]].tone} />
          ))}
        </Card>
      </Section>
    </>
  );
}

/* ============== SCHOOL ADMIN · UNIVERSITY MODE ==============
   Fully isolated University dashboard: it only ever shows University wording
   (Kulliyado / Koorsooyin / Muxaadiriin) — never a School Mode term
   (Fasal / Form / Waalid), mirroring UNIVERSITY_ONLY_TERMS /
   SCHOOL_ONLY_TERMS in config/navigationByInstitutionType.js. */
export function UniversityAdminDash() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const [counts, setCounts] = useState({ university_students: 0, faculties: 0, courses: 0, lecturers: 0, loaded: false, error: null });
  useEffect(() => {
    let alive = true;
    if (!isLive || !schoolId) { setCounts({ university_students: 0, faculties: 0, courses: 0, lecturers: 0, loaded: false, error: null }); return undefined; }
    const refresh = () => p4Counts(schoolId, ['university_students', 'faculties', 'courses', 'lecturers'])
      .then((x) => { if (alive) setCounts({ ...x, loaded: true, error: null }); })
      .catch((e) => { if (alive) setCounts({ university_students: 0, faculties: 0, courses: 0, lecturers: 0, loaded: true, error: (e && e.message) || 'Tirooyinka jaamacadda lama soo dejin karin.' }); });
    refresh();
    const unsub = onCanonicalChange(refresh);
    return () => { alive = false; unsub(); };
  }, [isLive, schoolId]);

  if (isLive) {
    return (
      <>
        {grid([
          { label: 'Ardayda', value: String(counts.university_students || 0), icon: 'students', tone: 'blue' },
          { label: 'Kulliyado', value: String(counts.faculties || 0), icon: 'building', tone: 'green' },
          { label: 'Koorsooyin', value: String(counts.courses || 0), icon: 'lessons', tone: 'gold' },
          { label: 'Muxaadiriin', value: String(counts.lecturers || 0), icon: 'teachers', tone: 'navy' },
        ])}
        <Section title="Xogta Jaamacadda">
          <Card><Text style={{ color: counts.error ? c.rose : c.muted, fontSize: 13.5, lineHeight: 20 }}>{counts.error || (counts.loaded ? 'Tirooyinkani waxay si toos ah uga yimaadaan Supabase. Weli xog aan la diiwaangelin waxaa lagu muujinayaa eber.' : 'Xogta waa la soo dejinayaa…')}</Text></Card>
        </Section>
      </>
    );
  }
  const FACULTIES = [
    ['Kulliyadda Caafimaadka', 'Faculty of Health', '320 arday'],
    ['Kulliyadda Injineerinka', 'Faculty of Engineering', '280 arday'],
    ['Kulliyadda Ganacsiga', 'Faculty of Business', '240 arday'],
    ['Kulliyadda Sharciga', 'Faculty of Law', '160 arday'],
  ];
  return (
    <>
      {grid([
        { label: 'Ardayda', value: '1,240', icon: 'students', tone: 'blue' },
        { label: 'Kulliyado', value: '6', icon: 'building', tone: 'green' },
        { label: 'Koorsooyin', value: '84', icon: 'lessons', tone: 'gold' },
        { label: 'Muxaadiriin', value: '96', icon: 'teachers', tone: 'navy' },
      ])}
      <Section title="Kulliyadaha"><Card padded={false}>{FACULTIES.map((f, i) => <ListRow key={i} left={f[0]} sub={f[1]} right={f[2]} />)}</Card></Section>
    </>
  );
}

/* ====================== TEACHER ====================== */
export function TeacherDash() {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const { data: appData } = useAppData();
  const [live, setLive] = useState({ classes: 0, subjects: 0, assignments: 0, lessons: 0, loaded: false, error: null });
  useEffect(() => {
    let alive = true;
    if (!isLive || !schoolId || !profile.profile_id) { setLive({ classes: 0, subjects: 0, assignments: 0, lessons: 0, loaded: false, error: null }); return undefined; }
    const refresh = () => getTeacherPhase4Summary(profile.profile_id, schoolId)
      .then((x) => { if (alive) setLive({ ...x, loaded: true, error: null }); })
      .catch((e) => { if (alive) setLive((p) => ({ ...p, loaded: true, error: e.message || 'Xogta lama soo dejin.' })); });
    refresh();
    const unsub = onCanonicalChange(refresh);
    return () => { alive = false; unsub(); };
  }, [isLive, schoolId, profile.profile_id]);
  if (isLive) {
    return (
      <>
        {grid([
          { label: 'Fasalladayda', value: String(live.classes), icon: 'classes', tone: 'blue' },
          { label: 'Maaddooyinkayga', value: String(live.subjects), icon: 'lessons', tone: 'green' },
          { label: 'Qoondayn', value: String(live.assignments), icon: 'teachers', tone: 'gold' },
          { label: 'Casharradayda', value: String(live.lessons), icon: 'lessons', tone: 'navy' },
        ])}
        <Section title="Xogta Macallinka"><Card><Text style={{ color: live.error ? c.rose : c.muted, fontSize: 13.5, lineHeight: 20 }}>{live.error || (live.loaded ? 'Waxaad aragtaa oo keliya fasallada, maaddooyinka iyo casharrada laguu xilsaaray.' : 'Xogta waa la soo dejinayaa…')}</Text></Card></Section>
      </>
    );
  }
  const incidents = filterIncidentsForProfile(profile, appData.incidents);
  const myStudents = (appData.students || []).filter((row) => (profile.assigned_class_ids || []).includes(row.class_id));
  return (
    <>
      {grid([
        { label: 'Fasalladayda', value: String((profile.assigned_class_ids || []).length), icon: 'classes', tone: 'blue' },
        { label: 'Ardaydayda', value: String(myStudents.length), icon: 'students', tone: 'gold' },
        { label: 'Maaddooyin', value: String((profile.assigned_subject_ids || []).length), icon: 'lessons', tone: 'green' },
        { label: 'Casharro', value: '5', icon: 'lessons', tone: 'navy' },
      ])}
      <Section title="Ardayda u baahan feejignaan"><Card padded={false}>{incidents.slice(0, 4).map((it, i) => <ListRow key={i} left={it[0]} sub={it[2]} right={SEVERITY[it[3]].label} tone={SEVERITY[it[3]].tone} />)}</Card></Section>
    </>
  );
}

/* ====================== ACCOUNTANT ====================== */
export function AccountantDash() {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { data: appData } = useAppData();
  if (isLive) {
    return (
      <Section title="Maaliyadda">
        <Card><Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 20 }}>Qaybta Maaliyadda waxay bilaabmaysaa Phase 5. Xog demo ama tirooyin aan Supabase ka iman halkan laguma muujinayo.</Text></Card>
      </Section>
    );
  }
  const payments = filterPaymentsForProfile(profile, appData.payments);
  const collectedPct = Math.round((FINANCE.collected / FINANCE.expected) * 100);
  return (
    <>
      {grid([
        { label: 'La Filayo', value: '$' + FINANCE.expected, icon: 'finance', tone: 'navy' },
        { label: 'La Uruuriyay', value: '$' + FINANCE.collected, icon: 'finance', tone: 'green', delta: collectedPct + '%' },
        { label: 'Hadhay', value: '$' + FINANCE.remaining, icon: 'finance', tone: 'gold' },
        { label: 'Ardayda Bixiyey', value: '6 / 9', icon: 'students', tone: 'blue' },
      ])}
      <Card style={{ marginTop: 16, alignItems: 'center' }}><Text style={[cardTitleStyle(c), { alignSelf: 'flex-start' }]}>Heerka Uruurinta Lacagta</Text><Donut percent={collectedPct} color={c.green} label="La uruuriyay" sub={'$' + FINANCE.collected + ' / $' + FINANCE.expected} /></Card>
      <Section title="Lacagaha Dhowaan"><Card padded={false}>{payments.slice(0, 5).map((row, i) => <ListRow key={i} left={row[0]} sub={`${row[1]} · ${row[3]}`} right={row[2]} />)}</Card></Section>
    </>
  );
}

/* ====================== PARENT ====================== */
const FEE_LABEL = { full: 'La bixiyay', partial: 'Qayb ahaan', due: 'Ma bixin', exempt: 'Bilaash' };
export function ParentDash() {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const { data: appData } = useAppData();
  const [liveChildren, setLiveChildren] = useState([]);
  const [liveState, setLiveState] = useState({ loaded: false, error: null });
  const [child, setChild] = useState(0);
  useEffect(() => {
    let alive = true;
    if (!isLive || !schoolId || !profile.profile_id) { setLiveChildren([]); setLiveState({ loaded: false, error: null }); setChild(0); return undefined; }
    setLiveChildren([]); setLiveState({ loaded: false, error: null }); setChild(0);
    getParentPhase4Children(profile.profile_id, schoolId)
      .then((rows) => { if (alive) { setLiveChildren(rows); setLiveState({ loaded: true, error: null }); setChild(0); } })
      .catch((e) => { if (alive) setLiveState({ loaded: true, error: e.message || 'Xogta carruurta lama soo dejin.' }); });
    return () => { alive = false; };
  }, [isLive, schoolId, profile.profile_id]);
  if (isLive) {
    const kid = liveChildren[child] || null;
    return (
      <>
        <View style={[styles.sectionRow, { marginTop: 0 }]}><View style={[styles.sectionBar, { backgroundColor: c.blue }]} /><Text style={[styles.section, { color: c.ink }]}>Caruurtayda</Text></View>
        {liveChildren.length ? <View style={styles.childBar}>{liveChildren.map((row, i) => {
          const on = i === child;
          return <TouchableOpacity key={row.id} onPress={() => setChild(i)} style={[styles.childCard, { backgroundColor: on ? c.navy : c.surface, borderColor: on ? c.navy : c.line }]}><View style={[styles.childAv, { backgroundColor: on ? 'rgba(255,255,255,.2)' : c.blueSoft }]}><Text style={[styles.childAvTxt, { color: on ? '#fff' : c.navy }]}>{(row.name || 'A')[0]}</Text></View><Text style={[styles.childName, { color: on ? '#fff' : c.ink }]}>{row.name}</Text><Text style={[styles.childCls, { color: on ? 'rgba(255,255,255,.7)' : c.muted }]}>{row.className}</Text></TouchableOpacity>;
        })}</View> : <Card><Text style={{ color: liveState.error ? c.rose : c.muted, fontSize: 13.5, lineHeight: 20 }}>{liveState.error || (liveState.loaded ? 'Weli arday laguguma xidhin.' : 'Xogta waa la soo dejinayaa…')}</Text></Card>}
        {kid ? grid([
          { label: 'Magaca', value: kid.name, icon: 'students', tone: 'blue' },
          { label: 'Fasalka', value: kid.className, icon: 'classes', tone: 'green' },
          { label: 'Lambarka Ardayga', value: kid.studentId || '—', icon: 'note', tone: 'navy' },
        ]) : null}
        <Section title="Phase 1–4"><Card><Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 20 }}>Xaadiris, lacag, imtixaan iyo natiijooyin waxay bilaabmayaan Phase 5; halkan xog demo laguma muujinayo.</Text></Card></Section>
      </>
    );
  }
  const children = getParentChildren(profile).map((row) => ({ student_internal_id: row.student_internal_id, name: (row.full_name || '').split(' ')[0], cls: (getClassById(row.class_id) || {}).name || '—', att: (row.att != null ? row.att : 90) + '%', fee: FEE_LABEL[row.fee] || 'La bixiyay', result: (60 + ((row.att || 70) % 35)) + '%' }));
  const kid = children[child] || children[0] || { name: '—', cls: '—', att: '—', fee: '—', result: '—', student_internal_id: null };
  return (<>{grid([{ label: 'Fasalka', value: kid.cls, icon: 'classes', tone: 'blue' }, { label: 'Xaadiris Maanta', value: kid.att, icon: 'attendance', tone: 'green' }, { label: 'Lacagta', value: kid.fee, icon: 'finance', tone: 'navy' }, { label: 'Celcelis Natiijo', value: kid.result, icon: 'exams', tone: 'gold' }])}<Section title={`Warbixinta ${kid.name}`}><Card padded={false}>{getIncidentsForStudent(kid.student_internal_id, profile, appData.incidents).map((it, i) => <ListRow key={i} left={it[2]} sub={it[12] || it[1]} right={SEVERITY[it[3]].label} tone={SEVERITY[it[3]].tone} />)}{NOTICES.map((n, i) => <ListRow key={'n' + i} left={n[0]} sub={n[1]} right={n[3]} />)}</Card></Section></>);
}

/* ====================== STUDENT ====================== */
export function StudentDash() {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const { data: appData } = useAppData();
  const [self, setSelf] = useState(null);
  const [liveState, setLiveState] = useState({ loaded: false, error: null });
  useEffect(() => {
    let alive = true;
    if (!isLive || !schoolId || !profile.profile_id) { setSelf(null); setLiveState({ loaded: false, error: null }); return undefined; }
    setSelf(null); setLiveState({ loaded: false, error: null });
    getStudentPhase4Self(profile.profile_id, schoolId)
      .then((row) => { if (alive) { setSelf(row); setLiveState({ loaded: true, error: null }); } })
      .catch((e) => { if (alive) setLiveState({ loaded: true, error: e.message || 'Xogta ardayga lama soo dejin.' }); });
    return () => { alive = false; };
  }, [isLive, schoolId, profile.profile_id]);
  if (isLive) {
    return (
      <>
        {grid([
          { label: 'Magacayga', value: self ? self.name : '—', icon: 'students', tone: 'blue' },
          { label: 'Fasalkayga', value: self ? self.className : '—', icon: 'classes', tone: 'green' },
          { label: 'Lambarkayga', value: self ? self.studentId : '—', icon: 'note', tone: 'navy' },
        ])}
        <Section title="Xogtayda"><Card><Text style={{ color: liveState.error ? c.rose : c.muted, fontSize: 13.5, lineHeight: 20 }}>{liveState.error || (!liveState.loaded ? 'Xogta waa la soo dejinayaa…' : self ? 'Xogtan waxay si toos ah uga timid Supabase.' : 'Akoonkaaga weli lama xiriirin diiwaanka ardayga.')}</Text></Card></Section>
        <Section title="Phase 1–4"><Card><Text style={{ color: c.muted, fontSize: 13.5, lineHeight: 20 }}>Xaadiris, lacag, imtixaan iyo natiijooyin waxay bilaabmayaan Phase 5; xog demo halkan laguma muujinayo.</Text></Card></Section>
      </>
    );
  }
  const results = selectResultsForProfile(profile, appData.results);
  const subjName = (id) => ((appData.subjects || []).find((row) => row.subject_id === id) || {}).name || id;
  const myAvg = results.length ? Math.round(results.reduce((a, row) => a + (row.percentage || 0), 0) / results.length) : 0;
  const myClass = (getClassById(profile.class_id) || {}).name || '—';
  return (<>{grid([{ label: 'Fasalkayga', value: myClass, icon: 'classes', tone: 'blue' }, { label: 'Xaadirintayda', value: '92%', icon: 'attendance', tone: 'green' }, { label: 'Celcelis Natiijo', value: (myAvg || 76) + '%', icon: 'exams', tone: 'gold' }, { label: 'Lacagta', value: 'La bixiyay', icon: 'finance', tone: 'navy' }])}<Section title="Natiijooyinkayga (Term 2)"><Card padded={false}>{results.map((row, i) => <ListRow key={i} left={subjName(row.subject_id)} sub="Natiijo" right={(row.percentage || 0) + '%'} tone={(row.percentage || 0) >= 50 ? 'green' : 'rose'} />)}</Card></Section></>);
}

function cardTitle() {
  return { fontSize: 15, fontWeight: '800', marginBottom: 14, color: '#0F1B2D' };
}

export const DASH_BY_ROLE = {
  superadmin: SuperAdminDash,
  schooladmin: SchoolAdminDash,
  teacher: TeacherDash,
  accountant: AccountantDash,
  parent: ParentDash,
  student: StudentDash,
};

const styles = StyleSheet.create({
  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, marginTop: 16 },
  ctaTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22, marginBottom: 12 },
  sectionBar: { width: 4, height: 18, borderRadius: 3 },
  section: { fontSize: 16, fontWeight: '800' },
  childBar: { flexDirection: 'row', gap: 12 },
  childCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  childAv: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  childAvTxt: { fontSize: 18, fontWeight: '800' },
  childName: { fontSize: 15, fontWeight: '800' },
  childCls: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 8 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barTrack: { width: '70%', height: '82%', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barLbl: { fontSize: 10.5, fontWeight: '600', marginTop: 6 },
  lrow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: 1 },
  lLeft: { fontSize: 13.5, fontWeight: '700' },
  lSub: { fontSize: 12, marginTop: 2 },
  lRight: { fontSize: 12, fontWeight: '600' },
});
