import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { radius } from '../theme/colors';
import Avatar from './Avatar';
import Icon from './Icon';
import Badge from './Badge';
import StudentPhotoSection from './StudentPhotoSection';
import { FEE_LABELS, studentDetail } from '../data/mock';
import { SEVERITY } from '../data/datasets';
import { summarizeStudentExams } from '../data/results';
import { useAppData } from '../context/AppDataContext';
import { updateStudent } from '../services/appDataRepository';

function StudentIDDisplay({ studentId, c }) {
  return (
    <View style={[styles.idDisplay, { backgroundColor: c.navyLight, borderColor: c.navy }]}>
      <Text style={[styles.idLabel, { color: c.muted }]}>NAMBARKA ARDAYGA</Text>
      <Text style={[styles.idValue, { color: c.navy }]} selectable={false}>{studentId}</Text>
      <Text style={[styles.idNote, { color: c.muted }]}>Lama koobi karo</Text>
    </View>
  );
}

function InfoCell({ label, children }) {
  const { c } = useTheme();
  return (
    <View style={styles.cell}>
      <Text style={[styles.cellLabel, { color: c.muted }]}>{label}</Text>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

/* Inline edit form for a student's editable fields. Saves persist to the ONE
   central store via the parent's onSave (updateStudent). Identity fields
   (student_id / internal_id / class) are NOT editable here. */
function EditField({ c, label, value, onChange, keyboardType, placeholder }) {
  return (
    <View style={styles.efField}>
      <Text style={[styles.efLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={String(value ?? '')} onChangeText={onChange} keyboardType={keyboardType}
        placeholder={placeholder} placeholderTextColor={c.muted2}
        style={[styles.efInput, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
      />
    </View>
  );
}
function EditChips({ c, label, value, onChange, options }) {
  return (
    <View style={styles.efField}>
      <Text style={[styles.efLabel, { color: c.muted }]}>{label}</Text>
      <View style={styles.efChips}>
        {options.map((o) => (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)}
            style={[styles.efChip, { borderColor: c.line, backgroundColor: value === o.value ? c.blue : 'transparent' }]}>
            <Text style={[styles.efChipTxt, { color: value === o.value ? '#fff' : c.ink2 }]}>{o.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
function EditInfoForm({ c, initial, onCancel, onSave }) {
  const [v, setV] = useState(initial);
  const set = (k) => (val) => setV((s) => ({ ...s, [k]: val }));
  return (
    <View style={[styles.efWrap, { backgroundColor: c.goldSoft, borderColor: c.line }]}>
      <Text style={[styles.efTitle, { color: c.gold700 }]}>BEDDEL MACLUUMAADKA</Text>
      <EditField c={c} label="MAGACA BUUXA" value={v.name} onChange={set('name')} placeholder="Magaca ardayga" />
      <EditChips c={c} label="JINSI" value={v.gender} onChange={set('gender')} options={[{ value: 'Wiil', label: 'Wiil' }, { value: 'Gabar', label: 'Gabar' }]} />
      <EditField c={c} label="WAALIDKA" value={v.parent} onChange={set('parent')} placeholder="Magaca waalidka" />
      <EditField c={c} label="TALEEFOON" value={v.phone} onChange={set('phone')} keyboardType="phone-pad" placeholder="+252 6x xxxxxxx" />
      <EditChips c={c} label="LACAGTA" value={v.fee} onChange={set('fee')} options={[{ value: 'full', label: 'Bixiyay' }, { value: 'partial', label: 'Qayb' }, { value: 'due', label: 'Ma Bixin' }, { value: 'exempt', label: 'Bilaash' }]} />
      <EditField c={c} label="XAADIRINTA (%)" value={v.att} onChange={set('att')} keyboardType="number-pad" placeholder="0-100" />
      <View style={styles.efBtns}>
        <TouchableOpacity style={[styles.efBtn, { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 }]} onPress={onCancel}>
          <Text style={[styles.efBtnTxt, { color: c.ink2 }]}>Jooji</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.efBtn, { backgroundColor: c.blue }]} onPress={() => onSave(v)}>
          <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
          <Text style={[styles.efBtnTxt, { color: '#fff' }]}>Kaydi</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* Full student detail — opens when a student row/name is tapped.
   Shows identity header + info grid + guardian contact.
   `readOnly` (ministry portal): no editing, no deleting, no exam marks —
   only the profile info, attendance % and the guardian contact. */
export default function StudentProfileModal({ visible, student, className, onClose, onReportCase, cases = [], readOnly = false, liveMode = false }) {
  const { c } = useTheme();
  const { role, profile } = useRole();
  const { data: appData, reload } = useAppData();
  const [editPhoto, setEditPhoto] = useState(false);
  const [editInfo, setEditInfo] = useState(false);
  // local overrides so an edit reflects instantly (the parent still holds the
  // pre-edit snapshot); reset whenever a different student is opened.
  const [overrides, setOverrides] = useState(null);
  const sid = student && student.student_internal_id;
  useEffect(() => { setOverrides(null); setEditInfo(false); }, [sid]);

  const canEditPhoto = !readOnly && (role === 'superadmin' || role === 'schooladmin');
  const canEditInfo = !readOnly && (role === 'superadmin' || role === 'schooladmin' || role === 'teacher');
  const canDelete = !readOnly && (role === 'superadmin' || role === 'schooladmin');

  if (!student) return null;

  /* LIVE Phase 1–4 profile: only canonical identity/enrollment fields.
     The prototype details below include attendance, fees, results, incidents
     and AsyncStorage editing, so they must never render for a real account. */
  if (liveMode) {
    const displayName = student.full_name || student.name || 'Arday';
    const displayId = student.student_id || student.admission_number || '—';
    const gender = student.gender === 'male' ? 'Lab' : student.gender === 'female' ? 'Dhedig' : (student.gender || '—');
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
            <View style={[styles.header, { borderBottomColor: c.line }]}>
              <Avatar name={displayName} code={student.student_internal_id || student.id} size={60} />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.name, { color: c.ink }]}>{displayName}</Text>
                <Text style={[styles.code, { color: c.blue }]}>{displayId}</Text>
                {className ? <Badge label={className} tone="navy" style={{ marginTop: 6 }} /> : null}
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <StudentIDDisplay studentId={displayId} c={c} />
              <View style={styles.grid}>
                <InfoCell label="MAGACA"><Text style={[styles.val, { color: c.ink }]}>{displayName}</Text></InfoCell>
                <InfoCell label="FASALKA"><Text style={[styles.val, { color: c.ink }]}>{className || '—'}</Text></InfoCell>
                <InfoCell label="JINSIGA"><Text style={[styles.val, { color: c.ink }]}>{gender}</Text></InfoCell>
                <InfoCell label="TAARIIKHDA DHALASHADA"><Text style={[styles.val, { color: c.ink }]}>{student.date_of_birth || '—'}</Text></InfoCell>
                <InfoCell label="LAMBARKA DIIWAANGELINTA"><Text style={[styles.val, { color: c.ink }]}>{student.admission_number || '—'}</Text></InfoCell>
                <InfoCell label="XAALADDA"><Badge label="Firfircoon" tone="green" /></InfoCell>
              </View>
              <View style={[styles.liveNotice, { backgroundColor: c.blueSoft }]}>
                <Text style={{ color: c.navy, fontSize: 12.5, fontWeight: '700', lineHeight: 18 }}>Xaadiris, lacag, imtixaan iyo natiijooyin waxay bilaabmayaan Phase 5.</Text>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  // live = the stored record + any just-saved edits
  const live = overrides ? { ...student, ...overrides } : student;
  const fee = FEE_LABELS[live.fee] || FEE_LABELS.full;
  // the VISIBLE, school-generated student_id (e.g. HID-000142) — the canonical
  // display identifier. student_internal_id stays hidden (relation key only).
  const studentId = live.student_id || '—';
  const d = studentDetail(live.name, studentId, live);

  // persist an edit to the ONE central store, then reflect it locally
  const saveInfo = async (vals) => {
    const att = parseInt(vals.att, 10);
    const updates = {
      full_name: vals.name, name: vals.name,
      gender: vals.gender, parent: vals.parent, phone: vals.phone,
      fee: vals.fee, att: isNaN(att) ? live.att : Math.max(0, Math.min(100, att)),
    };
    setOverrides((o) => ({ ...(o || {}), ...updates }));
    setEditInfo(false);
    await updateStudent(student.student_internal_id, updates);
    if (reload) await reload();
  };

  // the REAL exams a teacher entered for this student (per term + auto-combined).
  // Admin/teacher only — parents/students keep the published-results view,
  // and the ministry (readOnly) never sees exam marks.
  const showExams = !readOnly && (role === 'superadmin' || role === 'schooladmin' || role === 'teacher');
  const examSummary = showExams
    ? summarizeStudentExams(appData.results, appData.terms, appData.subjects, student.student_internal_id)
    : [];

  const call = (phone) => phone && Linking.openURL('tel:' + phone.replace(/\s/g, ''));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          {/* header */}
          <View style={[styles.header, { borderBottomColor: c.line }]}>
            <Avatar name={live.name} code={student.student_internal_id} size={60} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.name, { color: c.ink }]}>{live.name}</Text>
              <Text style={[styles.code, { color: c.blue }]}>{studentId}</Text>
              {className ? <Badge label={className} tone="navy" style={{ marginTop: 6 }} /> : null}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {canDelete && (
                <TouchableOpacity onPress={() => {
                  if (confirm('Dib u baase ardaygan?')) {
                    // Student deletion logic will be implemented in parent
                    onClose();
                  }
                }} hitSlop={10} style={styles.deleteBtn}>
                  <Icon name="delete" size={18} color={c.rose} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.close}>
                <Icon name="close" size={20} color={c.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Prominent Student ID Display */}
            <StudentIDDisplay studentId={studentId} c={c} />

            {/* Edit Profile — student photo (Super/School Admin only) */}
            {canEditPhoto ? (
              editPhoto ? (
                <View style={{ marginBottom: 12 }}>
                  <StudentPhotoSection student={student} size={88} />
                  <TouchableOpacity onPress={() => setEditPhoto(false)} style={{ alignSelf: 'center', marginTop: 4 }}>
                    <Text style={[styles.uploadHint, { color: c.blue }]}>Dhammee</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setEditPhoto(true)} style={[styles.editBtn, { backgroundColor: c.blueSoft }]}>
                  <Icon name="camera" size={15} color={c.navy} strokeWidth={2} />
                  <Text style={[styles.editBtnTxt, { color: c.navy }]}>Beddel Sawirka Ardayga</Text>
                </TouchableOpacity>
              )
            ) : null}

            {canEditInfo && !editInfo ? (
              <TouchableOpacity onPress={() => setEditInfo(true)} style={[styles.editBtn, { backgroundColor: c.goldSoft }]}>
                <Icon name="edit" size={15} color={c.gold700} strokeWidth={2} />
                <Text style={[styles.editBtnTxt, { color: c.gold700 }]}>Beddel Macluumaadka</Text>
              </TouchableOpacity>
            ) : null}

            {/* inline editable info form — persists to the central store */}
            {canEditInfo && editInfo ? (
              <EditInfoForm
                c={c}
                initial={{ name: live.name || '', gender: d.gender, parent: d.parent, phone: d.phone, fee: live.fee || 'full', att: String(d.att) }}
                onCancel={() => setEditInfo(false)}
                onSave={saveInfo}
              />
            ) : null}

            {/* report a behaviour case for this student */}
            {onReportCase ? (
              <TouchableOpacity onPress={() => onReportCase(student)} style={[styles.editBtn, { backgroundColor: c.roseSoft }]}>
                <Icon name="alert" size={15} color={c.rose} strokeWidth={2} />
                <Text style={[styles.editBtnTxt, { color: c.rose }]}>Soo sheeg Kiis Ardayga</Text>
              </TouchableOpacity>
            ) : null}

            {/* basic info grid */}
            <View style={styles.grid}>
              <InfoCell label="JINSI">
                <Badge label={d.gender} tone={d.gender === 'Wiil' ? 'blue' : 'gold'} />
              </InfoCell>
              <InfoCell label="DA'DA / DHALASHADA">
                <Text style={[styles.val, { color: c.ink }]}>{d.age} sano · {d.dob}</Text>
              </InfoCell>
              <InfoCell label="WAALIDKA">
                <Text style={[styles.val, { color: c.ink }]}>{d.parent}</Text>
              </InfoCell>
              <InfoCell label="TALEEFOON">
                <Text style={[styles.val, { color: c.blue }]} onPress={() => call(d.phone)}>{d.phone}</Text>
              </InfoCell>
              <InfoCell label="EMAIL">
                <Text style={[styles.val, { color: c.ink2, fontSize: 12.5 }]}>{d.email}</Text>
              </InfoCell>
              <InfoCell label="MAGAALADA">
                <Text style={[styles.val, { color: c.ink }]}>{d.city}</Text>
              </InfoCell>
              <InfoCell label="CINWAANKA">
                <Text style={[styles.val, { color: c.ink }]}>{d.address}</Text>
              </InfoCell>
              <InfoCell label="DUGSIGII HORE">
                <Text style={[styles.val, { color: c.ink }]}>{d.prevSchool}</Text>
              </InfoCell>
              <InfoCell label="SANNADKA DIIWAANGELINTA">
                <Text style={[styles.val, { color: c.ink }]}>{d.enrolled}</Text>
              </InfoCell>
              <InfoCell label="BASKA DUGSIGA">
                <Text style={[styles.val, { color: c.ink }]}>{d.bus}</Text>
              </InfoCell>
              <InfoCell label="LACAGTA">
                <Badge label={fee.label} tone={fee.tone} />
              </InfoCell>
              <InfoCell label="XAADIRINTA">
                <Text style={[styles.val, { color: d.att >= 90 ? c.green : d.att >= 80 ? c.gold700 : c.rose }]}>
                  {d.att}%
                </Text>
              </InfoCell>
            </View>

            {/* secondary-school intake (Form 1 from primary) — exam result + certificate */}
            {d.entry === 'secondary' || d.examResult ? (
              <>
                <View style={[styles.divider, { borderTopColor: c.line }]} />
                <Text style={[styles.caseSecLbl, { color: c.muted }]}>DIIWAANGELINTA DUGSIGA SARE (FORM 1)</Text>
                <View style={[styles.caseItem, { backgroundColor: c.blueSoft, borderColor: c.line }]}>
                  <View style={styles.grid}>
                    <InfoCell label="NATIIJADA IMTIXAANKA">
                      <Text style={[styles.val, { color: c.ink }]}>{d.examResult || '—'}</Text>
                    </InfoCell>
                    <InfoCell label="SANNADKA QALINKA">
                      <Text style={[styles.val, { color: c.ink }]}>{d.examYear || '—'}</Text>
                    </InfoCell>
                    <InfoCell label="LAMBARKA SHAHAADADA">
                      <Text style={[styles.val, { color: c.ink }]}>{d.certNo || '—'}</Text>
                    </InfoCell>
                  </View>
                </View>
              </>
            ) : null}

            {/* IMTIXAANNADA — real entered exams, per term + auto-combined avg */}
            {showExams && examSummary.length ? (
              <>
                <View style={[styles.divider, { borderTopColor: c.line }]} />
                <Text style={[styles.caseSecLbl, { color: c.muted }]}>IMTIXAANNADA</Text>
                {examSummary.map((ex) => (
                  <View key={ex.subject} style={[styles.caseItem, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <View style={styles.examTop}>
                      <Text style={[styles.examSubj, { color: c.ink }]}>{ex.subject}</Text>
                      {ex.combined != null ? (
                        <Badge label={ex.combined + '%'} tone={ex.combined >= 50 ? 'green' : 'rose'} />
                      ) : null}
                    </View>
                    {ex.terms.map((t, i) => (
                      <View key={i} style={styles.examRow}>
                        <Text style={[styles.examTerm, { color: c.muted }]}>{t.term}</Text>
                        <Text style={[styles.examMark, { color: c.ink2 }]}>{t.score}/{t.full}</Text>
                        <Text style={[styles.examPct, { color: t.pct >= 50 ? c.green : c.rose }]}>{t.pct}%</Text>
                      </View>
                    ))}
                    {ex.terms.length >= 2 ? (
                      <Text style={[styles.examNote, { color: c.muted2 }]}>Isku-dar (celcelis labada term): {ex.combined}%</Text>
                    ) : null}
                  </View>
                ))}
              </>
            ) : null}

            {/* the student's cases (faahfaahin) shown right in the profile */}
            {cases && cases.length ? (
              <>
                <View style={[styles.divider, { borderTopColor: c.line }]} />
                <Text style={[styles.caseSecLbl, { color: c.muted }]}>KIISASKA ARDAYGA ({cases.length})</Text>
                {cases.map((it, i) => {
                  const sev = SEVERITY[it[3]] || SEVERITY.low;
                  return (
                    <View key={i} style={[styles.caseItem, { backgroundColor: c.bg, borderColor: c.line }]}>
                      <View style={styles.caseItemTop}>
                        <Text style={[styles.caseItemType, { color: c.ink }]} numberOfLines={1}>{it[2]}</Text>
                        <Badge label={sev.label} tone={sev.tone} />
                      </View>
                      <Text style={[styles.caseItemDesc, { color: c.muted }]}>{it[4]}</Text>
                      <Text style={[styles.caseItemMeta, { color: c.muted2 }]}>{it[5]} · {it[6]}</Text>
                    </View>
                  );
                })}
              </>
            ) : null}

            {/* guardian / parent contact — tappable to call */}
            <View style={[styles.divider, { borderTopColor: c.line }]} />
            <TouchableOpacity
              style={[styles.contactRow, { backgroundColor: c.blueSoft }]}
              onPress={() => call(d.phone)}
              activeOpacity={0.8}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactLbl, { color: c.muted }]}>XIRIIRKA WAALIDKA</Text>
                <Text style={[styles.contactName, { color: c.ink }]}>{d.parent}</Text>
                <Text style={[styles.contactPhone, { color: c.blue }]}>{d.phone}</Text>
              </View>
              <View style={[styles.callBtn, { backgroundColor: c.blue }]}>
                <Icon name="phone" size={15} color="#fff" strokeWidth={2} />
                <Text style={styles.callTxt}>Wac</Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  name: { fontSize: 18, fontWeight: '800' },
  code: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  close: { padding: 4 },
  deleteBtn: { padding: 4 },
  idDisplay: { borderRadius: 12, borderWidth: 2, padding: 14, marginBottom: 16 },
  idLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5 },
  idValue: { fontSize: 16, fontWeight: '900', marginTop: 6, fontFamily: 'monospace', letterSpacing: 1 },
  idNote: { fontSize: 9.5, fontWeight: '600', marginTop: 4, fontStyle: 'italic' },
  body: { padding: 20, paddingBottom: 36 },
  uploadHint: { fontSize: 11.5, fontWeight: '600', marginBottom: 14 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, borderRadius: 12, marginBottom: 14 },
  editBtnTxt: { fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  cell: { minWidth: '44%', flex: 1, marginBottom: 12 },
  cellLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  val: { fontSize: 14, fontWeight: '600' },
  divider: { borderTopWidth: 1, marginVertical: 16 },
  caseSecLbl: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  caseItem: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  caseItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  caseItemType: { fontSize: 13.5, fontWeight: '800', flex: 1 },
  caseItemDesc: { fontSize: 12.5, lineHeight: 18, fontWeight: '500' },
  caseItemMeta: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  examTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  examSubj: { fontSize: 13.5, fontWeight: '800', flex: 1 },
  examRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  examTerm: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  examMark: { width: 64, textAlign: 'right', fontSize: 12.5, fontWeight: '700' },
  examPct: { width: 52, textAlign: 'right', fontSize: 12.5, fontWeight: '800' },
  examNote: { fontSize: 11, fontWeight: '600', marginTop: 6, fontStyle: 'italic' },
  efWrap: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 14 },
  efTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, marginBottom: 12 },
  efField: { marginBottom: 12 },
  efLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 5 },
  efInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 14 },
  efChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  efChip: { borderWidth: 1, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
  efChipTxt: { fontSize: 12, fontWeight: '700' },
  efBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  efBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  efBtnTxt: { fontSize: 14, fontWeight: '700' },
  secRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  secTitle: { fontSize: 15, fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, marginVertical: 8 },
  contactLbl: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  contactName: { fontSize: 14, fontWeight: '700', marginTop: 3 },
  contactPhone: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12 },
  callTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  note: { padding: 14, borderRadius: radius.md, marginTop: 12 },
  noteTxt: { fontSize: 12.5, lineHeight: 18, fontWeight: '500' },
});
