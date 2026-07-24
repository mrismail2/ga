import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Pressable, ScrollView, Switch, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { SchoolSelectPrompt } from './SchoolSelector';
import Icon from './Icon';
import {
  loadGuardianManagementData, createGuardian, updateGuardian,
  createParentStudentLink, updateParentStudentLink, deleteParentStudentLink,
} from '../services/guardianLinks';
import { p4FriendlyError } from '../services/phase4';

export default function GuardianManagementView() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  // the RESOLVED active school (own school for School Admin, the picked
  // school for Super Admin) — every guardian/link query below is scoped to
  // this, never a raw/placeholder profile.school_id.
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const [guardians, setGuardians] = useState([]);
  const [students, setStudents] = useState([]);
  const [links, setLinks] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guardianForm, setGuardianForm] = useState(null);
  const [linkForm, setLinkForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = useCallback(async () => {
    if (!isLive || !schoolId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const data = await loadGuardianManagementData(schoolId);
      const grouped = {};
      data.guardians.forEach((parent) => { grouped[parent.id] = []; });
      data.links.forEach((link) => { if (grouped[link.parent_id]) grouped[link.parent_id].push(link); });
      setGuardians(data.guardians); setStudents(data.students); setLinks(grouped);
      setSelectedId((current) => current && data.guardians.some((p) => p.id === current) ? current : null);
    } catch (e) { setError(p4FriendlyError(e)); }
    finally { setLoading(false); }
  }, [isLive, schoolId]);

  useEffect(() => { load(); }, [load]);

  const selected = guardians.find((parent) => parent.id === selectedId) || null;
  const selectedLinks = selected ? (links[selected.id] || []) : [];

  const openGuardian = (parent) => {
    setFormError(null);
    setGuardianForm({
      id: parent ? parent.id : null,
      full_name: parent ? parent.full_name : '', phone: parent ? parent.phone || '' : '', email: parent ? parent.email || '' : '',
    });
  };

  const saveGuardian = async () => {
    if (saving || !guardianForm) return;
    if (!guardianForm.full_name.trim() || !guardianForm.phone.trim()) { setFormError('Magaca iyo telefoonku waa qasab.'); return; }
    setSaving(true); setFormError(null);
    try {
      if (guardianForm.id) await updateGuardian(guardianForm.id, guardianForm, schoolId);
      else await createGuardian(guardianForm, schoolId);
      setGuardianForm(null); await load();
    } catch (e) { setFormError(p4FriendlyError(e)); }
    finally { setSaving(false); }
  };

  const openLink = (link) => {
    setFormError(null);
    setLinkForm({
      id: link ? link.id : null,
      student_id: link ? link.student_id : '',
      relationship: link ? link.relationship || '' : '',
      is_primary: link ? Boolean(link.is_primary) : false,
      can_receive_messages: link ? Boolean(link.can_receive_messages) : true,
    });
  };

  const saveLink = async () => {
    if (saving || !selected || !linkForm) return;
    if (!linkForm.student_id) { setFormError('Dooro ardayga la xiriirinayo.'); return; }
    setSaving(true); setFormError(null);
    try {
      if (linkForm.id) await updateParentStudentLink(linkForm.id, linkForm, schoolId);
      else await createParentStudentLink(selected.id, linkForm, schoolId);
      setLinkForm(null); await load();
    } catch (e) { setFormError(p4FriendlyError(e)); }
    finally { setSaving(false); }
  };

  const unlink = async (linkId) => {
    if (saving) return;
    setSaving(true); setFormError(null);
    try { await deleteParentStudentLink(linkId, schoolId); setLinkForm(null); await load(); }
    catch (e) { setFormError(p4FriendlyError(e)); }
    finally { setSaving(false); }
  };

  if (!isLive) return <StateBox icon="profile" text="Maamulka waalidka iyo ardaygu wuxuu u baahan yahay akoon LIVE ah." c={c} />;
  if (needsSchoolSelection) return <SchoolSelectPrompt />;
  if (loading) return <StateBox loading text="Xogta waalidiinta waa la soo dejinayaa…" c={c} />;
  if (error) return <StateBox icon="notice" text={error} c={c} action="Isku day mar kale" onAction={load} />;

  return (
    <View>
      {!selected ? <>
        <View style={styles.toolbar}>
          <Text style={[styles.count, { color: c.muted }]}>{guardians.length} waalid / mas’uul</Text>
          <TouchableOpacity onPress={() => openGuardian(null)} style={[styles.add, { backgroundColor: c.blue }]}>
            <Icon name="plus" size={15} color="#fff" /><Text style={styles.addTxt}>Ku dar Waalid</Text>
          </TouchableOpacity>
        </View>
        {guardians.length === 0 ? <StateBox icon="profile" text="Waalid ama mas’uul weli lama diiwaangelin." c={c} action="Ku dar Waalid" onAction={() => openGuardian(null)} /> :
          <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>
            {guardians.map((parent, index) => {
              const children = links[parent.id] || [];
              return <TouchableOpacity key={parent.id} onPress={() => setSelectedId(parent.id)}
                style={[styles.row, { borderTopColor: c.line, borderTopWidth: index ? 1 : 0 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.rowTitle, { color: c.ink }]}>{parent.full_name}</Text>
                  <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>
                    {children.length ? children.map((link) => link.student && link.student.full_name).filter(Boolean).join(', ') : 'Carruur lama xiriirin'}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: c.blueSoft }]}><Text style={[styles.badgeTxt, { color: c.blue }]}>{children.length}</Text></View>
                <Icon name="chevronRight" size={17} color={c.muted2} />
              </TouchableOpacity>;
            })}
          </View>}
      </> : <>
        <View style={styles.detailHead}>
          <TouchableOpacity onPress={() => setSelectedId(null)} style={[styles.iconBtn, { borderColor: c.line }]}><Icon name="back" size={17} color={c.ink} /></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={[styles.detailTitle, { color: c.ink }]}>{selected.full_name}</Text><Text style={[styles.rowSub, { color: c.muted }]}>{selected.phone || 'Telefoon la’aan'}</Text></View>
          <TouchableOpacity onPress={() => openGuardian(selected)} style={[styles.iconBtn, { borderColor: c.line }]}><Icon name="edit" size={16} color={c.blue} /></TouchableOpacity>
        </View>
        <View style={styles.toolbar}><Text style={[styles.count, { color: c.muted }]}>Carruurta lala xiriiriyey ({selectedLinks.length})</Text>
          <TouchableOpacity onPress={() => openLink(null)} style={[styles.add, { backgroundColor: c.blue }]}><Icon name="plus" size={15} color="#fff" /><Text style={styles.addTxt}>Ku dar xiriir</Text></TouchableOpacity></View>
        {selectedLinks.length === 0 ? <StateBox icon="students" text="Waalidkan weli arday lama xiriirin." c={c} action="Dooro Arday" onAction={() => openLink(null)} /> :
          <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.line }]}>{selectedLinks.map((link, index) =>
            <TouchableOpacity key={link.id} onPress={() => openLink(link)} style={[styles.row, { borderTopColor: c.line, borderTopWidth: index ? 1 : 0 }]}>
              <View style={{ flex: 1 }}><Text style={[styles.rowTitle, { color: c.ink }]}>{link.student ? link.student.full_name : link.student_id}</Text>
                <Text style={[styles.rowSub, { color: c.muted }]}>{link.relationship || 'Xiriir lama qeexin'}{link.is_primary ? ' · Mas’uulka koowaad' : ''}</Text></View>
              <Icon name="edit" size={16} color={c.blue} />
            </TouchableOpacity>)}</View>}
      </>}

      <GuardianModal value={guardianForm} setValue={setGuardianForm} error={formError} saving={saving} onSave={saveGuardian} onClose={() => setGuardianForm(null)} c={c} />
      <LinkModal value={linkForm} setValue={setLinkForm} students={students} error={formError} saving={saving} onSave={saveLink}
        onDelete={linkForm && linkForm.id ? () => unlink(linkForm.id) : null} onClose={() => setLinkForm(null)} c={c} />
    </View>
  );
}

