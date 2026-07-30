/* Jadwalka imtixaanka — real create/edit schedule with year, term, stream,
   date/time/room and publication state. Admin writes; other roles read only
   through RLS. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from '../../components/SchoolSelector';
import ScreenHeader from '../../components/ScreenHeader';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import { listExamSchedules, createExamSchedule, updateExamSchedule, p5FriendlyError } from '../../services/phase5';
const { canCreateModule } = require('../../domain/phase5Access');

export default function ExamScheduleScreen({ navigation, route }) {
  const { c } = useTheme();
  const { isLive, roleKey } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const exam = route?.params?.exam || null;
  const isAdmin = canCreateModule(roleKey, undefined);

  const [rows, setRows] = useState([]);
  const [years, setYears] = useState([]); const [terms, setTerms] = useState([]); const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true); const [loadErr, setLoadErr] = useState(null);
  const [editing, setEditing] = useState(null);
  const [yearId, setYearId] = useState(''); const [termId, setTermId] = useState(exam?.term_id || ''); const [streamId, setStreamId] = useState('');
  const [date, setDate] = useState(''); const [startT, setStartT] = useState(''); const [endT, setEndT] = useState(''); const [room, setRoom] = useState('');
  const [status, setStatus] = useState('draft'); const [saving, setSaving] = useState(false); const [formErr, setFormErr] = useState(null); const [success, setSuccess] = useState('');

  const reset = () => { setEditing(null); setYearId(''); setTermId(exam?.term_id || ''); setStreamId(''); setDate(''); setStartT(''); setEndT(''); setRoom(''); setStatus('draft'); setFormErr(null); };
  const edit = (r) => { setEditing(r); setYearId(r.academic_year_id || ''); setTermId(r.term_id || ''); setStreamId(r.stream_id || ''); setDate(r.exam_date || ''); setStartT((r.start_time || '').slice(0,5)); setEndT((r.end_time || '').slice(0,5)); setRoom(r.room || ''); setStatus(r.status || 'draft'); setFormErr(null); setSuccess(''); };

  const load = useCallback(async () => {
    if (!isLive || !schoolId || !exam) { setLoading(false); return; }
    setLoading(true); setLoadErr(null);
    try {
      const [r, y, t, st] = await Promise.all([
        listExamSchedules(schoolId, { exam_id: exam.id }), p4List('academic_years', schoolId), p4List('terms', schoolId), p4List('class_streams', schoolId),
      ]);
      setRows(r); setYears(y); setTerms(t); setStreams(st.filter((x) => x.class_id === exam.class_id));
    } catch (e) { setLoadErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId, exam]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { reset(); }, [schoolId, exam?.id]);

  const save = async () => {
    if (saving) return;
    setFormErr(null); setSuccess('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) { setFormErr('Taariikhda: qaabka waa YYYY-MM-DD.'); return; }
    if (startT.trim() && !/^\d{2}:\d{2}$/.test(startT.trim())) { setFormErr('Bilowga: qaabka waa HH:MM.'); return; }
    if (endT.trim() && !/^\d{2}:\d{2}$/.test(endT.trim())) { setFormErr('Dhammaadka: qaabka waa HH:MM.'); return; }
    if (startT && endT && startT >= endT) { setFormErr('Waqtiga dhammaadku waa inuu ka dambeeyaa bilowga.'); return; }
    if (termId && yearId) {
      const term = terms.find((t) => t.id === termId);
      if (term?.academic_year_id && term.academic_year_id !== yearId) { setFormErr('Term-ku kama tirsana sanad-dugsiyeedka la doortay.'); return; }
    }
    setSaving(true);
    try {
      const row = {
        school_id: schoolId, exam_id: exam.id, class_id: exam.class_id, stream_id: streamId || null,
        subject_id: exam.subject_id, teacher_id: exam.teacher_id || null, academic_year_id: yearId || null,
        term_id: termId || exam.term_id || null, exam_date: date.trim(), start_time: startT.trim() || null,
        end_time: endT.trim() || null, room: room.trim() || null, status,
      };
      if (editing) await updateExamSchedule(editing.id, row); else await createExamSchedule(row);
      setSuccess(editing ? 'Jadwalka waa la cusboonaysiiyay.' : 'Waa la qorsheeyay.'); reset(); await load();
    } catch (e) { setFormErr(p5FriendlyError(e)); }
    finally { setSaving(false); }
  };

  if (isLive && roleKey === 'superadmin' && needsSchoolSelection) return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  const back = () => navigation?.goBack?.();

  return <SafeAreaView style={[styles.safe,{backgroundColor:c.bg}]} edges={['top']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.headRow}><TouchableOpacity onPress={back} style={[styles.backBtn,{borderColor:c.line}]}><Icon name="back" size={16} color={c.ink}/></TouchableOpacity><View style={{flex:1}}><ScreenHeader title="Jadwalka imtixaanka" subtitle={exam?.title || 'Imtixaan'}/></View></View>
    {!exam ? <State c={c} text="Imtixaan lama dooran."/> : <>
      {isAdmin ? <View style={[styles.form,{backgroundColor:c.surface,borderColor:c.line}]}>
        <Text style={[styles.formTitle,{color:c.ink}]}>{editing ? 'Wax ka beddel jadwalka' : 'Ku dar jadwal'}</Text>
        <Text style={[styles.lbl,{color:c.muted}]}>SANAD-DUGSIYEEDKA</Text><Choices rows={years} value={yearId} setValue={setYearId} c={c}/>
        <Text style={[styles.lbl,{color:c.muted}]}>TERM-KA</Text><Choices rows={terms.filter((t)=>!yearId||!t.academic_year_id||t.academic_year_id===yearId)} value={termId} setValue={setTermId} c={c}/>
        {streams.length ? <><Text style={[styles.lbl,{color:c.muted}]}>STREAM / QAYBTA</Text><Choices rows={streams} value={streamId} setValue={setStreamId} c={c} allowClear/></> : null}
        <Text style={[styles.lbl,{color:c.muted}]}>TAARIIKHDA *</Text><TextInput value={date} onChangeText={setDate} placeholder="2026-11-01" placeholderTextColor={c.muted2} style={[styles.input,{backgroundColor:c.bg,borderColor:c.line2,color:c.ink}]}/>
        <View style={styles.timeRow}><View style={{flex:1}}><Text style={[styles.lbl,{color:c.muted}]}>BILOW</Text><TextInput value={startT} onChangeText={setStartT} placeholder="08:00" placeholderTextColor={c.muted2} style={[styles.input,{backgroundColor:c.bg,borderColor:c.line2,color:c.ink}]}/></View><View style={{flex:1}}><Text style={[styles.lbl,{color:c.muted}]}>DHAMMAAD</Text><TextInput value={endT} onChangeText={setEndT} placeholder="10:00" placeholderTextColor={c.muted2} style={[styles.input,{backgroundColor:c.bg,borderColor:c.line2,color:c.ink}]}/></View></View>
        <Text style={[styles.lbl,{color:c.muted}]}>QOLKA</Text><TextInput value={room} onChangeText={setRoom} placeholder="ikhtiyaari" placeholderTextColor={c.muted2} style={[styles.input,{backgroundColor:c.bg,borderColor:c.line2,color:c.ink}]}/>
        <Text style={[styles.lbl,{color:c.muted}]}>XAALADDA</Text><Choices rows={[{id:'draft',name:'Qabyo'},{id:'published',name:'La daabacay'}]} value={status} setValue={setStatus} c={c}/>
        {formErr ? <Text style={[styles.err,{color:c.rose}]}>{formErr}</Text> : null}{success ? <Text style={[styles.okTxt,{color:c.green}]}>{success}</Text> : null}
        <View style={styles.btnRow}><TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn,{backgroundColor:c.blue,opacity: saving ? 0.7 : 1}]}>{saving?<ActivityIndicator color="#fff"/>:<Text style={styles.saveTxt}>{editing?'Cusboonaysii':'Ku dar jadwal'}</Text>}</TouchableOpacity>{editing?<TouchableOpacity onPress={reset} style={[styles.cancelBtn,{borderColor:c.line}]}><Text style={[styles.cancelTxt,{color:c.muted}]}>Jooji</Text></TouchableOpacity>:null}</View>
      </View> : <Text style={[styles.readonly,{color:c.muted}]}>Jadwalka la daabacay oo keliya ayaad arki kartaa.</Text>}
      {loading?<View style={styles.state}><ActivityIndicator color={c.blue}/></View>:loadErr?<State c={c} text={loadErr} error onRetry={load}/>:rows.length===0?<State c={c} text="Weli jadwal lama dhigin."/>:<View style={[styles.list,{backgroundColor:c.surface,borderColor:c.line}]}>{rows.map((r,i)=><View key={r.id} style={[styles.row,{borderTopColor:c.line,borderTopWidth:i?1:0}]}><View style={{flex:1}}><Text style={[styles.rowTitle,{color:c.ink}]}>{r.exam_date} · {r.status}</Text><Text style={[styles.rowSub,{color:c.muted}]}>{[(r.start_time||'').slice(0,5),(r.end_time||'').slice(0,5)].filter(Boolean).join('–')||'—'}{r.room?' · '+r.room:''}</Text></View>{isAdmin?<TouchableOpacity onPress={()=>edit(r)} style={[styles.editBtn,{borderColor:c.line}]}><Text style={[styles.editTxt,{color:c.blue}]}>Wax ka beddel</Text></TouchableOpacity>:null}</View>)}</View>}
    </>}
  </ScrollView></SafeAreaView>;
}

function Choices({rows,value,setValue,c,allowClear=false}){return <View style={styles.choiceRow}>{allowClear?<TouchableOpacity onPress={()=>setValue('')} style={[styles.choice,{borderColor:!value?c.blue:c.line2,backgroundColor:!value?c.blueSoft:c.surface}]}><Text style={[styles.choiceTxt,{color:!value?c.blue:c.muted}]}>Dhammaan</Text></TouchableOpacity>:null}{rows.map(r=><TouchableOpacity key={r.id} onPress={()=>setValue(r.id)} style={[styles.choice,{borderColor:value===r.id?c.blue:c.line2,backgroundColor:value===r.id?c.blueSoft:c.surface}]}><Text style={[styles.choiceTxt,{color:value===r.id?c.blue:c.muted}]}>{r.name||r.title||r.id}</Text></TouchableOpacity>)}</View>}
function State({c,text,error=false,onRetry}){return <View style={[styles.box,{backgroundColor:error?c.roseSoft:c.surface,borderColor:c.line}]}><Text style={[styles.boxSub,{color:error?c.rose:c.muted}]}>{text}</Text>{onRetry?<TouchableOpacity onPress={onRetry}><Text style={[styles.retry,{color:c.blue}]}>Isku day mar kale</Text></TouchableOpacity>:null}</View>}
const styles=StyleSheet.create({safe:{flex:1},content:{padding:16,paddingBottom:40},headRow:{flexDirection:'row',alignItems:'center',gap:10},backBtn:{width:40,height:40,borderRadius:11,borderWidth:1,alignItems:'center',justifyContent:'center'},form:{borderWidth:1,borderRadius:16,padding:16,marginBottom:14},formTitle:{fontSize:15,fontWeight:'800',marginBottom:8},lbl:{fontSize:11,fontWeight:'700',letterSpacing:.4,marginBottom:7,marginTop:10},input:{height:46,borderWidth:1,borderRadius:11,paddingHorizontal:12,fontSize:14},timeRow:{flexDirection:'row',gap:10},choiceRow:{flexDirection:'row',flexWrap:'wrap',gap:7},choice:{borderWidth:1.5,borderRadius:10,paddingVertical:8,paddingHorizontal:11},choiceTxt:{fontSize:12,fontWeight:'700'},err:{fontSize:12.5,fontWeight:'700',marginTop:10},okTxt:{fontSize:12.5,fontWeight:'700',marginTop:10},btnRow:{flexDirection:'row',gap:8,marginTop:12},saveBtn:{height:48,borderRadius:12,alignItems:'center',justifyContent:'center',flex:1},cancelBtn:{height:48,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center',paddingHorizontal:18},saveTxt:{color:'#fff',fontSize:14.5,fontWeight:'800'},cancelTxt:{fontSize:13,fontWeight:'800'},readonly:{fontSize:13,fontWeight:'600',marginBottom:12},state:{alignItems:'center',paddingVertical:30},box:{borderRadius:16,borderWidth:1,padding:22,alignItems:'center',gap:8,marginTop:6},boxSub:{fontSize:13,fontWeight:'600',textAlign:'center',lineHeight:19},retry:{fontSize:13,fontWeight:'800',marginTop:8},list:{borderRadius:16,borderWidth:1,overflow:'hidden'},row:{paddingVertical:12,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:10},rowTitle:{fontSize:14,fontWeight:'800'},rowSub:{fontSize:12,marginTop:2,fontWeight:'600'},editBtn:{borderWidth:1,borderRadius:9,paddingVertical:7,paddingHorizontal:10},editTxt:{fontSize:11.5,fontWeight:'800'}});
