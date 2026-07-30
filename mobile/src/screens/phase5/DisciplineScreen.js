/* Kiisaska — full case header + actions + notes + attachment metadata +
   immutable history. Confidential rows remain protected by RLS. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import useActiveSchoolId from '../../hooks/useActiveSchoolId';
import { ModuleScreenFrame, SaveButton, ErrorNote, SuccessNote } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import Icon from '../../components/Icon';
import { p4List } from '../../services/phase4';
import {
  listIncidents, createIncident, updateIncident,
  listIncidentActions, createIncidentAction,
  listIncidentNotes, createIncidentNote,
  listIncidentHistory, listIncidentAttachments, createIncidentAttachment,
  p5FriendlyError,
} from '../../services/phase5';

export default function DisciplineScreen() {
  const { c } = useTheme();
  const { roleKey } = useAuth();
  const { schoolId } = useActiveSchoolId();
  const canManage = ['schooladmin', 'superadmin', 'teacher'].includes(roleKey);
  const canConfidential = ['schooladmin', 'superadmin'].includes(roleKey);
  const [detail, setDetail] = useState(null);
  const [data, setData] = useState({ actions: [], notes: [], history: [], attachments: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [confidential, setConfidential] = useState(true);
  const [fileName, setFileName] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [busy, setBusy] = useState('');

  const loadDetail = async (row) => {
    setDetail(row); setLoading(true); setErr(''); setSuccess('');
    try {
      if (roleKey === 'parent') {
        const actions = await listIncidentActions(schoolId, { incident_id: row.id });
        setData({ actions, notes: [], history: [], attachments: [] });
      } else {
        const [actions, notes, history, attachments] = await Promise.all([
          listIncidentActions(schoolId, { incident_id: row.id }),
          listIncidentNotes(schoolId, { incident_id: row.id }),
          listIncidentHistory(schoolId, { incident_id: row.id }),
          listIncidentAttachments(schoolId, { incident_id: row.id }),
        ]);
        setData({ actions, notes, history, attachments });
      }
    } catch (e) { setErr(p5FriendlyError(e)); }
    finally { setLoading(false); }
  };
  const refreshDetail = async () => { if (detail) await loadDetail(detail); };
  const addAction = async () => {
    if (!action.trim() || busy) return;
    setBusy('action'); setErr('');
    try { await createIncidentAction({ school_id: schoolId, incident_id: detail.id, action: action.trim() }); setAction(''); setSuccess('Tallaabada waa la kaydiyay.'); await refreshDetail(); }
    catch (e) { setErr(p5FriendlyError(e)); } finally { setBusy(''); }
  };
  const addNote = async () => {
    if (!note.trim() || busy) return;
    setBusy('note'); setErr('');
    try { await createIncidentNote({ school_id: schoolId, incident_id: detail.id, note: note.trim(), is_confidential: canConfidential && confidential }); setNote(''); setSuccess('Qoraalka waa la kaydiyay.'); await refreshDetail(); }
    catch (e) { setErr(p5FriendlyError(e)); } finally { setBusy(''); }
  };
  const addAttachment = async () => {
    if (!fileName.trim() || !storagePath.trim() || busy) return;
    setBusy('file'); setErr('');
    try { await createIncidentAttachment({ school_id: schoolId, incident_id: detail.id, file_name: fileName.trim(), storage_path: storagePath.trim(), is_confidential: canConfidential && confidential }); setFileName(''); setStoragePath(''); setSuccess('Metadata-ga faylka waa la kaydiyay.'); await refreshDetail(); }
    catch (e) { setErr(p5FriendlyError(e)); } finally { setBusy(''); }
  };

  const module = {
    single: 'Kiis', icon: 'incidents', emptyText: 'Weli kiis lama diiwaangelin.', createRoles: ['schooladmin', 'superadmin', 'teacher'],
    list: listIncidents, create: createIncident, update: updateIncident,
    fields: [
      { key: 'title', label: 'CINWAANKA', required: true, placeholder: 'tusaale: Soo daahid joogto ah' },
      { key: 'student_id', label: 'ARDAYGA', required: true, fk: { list: (s) => p4List('students', s), labelKey: 'full_name' } },
      { key: 'class_id', label: 'FASALKA', fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
      { key: 'incident_date', label: 'TAARIIKHDA', date: true, default: new Date().toISOString().slice(0, 10) },
      { key: 'category', label: 'NOOCA', placeholder: 'tusaale: waqti-xumo' },
      { key: 'detail', label: 'FAAHFAAHIN', placeholder: 'sharraxaad' },
      { key: 'severity', label: 'DARNAANTA', default: 'dhexe', options: [{ value: 'hoose', label: 'Hoose' }, { value: 'dhexe', label: 'Dhexe' }, { value: 'sare', label: 'Sare' }, { value: 'halis', label: 'Halis' }] },
      { key: 'action', label: 'TALLAABADA HORE', placeholder: 'ikhtiyaari' },
      { key: 'follow_up_on', label: 'LA-SOCOD (YYYY-MM-DD)', date: true, placeholder: '2026-10-10' },
      { key: 'status', label: 'XAALADDA', default: 'open', options: [{ value: 'open', label: 'Furan' }, { value: 'resolved', label: 'Xiran' }] },
    ],
    listTitle: (r) => r.title, listSub: (r) => `${r.incident_date || ''} · ${r.severity || 'dhexe'} · ${r.status || 'open'}`,
    rowActions: [{ label: 'Faahfaahin', roles: ['schooladmin', 'superadmin', 'teacher', 'parent'], run: (r) => loadDetail(r) }],
  };

  return <ModuleScreenFrame title="Kiisaska" subtitle="Anshaxa, tallaabooyinka iyo la-socodka">
    <Phase5ModuleView module={module} />
    <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
      <Pressable style={styles.overlay} onPress={() => setDetail(null)}><Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>
        <View style={styles.head}><Text style={[styles.title, { color: c.ink }]}>{detail ? detail.title : 'Kiis'}</Text><TouchableOpacity onPress={() => setDetail(null)}><Icon name="close" size={18} color={c.muted} /></TouchableOpacity></View>
        <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled">
          {loading ? <ActivityIndicator color={c.blue} /> : <>
            <Text style={[styles.meta, { color: c.muted }]}>{detail ? `${detail.incident_date || ''} · ${detail.severity || ''} · ${detail.status || ''}` : ''}</Text>
            {detail && detail.detail ? <Text style={[styles.body, { color: c.ink }]}>{detail.detail}</Text> : null}
            <Section c={c} title="Tallaabooyinka" rows={data.actions} render={(x) => `${x.action_date || ''} · ${x.action}`} />
            <Section c={c} title="Qoraallada la oggol yahay" rows={data.notes} render={(x) => `${x.is_confidential ? 'Qarsoodi · ' : ''}${x.note}`} />
            <Section c={c} title="Faylasha" rows={data.attachments} render={(x) => `${x.file_name} · ${x.is_confidential ? 'Qarsoodi' : 'Caadi'}`} />
            <Section c={c} title="Taariikhda xaaladda" rows={data.history} render={(x) => `${String(x.changed_at || '').slice(0, 16).replace('T', ' ')} · ${x.old_status || '—'} → ${x.new_status || '—'}`} />
            <ErrorNote text={err} /><SuccessNote text={success} />
            {canManage ? <>
              <Text style={[styles.sectionTitle, { color: c.ink }]}>Ku dar tallaabo</Text><Input c={c} value={action} onChange={setAction} placeholder="Tallaabada la qaaday" /><SaveButton onPress={addAction} saving={busy === 'action'} label="Kaydi tallaabada" />
              <Text style={[styles.sectionTitle, { color: c.ink }]}>Ku dar qoraal</Text><Input c={c} value={note} onChange={setNote} placeholder="Qoraalka" />{canConfidential ? <Toggle c={c} value={confidential} onChange={setConfidential} /> : <Text style={[styles.line, { color: c.muted }]}>Macallinku wuxuu ku dari karaa qoraal aan qarsoodi ahayn oo keliya.</Text>}<SaveButton onPress={addNote} saving={busy === 'note'} label="Kaydi qoraalka" />
              <Text style={[styles.sectionTitle, { color: c.ink }]}>Metadata fayl</Text><Input c={c} value={fileName} onChange={setFileName} placeholder="Magaca faylka" /><Input c={c} value={storagePath} onChange={setStoragePath} placeholder="Storage path" />{canConfidential ? <Toggle c={c} value={confidential} onChange={setConfidential} /> : null}<SaveButton onPress={addAttachment} saving={busy === 'file'} label="Kaydi metadata" />
            </> : null}
          </>}
        </ScrollView>
      </Pressable></Pressable>
    </Modal>
  </ModuleScreenFrame>;
}
function Section({ c, title, rows, render }) { return <View style={{ marginTop: 16 }}><Text style={[styles.sectionTitle, { color: c.ink }]}>{title}</Text>{rows.length ? rows.map((x) => <Text key={x.id} style={[styles.line, { color: c.muted }]}>{render(x)}</Text>) : <Text style={[styles.line, { color: c.muted2 }]}>Weli wax lama diiwaangelin.</Text>}</View>; }
function Input({ c, value, onChange, placeholder }) { return <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted2} multiline style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} />; }
function Toggle({ c, value, onChange }) { return <TouchableOpacity onPress={() => onChange(!value)} style={styles.toggleRow}><View style={[styles.check, { borderColor: value ? c.blue : c.line, backgroundColor: value ? c.blue : c.surface }]}>{value ? <Icon name="check" size={13} color="#fff" /> : null}</View><Text style={[styles.toggleTxt, { color: c.muted }]}>Qoraal qarsoodi ah</Text></TouchableOpacity>; }
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 18 }, sheet: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 20 }, head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { flex: 1, fontSize: 17, fontWeight: '800' }, meta: { fontSize: 12, fontWeight: '700', marginTop: 5 }, body: { fontSize: 13, fontWeight: '600', lineHeight: 20, marginTop: 10 }, sectionTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 7 }, line: { fontSize: 12.5, fontWeight: '600', lineHeight: 19, marginBottom: 4 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 11, padding: 11, fontSize: 13, marginBottom: 8 }, toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }, check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, toggleTxt: { fontSize: 12.5, fontWeight: '700' } });