function StateBox({ loading, icon, text, c, action, onAction }) {
  return <View style={[styles.state, { backgroundColor: c.surface, borderColor: c.line }]}>
    {loading ? <ActivityIndicator color={c.blue} /> : <Icon name={icon} size={25} color={c.muted2} />}
    <Text style={[styles.stateTxt, { color: c.muted }]}>{text}</Text>
    {action ? <TouchableOpacity onPress={onAction}><Text style={{ color: c.blue, fontWeight: '800' }}>{action}</Text></TouchableOpacity> : null}
  </View>;
}

function GuardianModal({ value, setValue, error, saving, onSave, onClose, c }) {
  return <Modal visible={Boolean(value)} transparent animationType="fade" onRequestClose={onClose}><Pressable style={styles.overlay} onPress={onClose}>
    <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>{value ? <>
      <Text style={[styles.sheetTitle, { color: c.ink }]}>{value.id ? 'Wax ka beddel Waalidka' : 'Ku dar Waalid / Mas’uul'}</Text>
      {[['full_name', 'MAGACA'], ['phone', 'TELEFOONKA'], ['email', 'EMAIL']].map(([key, label]) => <View key={key} style={styles.field}>
        <Text style={[styles.label, { color: c.muted }]}>{label}</Text><TextInput value={value[key]} onChangeText={(text) => setValue({ ...value, [key]: text })}
          style={[styles.input, { borderColor: c.line, backgroundColor: c.bg, color: c.ink }]} /></View>)}
      {error ? <Text style={[styles.error, { color: c.rose }]}>{error}</Text> : null}<SaveButtons saving={saving} onSave={onSave} onClose={onClose} c={c} />
    </> : null}</Pressable></Pressable></Modal>;
}

