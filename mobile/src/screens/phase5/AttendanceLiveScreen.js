/* Xaadiris (Live) — Teacher/Admin marking interface. The roster is loaded by
   the database for the SELECTED historical date, then saved atomically with
   parent notifications. Student/Parent are routed to MyAttendanceScreen. */
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, Modal, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { SaveButton, SuccessNote, ErrorNote } from '../../components/Phase5Scaffold';
import { p4List } from '../../services/phase4';
import {
  attendanceRosterForDate, saveAttendanceSession, p5FriendlyError,
  listTimetablePeriods, getAttendanceSettings, saveAttendanceSettings,
  listAttendanceSessions, listAttendanceRecords, attendanceSummary,
} from '../../services/phase5';

const STATUSES = [
  { key: 'present', label: 'Jooga', tone: '#16A34A' },
  { key: 'absent', label: 'Maqan', tone: '#E5484D' },
  { key: 'late', label: 'Daahay', tone: '#CFAD5E' },
  { key: 'excused', label: 'Fasax', tone: '#2F6BF0' },
];
const isAdminRole = (r) => r === 'schooladmin' || r === 'superadmin';

export default function AttendanceLiveScreen() {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [classes, setClasses] = useState([]);
  const [streams, setStreams] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classLoading, setClassLoading] = useState(true);
  const [classErr, setClassErr] = useState(null);
  const [activeClass, setActiveClass] = useState(null);
  const [streamId, setStreamId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(null);
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyErr, setHistoryErr] = useState('');
  const [classSummary, setClassSummary] = useState(null);
  const [historySession, setHistorySession] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyDetailLoading, setHistoryDetailLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsErr, setSettingsErr] = useState('');
  const [settings, setSettings] = useState({ absence_notifications_enabled: true, notify_on_late: false, notify_on_excused: false, notification_delay_minutes: '0' });

  const loadClasses = useCallback(async () => {
    if (!isLive || !schoolId) { setClassLoading(false); return; }
    setClassLoading(true); setClassErr(null);
    try {
      const [cl, st, pe, su] = await Promise.all([
        p4List('classes', schoolId), p4List('class_streams', schoolId),
        listTimetablePeriods(schoolId), p4List('subjects', schoolId),
      ]);
      setClasses(cl); setStreams(st); setPeriods(pe.filter((p) => p.is_active !== false)); setSubjects(su);
    } catch (e) { setClassErr(p5FriendlyError(e)); }
    finally { setClassLoading(false); }
  }, [isLive, schoolId]);
  React.useEffect(() => { loadClasses(); }, [loadClasses]);
  React.useEffect(() => {
    setActiveClass(null); setStreamId(''); setPeriodId(''); setSubjectId('');
    setRoster([]); setMarks({}); setHistory([]); setClassSummary(null);
    setHistorySession(null); setHistoryRecords([]); setSuccess(''); setSaveErr(null);
  }, [schoolId]);

  const loadHistory = useCallback(async (cls = activeClass) => {
    if (!schoolId || !cls) { setHistory([]); setClassSummary(null); return; }
    setHistoryLoading(true); setHistoryErr('');
    try {
      const [summaryRow, sessions] = await Promise.all([
        attendanceSummary(schoolId, { classId: cls.id }),
        listAttendanceSessions(schoolId, { class_id: cls.id }),
      ]);
      setClassSummary(summaryRow || null);
      setHistory((sessions || []).slice(0, 12));
    } catch (e) { setHistoryErr(p5FriendlyError(e)); }
    finally { setHistoryLoading(false); }
  }, [activeClass, schoolId]);

  const openHistorySession = async (session) => {
    setHistorySession(session); setHistoryRecords([]); setHistoryDetailLoading(true);
    try { setHistoryRecords(await listAttendanceRecords(schoolId, { session_id: session.id })); }
    catch (e) { setHistoryErr(p5FriendlyError(e)); setHistorySession(null); }
    finally { setHistoryDetailLoading(false); }
  };

  const loadRoster = useCallback(async (cls = activeClass, selectedStream = streamId) => {
    setSuccess(''); setSaveErr(null); setRoster([]); setMarks({});
    if (!cls || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      if (cls) setSaveErr('Taariikhda ku qor qaabka YYYY-MM-DD.');
      return;
    }
    setRosterLoading(true);
    try {
      const list = await attendanceRosterForDate(schoolId, { classId: cls.id, date, streamId: selectedStream || null });
      setRoster(list || []);
      const init = {}; (list || []).forEach((s) => { init[s.student_id] = 'present'; });
      setMarks(init);
    } catch (e) { setSaveErr(p5FriendlyError(e)); }
    finally { setRosterLoading(false); }
  }, [activeClass, streamId, date, schoolId]);

  const chooseClass = async (cls) => {
    setActiveClass(cls); setStreamId(''); setPeriodId(''); setSubjectId('');
    setHistorySession(null); setHistoryRecords([]);
    await Promise.all([loadRoster(cls, ''), loadHistory(cls)]);
  };
  const chooseStream = async (id) => { setStreamId(id); await loadRoster(activeClass, id); };
  const setMark = (sid, status) => setMarks((m) => ({ ...m, [sid]: status }));

  const save = async () => {
    if (saving || !activeClass || roster.length === 0) return;
    setSaving(true); setSaveErr(null); setSuccess('');
    try {
      const records = roster.map((s) => ({ student_id: s.student_id, status: marks[s.student_id] || 'present' }));
      const res = await saveAttendanceSession(schoolId, {
        classId: activeClass.id, sessionDate: date, records,
        streamId: streamId || null, subjectId: subjectId || null, periodId: periodId || null,
        academicYearId: activeClass.academic_year_id || null,
      });
      const absent = records.filter((r) => r.status === 'absent').length;
      setSuccess(`Xaadiriska waa la kaydiyay. Maqan: ${absent}. Ogeysiisyo waalid: ${res.notifications_created || 0}.`);
      await loadHistory(activeClass);
    } catch (e) { setSaveErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };

  const openSettings = async () => {
    setSettingsOpen(true); setSettingsErr(''); setSettingsBusy(true);
    try {
      const row = await getAttendanceSettings(schoolId);
      if (row) setSettings({ ...row, notification_delay_minutes: String(row.notification_delay_minutes || 0) });
    } catch (e) { setSettingsErr(p5FriendlyError(e)); }
    finally { setSettingsBusy(false); }
  };
  const saveSettings = async () => {
    if (settingsBusy) return;
    const delay = Number(settings.notification_delay_minutes || 0);
    if (!Number.isInteger(delay) || delay < 0 || delay > 1440) { setSettingsErr('Dib-u-dhacu waa inuu u dhexeeyaa 0 iyo 1440 daqiiqo.'); return; }
    setSettingsBusy(true); setSettingsErr('');
    try {
      await saveAttendanceSettings({ school_id: schoolId, ...settings, notification_delay_minutes: delay });
      setSettingsOpen(false); setSuccess('Dejinta ogeysiiska waa la kaydiyay.');
    } catch (e) { setSettingsErr(p5FriendlyError(e)); }
    finally { setSettingsBusy(false); }
  };

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    roster.forEach((s) => { counts[marks[s.student_id] || 'present'] += 1; });
    return counts;
  }, [roster, marks]);
  const classStreams = streams.filter((s) => s.class_id === (activeClass && activeClass.id));

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}>
          <ScreenHeader title="Xaadiris" subtitle={activeClass ? activeClass.name : 'Dooro fasal'} />
          {isAdminRole(roleKey) ? (
            <TouchableOpacity onPress={openSettings} style={[styles.settingsBtn, { borderColor: c.line }]}><Icon name="settings" size={17} color={c.blue} /></TouchableOpacity>
          ) : null}
        </View>
        <SuperAdminSchoolBar />

        {!activeClass ? (
          classLoading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
          : classErr ? <StateError c={c} text={classErr} retry={loadClasses} />
          : classes.length === 0 ? <StateEmpty c={c} text="Weli fasal lama abuurin." />
          : <><Text style={[styles.lbl, { color: c.muted }]}>DOORO FASALKA</Text>{classes.map((cl) => (
            <TouchableOpacity key={cl.id} onPress={() => chooseClass(cl)} style={[styles.classRow, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Text style={[styles.className, { color: c.ink }]}>{cl.name}</Text><Icon name="chevronRight" size={16} color={c.muted2} />
            </TouchableOpacity>
          ))}</>
        ) : (
          <>
            <View style={styles.dateRow}>
              <TouchableOpacity onPress={() => { setActiveClass(null); setRoster([]); setHistory([]); setClassSummary(null); setHistorySession(null); setHistoryRecords([]); }} style={[styles.backBtn, { borderColor: c.line }]}><Icon name="back" size={16} color={c.ink} /></TouchableOpacity>
              <View style={[styles.dateBox, { backgroundColor: c.surface, borderColor: c.line }]}><Icon name="clock" size={15} color={c.muted} /><TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={c.muted2} style={[styles.dateInput, { color: c.ink }]} /></View>
              <TouchableOpacity onPress={() => loadRoster()} style={[styles.refreshBtn, { backgroundColor: c.blue }]}><Text style={styles.refreshTxt}>Soo rar</Text></TouchableOpacity>
            </View>

            {classStreams.length ? <PickerChips c={c} label="QAYBTA/STREAM-KA" options={[{ id: '', name: 'Fasalka oo dhan' }, ...classStreams]} value={streamId} onChange={chooseStream} /> : null}
            {periods.length ? <PickerChips c={c} label="XILLIGA" options={[{ id: '', name: 'Maalin dhan' }, ...periods]} value={periodId} onChange={setPeriodId} /> : null}
            {subjects.length ? <PickerChips c={c} label="MAADDADA (IKHTIYAARI)" options={[{ id: '', name: 'Lama cayimin' }, ...subjects]} value={subjectId} onChange={setSubjectId} /> : null}

            {rosterLoading ? <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
            : roster.length === 0 ? <StateEmpty c={c} text="Taariikhdan fasalkan arday diiwaangashan kuma jirin." />
            : <>
              <View style={styles.chips}>{STATUSES.map((s) => <View key={s.key} style={[styles.chip, { borderColor: c.line }]}><View style={[styles.chipDot, { backgroundColor: s.tone }]} /><Text style={[styles.chipTxt, { color: c.ink }]}>{s.label}: {summary[s.key]}</Text></View>)}</View>
              {roster.map((s) => (
                <View key={s.student_id} style={[styles.stuRow, { backgroundColor: c.surface, borderColor: c.line }]}>
                  <Text style={[styles.stuName, { color: c.ink }]} numberOfLines={1}>{s.full_name}</Text>
                  <View style={styles.seg}>{STATUSES.map((st) => {
                    const on = (marks[s.student_id] || 'present') === st.key;
                    return <TouchableOpacity key={st.key} onPress={() => setMark(s.student_id, st.key)} style={[styles.segBtn, { backgroundColor: on ? st.tone : 'transparent', borderColor: on ? st.tone : c.line }]}><Text style={[styles.segTxt, { color: on ? '#fff' : c.muted }]}>{st.label[0]}</Text></TouchableOpacity>;
                  })}</View>
                </View>
              ))}
              <ErrorNote text={saveErr} /><SuccessNote text={success} /><SaveButton onPress={save} saving={saving} label="Kaydi Xaadiriska" />
            </>}

            <View style={[styles.historyCard, { backgroundColor: c.surface, borderColor: c.line }]}>
              <View style={styles.historyHead}>
                <View><Text style={[styles.historyTitle, { color: c.ink }]}>Koobka iyo taariikhda fasalka</Text><Text style={[styles.historySub, { color: c.muted }]}>Xog dhab ah oo laga xisaabiyey xaadiriskii la kaydiyey</Text></View>
                <TouchableOpacity onPress={() => loadHistory(activeClass)} disabled={historyLoading}><Icon name="refresh" size={17} color={c.blue} /></TouchableOpacity>
              </View>
              {historyLoading ? <ActivityIndicator color={c.blue} style={{ marginVertical: 16 }} />
              : historyErr ? <StateError c={c} text={historyErr} retry={() => loadHistory(activeClass)} />
              : <>
                {classSummary && classSummary.total > 0 ? <View style={styles.summaryGrid}>
                  <SummaryStat c={c} label="Wadarta" value={classSummary.total} />
                  <SummaryStat c={c} label="Jooga" value={classSummary.present} />
                  <SummaryStat c={c} label="Maqan" value={classSummary.absent} />
                  <SummaryStat c={c} label="Daahay" value={classSummary.late} />
                  <SummaryStat c={c} label="Fasax" value={classSummary.excused} />
                  <SummaryStat c={c} label="Heerka joogitaanka" value={classSummary.present_rate == null ? '—' : `${classSummary.present_rate}%`} />
                </View> : <Text style={[styles.historySub, { color: c.muted }]}>Weli xaadiris kaydsan ma jiro.</Text>}
                {history.length ? <View style={styles.historyList}>{history.map((session) => (
                  <TouchableOpacity key={session.id} onPress={() => openHistorySession(session)} style={[styles.historyRow, { borderColor: c.line }]}>
                    <View style={{ flex: 1 }}><Text style={[styles.historyDate, { color: c.ink }]}>{session.session_date}</Text><Text style={[styles.historySub, { color: c.muted }]}>{session.status === 'submitted' ? 'La gudbiyey' : 'Furan'}{session.note ? ` · ${session.note}` : ''}</Text></View>
                    <Icon name="chevronRight" size={15} color={c.muted2} />
                  </TouchableOpacity>
                ))}</View> : null}
              </>}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!historySession} transparent animationType="fade" onRequestClose={() => { setHistorySession(null); setHistoryRecords([]); }}>
        <Pressable style={styles.overlay} onPress={() => { setHistorySession(null); setHistoryRecords([]); }}><Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
          <Text style={[styles.sheetTitle, { color: c.ink }]}>Xaadiriska {historySession && historySession.session_date}</Text>
          {historyDetailLoading ? <ActivityIndicator color={c.blue} /> : historyRecords.length === 0 ? <Text style={[styles.historySub, { color: c.muted }]}>Diiwaan arday lagama helin.</Text> :
            <ScrollView style={{ maxHeight: 430 }}>{historyRecords.map((record) => {
              const status = STATUSES.find((x) => x.key === record.status);
              return <View key={record.id} style={[styles.detailRow, { borderColor: c.line }]}><Text style={[styles.detailName, { color: c.ink }]}>{record.student && record.student.full_name ? record.student.full_name : 'Arday'}</Text><Text style={[styles.detailStatus, { color: status ? status.tone : c.muted }]}>{status ? status.label : record.status}</Text></View>;
            })}</ScrollView>}
          <TouchableOpacity onPress={() => { setHistorySession(null); setHistoryRecords([]); }} style={[styles.closeBtn, { backgroundColor: c.blue }]}><Text style={styles.closeTxt}>Xidh</Text></TouchableOpacity>
        </Pressable></Pressable>
      </Modal>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSettingsOpen(false)}><Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
          <Text style={[styles.sheetTitle, { color: c.ink }]}>Dejinta ogeysiiska xaadiriska</Text>
          {settingsBusy ? <ActivityIndicator color={c.blue} /> : <>
            <BooleanChoice c={c} label="Maqnaanshaha ogeysii waalidka" value={settings.absence_notifications_enabled} onChange={(v) => setSettings((x) => ({ ...x, absence_notifications_enabled: v }))} />
            <BooleanChoice c={c} label="Daahitaanka ogeysii" value={settings.notify_on_late} onChange={(v) => setSettings((x) => ({ ...x, notify_on_late: v }))} />
            <BooleanChoice c={c} label="Fasaxa ogeysii" value={settings.notify_on_excused} onChange={(v) => setSettings((x) => ({ ...x, notify_on_excused: v }))} />
            <Text style={[styles.lbl, { color: c.muted }]}>DIB-U-DHACA (DAQIIQO)</Text>
            <TextInput value={String(settings.notification_delay_minutes)} onChangeText={(v) => setSettings((x) => ({ ...x, notification_delay_minutes: v.replace(/\D/g, '') }))} keyboardType="numeric" style={[styles.settingsInput, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} />
            <ErrorNote text={settingsErr} /><SaveButton onPress={saveSettings} saving={settingsBusy} label="Kaydi Dejinta" />
          </>}
        </Pressable></Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PickerChips({ c, label, options, value, onChange }) { return <View style={{ marginBottom: 10 }}><Text style={[styles.lbl, { color: c.muted }]}>{label}</Text><View style={styles.pickRow}>{options.map((o) => { const id = o.id || ''; const on = value === id; return <TouchableOpacity key={id || 'all'} onPress={() => onChange(id)} style={[styles.pick, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blueSoft : c.surface }]}><Text style={[styles.pickTxt, { color: on ? c.blue : c.muted }]}>{o.name}</Text></TouchableOpacity>; })}</View></View>; }
function SummaryStat({ c, label, value }) { return <View style={[styles.summaryStat, { backgroundColor: c.bg, borderColor: c.line }]}><Text style={[styles.summaryValue, { color: c.ink }]}>{value}</Text><Text style={[styles.summaryLabel, { color: c.muted }]}>{label}</Text></View>; }
function BooleanChoice({ c, label, value, onChange }) { return <View style={styles.boolRow}><Text style={[styles.boolLabel, { color: c.ink }]}>{label}</Text><TouchableOpacity onPress={() => onChange(!value)} style={[styles.toggle, { backgroundColor: value ? c.blue : c.line }]}><View style={[styles.knob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} /></TouchableOpacity></View>; }
function StateError({ c, text, retry }) { return <View style={[styles.box, { backgroundColor: c.roseSoft }]}><Text style={[styles.boxSub, { color: c.rose }]}>{text}</Text><TouchableOpacity onPress={retry}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity></View>; }
function StateEmpty({ c, text }) { return <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}><Icon name="attendance" size={26} color={c.muted2} /><Text style={[styles.boxSub, { color: c.muted }]}>{text}</Text></View>; }

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, paddingBottom: 40 }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  settingsBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', paddingVertical: 40 }, box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 12 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 }, retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  lbl: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8, marginTop: 4 },
  classRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 9 }, className: { fontSize: 15, fontWeight: '800' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }, backBtn: { width: 40, height: 40, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dateBox: { flex: 1, height: 40, borderWidth: 1, borderRadius: 11, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 7 }, dateInput: { flex: 1, fontSize: 13.5, padding: 0 },
  refreshBtn: { borderRadius: 10, paddingVertical: 11, paddingHorizontal: 13 }, refreshTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, pick: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 11 }, pickTxt: { fontSize: 12, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 }, chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 9, paddingVertical: 6, paddingHorizontal: 9 }, chipDot: { width: 7, height: 7, borderRadius: 4 }, chipTxt: { fontSize: 11.5, fontWeight: '700' },
  stuRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 7 }, stuName: { flex: 1, fontSize: 13.5, fontWeight: '700' },
  seg: { flexDirection: 'row', gap: 4 }, segBtn: { width: 29, height: 29, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, segTxt: { fontSize: 11, fontWeight: '800' },
  historyCard: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 18 }, historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }, historyTitle: { fontSize: 14.5, fontWeight: '800' }, historySub: { fontSize: 11.5, lineHeight: 17, marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 12 }, summaryStat: { minWidth: 92, flexGrow: 1, borderWidth: 1, borderRadius: 10, padding: 9 }, summaryValue: { fontSize: 16, fontWeight: '900' }, summaryLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  historyList: { marginTop: 3 }, historyRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingVertical: 10 }, historyDate: { fontSize: 13, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, paddingVertical: 11 }, detailName: { flex: 1, fontSize: 13, fontWeight: '700', paddingRight: 10 }, detailStatus: { fontSize: 12, fontWeight: '900' }, closeBtn: { borderRadius: 10, alignItems: 'center', paddingVertical: 11, marginTop: 15 }, closeTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }, sheet: { width: '100%', maxWidth: 430, borderRadius: 20, padding: 20 }, sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 16 },
  boolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }, boolLabel: { flex: 1, fontSize: 13, fontWeight: '700', marginRight: 12 }, toggle: { width: 46, height: 26, borderRadius: 14, padding: 3 }, knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  settingsInput: { height: 44, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: 14, marginBottom: 12 },
});
