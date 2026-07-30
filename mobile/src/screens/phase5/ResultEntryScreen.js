/* Natiijo-gelin — schedule/date-valid roster, per-student score and
   present/absent/excused state. The server re-validates assignment and the
   student's historical enrollment for the selected sitting. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import {
  listExamSchedules, examRosterForSchedule, listResults,
  enterScheduledResult, p5FriendlyError,
} from '../../services/phase5';
const { canMarkAttendance } = require('../../domain/phase5Access');

const STATUSES = [
  { value: 'present', label: 'Joogay' },
  { value: 'absent', label: 'Maqnaa' },
  { value: 'excused', label: 'La fasaxay' },
];

export default function ResultEntryScreen({ navigation, route }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const exam = route?.params?.exam || null;

  const [schedules, setSchedules] = useState([]); const [scheduleId, setScheduleId] = useState('');
  const [roster, setRoster] = useState([]); const [loading, setLoading] = useState(true); const [loadErr, setLoadErr] = useState(null);
  const [scores, setScores] = useState({}); const [statuses, setStatuses] = useState({});
  const [savingId, setSavingId] = useState(null); const [savedIds, setSavedIds] = useState({}); const [rowErr, setRowErr] = useState({});
  const fullMarks = exam?.full_marks != null ? Number(exam.full_marks) : 100;

  const loadSchedules = useCallback(async () => {
    if (!isLive || !schoolId || !exam) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const list = await listExamSchedules(schoolId, { exam_id: exam.id });
      setSchedules(list);
      setScheduleId((current) => current && list.some((x) => x.id === current) ? current : (list[0]?.id || ''));
      if (!list.length) { setRoster([]); setLoadErr('Marka hore maamulka ha sameeyo jadwalka imtixaanka.'); }
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId, exam]);
  useEffect(() => { loadSchedules(); }, [loadSchedules]);
  useEffect(() => { setScheduleId(''); setRoster([]); setScores({}); setStatuses({}); setSavedIds({}); setRowErr({}); }, [schoolId, exam?.id]);

  const loadRoster = useCallback(async () => {
    if (!schoolId || !exam || !scheduleId) return;
    setLoading(true); setLoadErr(null);
    try {
      const [list, existing] = await Promise.all([
        examRosterForSchedule(schoolId, scheduleId),
        listResults(schoolId, { exam_id: exam.id }),
      ]);
      setRoster(list || []);
      const priorScores = {}; const priorSaved = {}; const priorStatuses = {};
      (existing || []).forEach((r) => {
        priorScores[r.student_id] = r.score == null ? '' : String(r.score);
        priorSaved[r.student_id] = { score: r.score, status: r.attendance_status || 'present' };
        priorStatuses[r.student_id] = r.attendance_status || 'present';
      });
      (list || []).forEach((st) => { if (!priorStatuses[st.student_id]) priorStatuses[st.student_id] = 'present'; });
      setScores(priorScores); setSavedIds(priorSaved); setStatuses(priorStatuses);
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [schoolId, exam, scheduleId]);
  useEffect(() => { if (scheduleId) loadRoster(); }, [scheduleId, loadRoster]);

  const saveOne = async (student) => {
    if (savingId) return;
    const sid = student.student_id;
    const attendanceStatus = statuses[sid] || 'present';
    const raw = (scores[sid] || '').trim();
    setRowErr((m) => ({ ...m, [sid]: null }));
    let val = 0;
    if (attendanceStatus === 'present') {
      if (raw === '') { setRowErr((m) => ({ ...m, [sid]: 'Geli dhibcaha.' })); return; }
      val = Number(raw);
      if (Number.isNaN(val)) { setRowErr((m) => ({ ...m, [sid]: 'Dhibcaha waa inuu lambar noqdaa.' })); return; }
      if (val < 0 || val > fullMarks) { setRowErr((m) => ({ ...m, [sid]: `Dhibcaha waa inuu u dhexeeyaa 0 – ${fullMarks}.` })); return; }
    }
    setSavingId(sid);
    try {
      await enterScheduledResult(schoolId, { scheduleId, studentId: sid, score: val, maxScore: fullMarks, attendanceStatus });
      setSavedIds((m) => ({ ...m, [sid]: { score: val, status: attendanceStatus } }));
      if (attendanceStatus !== 'present') setScores((m) => ({ ...m, [sid]: '0' }));
    } catch (e) { setRowErr((m) => ({ ...m, [sid]: p5FriendlyError(e) })); }
    finally { setSavingId(null); }
  };

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  if (isLive && !canMarkAttendance(roleKey)) return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]} edges={['top']}><View style={styles.content}><ScreenHeader title="Natiijo-gelin" subtitle="Ma lihid oggolaansho"/><State c={c} text="Kaliya macallinka ama maamulka ayaa natiijo gelin kara."/></View></SafeAreaView>;
  const back=()=>navigation?.goBack?.();
  const selected=schedules.find((x)=>x.id===scheduleId);

  return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]} edges={['top']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.headRow}><TouchableOpacity onPress={back} style={[styles.backBtn,{borderColor:c.line}]}><Icon name="back" size={16} color={c.ink}/></TouchableOpacity><View style={{flex:1}}><ScreenHeader title="Natiijo-gelin" subtitle={exam?.title||'Imtixaan'}/></View></View>
    {!exam?<State c={c} text="Imtixaan lama dooran."/>:<>
      {schedules.length?<View style={[styles.scheduleBox,{backgroundColor:c.surface,borderColor:c.line}]}><Text style={[styles.lbl,{color:c.muted}]}>DOORO FADHIGA IMTIXAANKA</Text><View style={styles.choiceRow}>{schedules.map((s)=><TouchableOpacity key={s.id} onPress={()=>setScheduleId(s.id)} style={[styles.choice,{borderColor:scheduleId===s.id?c.blue:c.line2,backgroundColor:scheduleId===s.id?c.blueSoft:c.surface}]}><Text style={[styles.choiceTxt,{color:scheduleId===s.id?c.blue:c.muted}]}>{s.exam_date}{s.stream_id?' · stream':''}</Text></TouchableOpacity>)}</View>{selected?<Text style={[styles.meta,{color:c.muted}]}>{[(selected.start_time||'').slice(0,5),(selected.end_time||'').slice(0,5)].filter(Boolean).join('–')}{selected.room?` · ${selected.room}`:''}</Text>:null}</View>:null}
      {loading?<View style={styles.state}><ActivityIndicator color={c.blue}/></View>:loadErr?<State c={c} text={loadErr} error onRetry={scheduleId?loadRoster:loadSchedules}/>:roster.length===0?<State c={c} text="Fadhigan imtixaanka arday sax ah lagama helin."/>:<>
        <Text style={[styles.hint,{color:c.muted}]}>Buuxa: {fullMarks} · {roster.length} arday · roster-ka taariikhda {selected?.exam_date}</Text>
        {roster.map((s)=>{const sid=s.student_id;const saved=savedIds[sid];const busy=savingId===sid;const st=statuses[sid]||'present';return <View key={sid} style={[styles.stuRow,{backgroundColor:c.surface,borderColor:c.line}]}>
          <View style={{flex:1,minWidth:0}}><Text style={[styles.stuName,{color:c.ink}]}>{s.full_name}</Text>{saved?<Text style={[styles.savedTxt,{color:c.green}]}>La kaydiyay: {saved.status==='present'?saved.score:STATUSES.find(x=>x.value===saved.status)?.label}</Text>:null}{rowErr[sid]?<Text style={[styles.errTxt,{color:c.rose}]}>{rowErr[sid]}</Text>:null}</View>
          <View style={styles.statusRow}>{STATUSES.map((o)=><TouchableOpacity key={o.value} onPress={()=>setStatuses((m)=>({...m,[sid]:o.value}))} style={[styles.statusChip,{borderColor:st===o.value?c.blue:c.line2,backgroundColor:st===o.value?c.blueSoft:c.surface}]}><Text style={[styles.statusTxt,{color:st===o.value?c.blue:c.muted}]}>{o.label}</Text></TouchableOpacity>)}</View>
          <TextInput value={scores[sid]||''} onChangeText={(t)=>setScores((m)=>({...m,[sid]:t}))} editable={st==='present'} placeholder={st==='present'?'0':'—'} placeholderTextColor={c.muted2} keyboardType="numeric" style={[styles.scoreInput,{backgroundColor:c.bg,borderColor:c.line2,color:c.ink,opacity:st==='present'?1:.5}]}/>
          <TouchableOpacity onPress={()=>saveOne(s)} disabled={busy} style={[styles.saveBtn,{backgroundColor:c.blue,opacity: busy ? 0.6 : 1}]}>{busy?<ActivityIndicator color="#fff" size="small"/>:<Text style={styles.saveTxt}>Kaydi</Text>}</TouchableOpacity>
        </View>})}
      </>}
    </>}
  </ScrollView></SafeAreaView>;
}
function State({c,text,error=false,onRetry}){return <View style={[styles.box,{backgroundColor:error?c.roseSoft:c.surface,borderColor:c.line}]}><Text style={[styles.boxSub,{color:error?c.rose:c.muted}]}>{text}</Text>{onRetry?<TouchableOpacity onPress={onRetry}><Text style={[styles.retry,{color:c.blue}]}>Isku day mar kale</Text></TouchableOpacity>:null}</View>}
const styles=StyleSheet.create({safe:{flex:1},content:{padding:16,paddingBottom:40},headRow:{flexDirection:'row',alignItems:'center',gap:10},backBtn:{width:40,height:40,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center'},state:{alignItems:'center',paddingVertical:40},box:{borderRadius:16,borderWidth:1,padding:22,alignItems:'center',gap:8,marginTop:12},boxSub:{fontSize:13,fontWeight:'600',textAlign:'center',lineHeight:19},retry:{fontSize:13,fontWeight:'800',marginTop:8},scheduleBox:{borderWidth:1,borderRadius:14,padding:12,marginBottom:12},lbl:{fontSize:11,fontWeight:'700',letterSpacing:.4,marginBottom:7},choiceRow:{flexDirection:'row',flexWrap:'wrap',gap:7},choice:{borderWidth:1.5,borderRadius:10,paddingVertical:8,paddingHorizontal:11},choiceTxt:{fontSize:12,fontWeight:'700'},meta:{fontSize:12,fontWeight:'600',marginTop:8},hint:{fontSize:12,fontWeight:'700',marginBottom:10},stuRow:{borderWidth:1,borderRadius:12,padding:11,marginBottom:8},stuName:{fontSize:13.5,fontWeight:'700'},savedTxt:{fontSize:11.5,fontWeight:'700',marginTop:2},errTxt:{fontSize:11.5,fontWeight:'700',marginTop:2},statusRow:{flexDirection:'row',flexWrap:'wrap',gap:5,marginTop:9},statusChip:{borderWidth:1,borderRadius:9,paddingVertical:6,paddingHorizontal:8},statusTxt:{fontSize:10.5,fontWeight:'800'},scoreInput:{height:42,borderWidth:1,borderRadius:10,paddingHorizontal:10,fontSize:14,textAlign:'center',marginTop:8},saveBtn:{height:42,borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:12,marginTop:8},saveTxt:{color:'#fff',fontSize:13,fontWeight:'800'}});