function LinkModal({ value, setValue, students, error, saving, onSave, onDelete, onClose, c }) {
  return <Modal visible={Boolean(value)} transparent animationType="fade" onRequestClose={onClose}><Pressable style={styles.overlay} onPress={onClose}>
    <Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>{value ? <>
      <Text style={[styles.sheetTitle, { color: c.ink }]}>{value.id ? 'Wax ka beddel Xiriirka' : 'Ku xiriiri Arday'}</Text>
      <Text style={[styles.label, { color: c.muted }]}>ARDAYGA</Text><ScrollView style={{ maxHeight: 160 }}>{students.map((student) => {
        const on = value.student_id === student.id; return <TouchableOpacity key={student.id} disabled={Boolean(value.id)} onPress={() => setValue({ ...value, student_id: student.id })}
          style={[styles.studentChoice, { borderColor: on ? c.blue : c.line, backgroundColor: on ? c.blueSoft : c.bg, opacity: value.id && !on ? 0.45 : 1 }]}>
          <Text style={[styles.rowTitle, { color: c.ink }]}>{student.full_name}</Text><Text style={[styles.rowSub, { color: c.muted }]}>{student.student_id || student.admission_number || ''}</Text>
        </TouchableOpacity>; })}</ScrollView>
      <View style={styles.field}><Text style={[styles.label, { color: c.muted }]}>XIRIIRKA</Text><TextInput value={value.relationship} onChangeText={(text) => setValue({ ...value, relationship: text })}
        placeholder="tusaale: Hooyo, Aabe, Eedo" placeholderTextColor={c.muted2} style={[styles.input, { borderColor: c.line, backgroundColor: c.bg, color: c.ink }]} /></View>
      <Toggle label="Mas’uulka koowaad" value={value.is_primary} onChange={(next) => setValue({ ...value, is_primary: next })} c={c} />
      <Toggle label="Wuxuu heli karaa fariimaha" value={value.can_receive_messages} onChange={(next) => setValue({ ...value, can_receive_messages: next })} c={c} />
      {error ? <Text style={[styles.error, { color: c.rose }]}>{error}</Text> : null}
      {onDelete ? <TouchableOpacity onPress={onDelete} disabled={saving} style={[styles.deleteBtn, { borderColor: c.rose }]}><Text style={[styles.deleteTxt, { color: c.rose }]}>Ka saar xiriirka</Text></TouchableOpacity> : null}
      <SaveButtons saving={saving} onSave={onSave} onClose={onClose} c={c} />
    </> : null}</Pressable></Pressable></Modal>;
}

function Toggle({ label, value, onChange, c }) { return <View style={styles.toggle}><Text style={[styles.rowTitle, { color: c.ink }]}>{label}</Text><Switch value={value} onValueChange={onChange} trackColor={{ true: c.blue }} /></View>; }
function SaveButtons({ saving, onSave, onClose, c }) { return <View style={styles.actions}><TouchableOpacity onPress={onClose} style={[styles.action, { borderColor: c.line, borderWidth: 1 }]}><Text style={[styles.actionTxt, { color: c.ink }]}>Jooji</Text></TouchableOpacity><TouchableOpacity onPress={onSave} disabled={saving} style={[styles.action, { backgroundColor: c.blue }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionTxt, { color: '#fff' }]}>Kaydi</Text>}</TouchableOpacity></View>; }

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, count: { fontSize: 12.5, fontWeight: '700' },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 12 }, addTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' }, row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }, rowTitle: { fontSize: 14, fontWeight: '700' }, rowSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  badge: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, badgeTxt: { fontSize: 12, fontWeight: '800' },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 18 }, detailTitle: { fontSize: 17, fontWeight: '800' }, iconBtn: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  state: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 }, stateTxt: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }, sheet: { width: '100%', maxWidth: 460, maxHeight: '90%', borderRadius: 20, padding: 20 }, sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 16 },
  field: { marginTop: 12 }, label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 }, input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 },
  studentChoice: { borderWidth: 1, borderRadius: 11, padding: 10, marginBottom: 7 }, toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  error: { fontSize: 12.5, fontWeight: '700', marginTop: 12 }, deleteBtn: { height: 42, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, deleteTxt: { fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 }, action: { flex: 1, height: 47, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, actionTxt: { fontSize: 14, fontWeight: '800' },
});
