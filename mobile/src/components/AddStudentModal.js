import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { usePhotos } from '../context/PhotoContext';
import { radius } from '../theme/colors';
import Icon from './Icon';
import StudentPhotoSection from './StudentPhotoSection';
import { useAppData } from '../context/AppDataContext';
import { addStudent as repoAddStudent, getSchoolSettings, getStudentsBySchool, previewStudentId } from '../services/appDataRepository';
import { saveStudentPhoto } from '../services/studentPhotoStorage';

const GENDERS = ['Wiil', 'Gabar'];
const FEES = [
  { key: 'full', label: 'Bixiyey' },
  { key: 'partial', label: 'Qayb ahaan' },
  { key: 'due', label: 'La sugayo' },
];

function Field({ label, value, onChangeText, placeholder, keyboardType }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted2}
        keyboardType={keyboardType}
        style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
      />
    </View>
  );
}

/* Real add-student form — fields + photo upload. On save it calls onAdd
   with a new student object that the roster appends. */
export default function AddStudentModal({ visible, onClose, onAdd, classId: classIdProp }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { reload } = useAppData();
  const { photos, setPhoto } = usePhotos();
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [phone, setPhone] = useState('');
  const [addr, setAddr] = useState('');
  const [dob, setDob] = useState('');
  const [prevSchool, setPrevSchool] = useState('');
  const [gender, setGender] = useState('Wiil');
  const [fee, setFee] = useState('full');
  const [preview, setPreview] = useState('');
  // secondary-school enrollment (arday ka soo galay dugsiga hore → Form 1)
  const [secondary, setSecondary] = useState(false);
  const [examResult, setExamResult] = useState('');
  const [examYear, setExamYear] = useState('');
  const [certNo, setCertNo] = useState('');
  // the registry, used to auto-fill a returning/known student's details by name
  const [registry, setRegistry] = useState([]);
  const [autoFilled, setAutoFilled] = useState(false);
  // a temporary photo key (the real Student ID is generated on save)
  const [code] = useState(() => 'NEW-' + Date.now());

  // the school this admin is acting on (Super Admin previews school_001)
  const actingSchoolId = !profile || profile.school_id === '*' ? 'school_001' : profile.school_id;

  // show the next Student ID this school will assign (preview only)
  useEffect(() => {
    if (!visible) return;
    getSchoolSettings(actingSchoolId).then((s) => setPreview(previewStudentId(s)));
    getStudentsBySchool(actingSchoolId).then((all) => setRegistry(Array.isArray(all) ? all : []));
  }, [visible, actingSchoolId]);

  // auto-fill: when the typed name matches a known student, pull their info in
  useEffect(() => {
    const q = name.trim().toLowerCase();
    if (!q || q.length < 3 || !registry.length) return;
    const match = registry.find((s) => (s.full_name || s.name || '').trim().toLowerCase() === q);
    if (!match) { if (autoFilled) setAutoFilled(false); return; }
    // only fill fields the user hasn't typed into yet
    if (!parent) setParent(match.parent || '');
    if (!phone) setPhone(match.phone || '');
    if (!addr) setAddr(match.address || '');
    if (!dob) setDob(match.dob || '');
    if (!prevSchool) setPrevSchool(match.prevSchool || '');
    if (match.gender) setGender(match.gender);
    setAutoFilled(true);
  }, [name, registry]);

  const reset = () => {
    setName(''); setParent(''); setPhone(''); setAddr(''); setDob(''); setPrevSchool('');
    setGender('Wiil'); setFee('full');
    setSecondary(false); setExamResult(''); setExamYear(''); setCertNo(''); setAutoFilled(false);
  };

  const save = async () => {
    if (!name.trim()) return;
    // a photo chosen during the form is stored under the temp key
    const tempPhoto = photos[code] || null;
    // generate the Student ID + persist into the ONE central store in a single
    // step (prefix + sequence come from the admin's real school).
    const student = await repoAddStudent(profile, {
      full_name: name.trim(), name: name.trim(), gender,
      class_id: classIdProp || null,
      parent: parent.trim() || 'Waalid', phone, address: addr,
      dob, prevSchool, fee, att: 85, photo_uri: tempPhoto,
      // secondary-school intake (Form 1 from primary): exam result + certificate
      entry: secondary ? 'secondary' : 'normal',
      examResult: secondary ? examResult.trim() : '',
      examYear: secondary ? examYear.trim() : '',
      certNo: secondary ? certNo.trim() : '',
    });
    // move the photo onto the real student keys (internal id + Student ID)
    if (tempPhoto) {
      setPhoto(student.student_internal_id, tempPhoto);
      setPhoto(student.student_id, tempPhoto);
      saveStudentPhoto(student.student_internal_id, tempPhoto).catch(() => {});
    }
    await reload();         // refresh the central store so the roster updates
    onAdd(student);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <Text style={[styles.title, { color: c.ink }]}>Arday Cusub Ku Dar</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Icon name="close" size={20} color={c.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* student photo — Camera / Gallery / Remove */}
            <StudentPhotoSection student={{ name, code }} size={88} />

            {/* the Student ID this school will auto-assign on save */}
            {preview ? (
              <View style={[styles.idPreview, { backgroundColor: c.blueSoft }]}>
                <Text style={[styles.idPreviewLbl, { color: c.muted }]}>STUDENT ID (OTOMAATIG)</Text>
                <Text style={[styles.idPreviewVal, { color: c.navy }]}>{preview}</Text>
              </View>
            ) : null}

            <Field label="MAGACA BUUXA" value={name} onChangeText={setName} placeholder="tusaale: Aaliyah Maxamed Cali" />
            {autoFilled ? (
              <View style={[styles.autoNote, { backgroundColor: c.greenSoft }]}>
                <Icon name="check" size={14} color={c.green} strokeWidth={2.6} />
                <Text style={[styles.autoNoteTxt, { color: c.green }]}>Macluumaadka ardaygan waa la helay — si otomaatig ah ayaa loo buuxiyay.</Text>
              </View>
            ) : null}
            <Field label="TAARIIKHDA DHALASHADA" value={dob} onChangeText={setDob} placeholder="tusaale: 21/06/2013" />
            <Field label="WAALIDKA" value={parent} onChangeText={setParent} placeholder="Magaca waalidka" />
            <Field label="TALEEFOON" value={phone} onChangeText={setPhone} placeholder="+252 ..." keyboardType="phone-pad" />
            <Field label="CINWAANKA" value={addr} onChangeText={setAddr} placeholder="Xaafadda / magaalada" />
            <Field label="DUGSIGII HORE" value={prevSchool} onChangeText={setPrevSchool} placeholder="tusaale: Dugsiga Iftiin" />

            <Text style={[styles.fLabel, { color: c.muted }]}>JINSIGA</Text>
            <View style={styles.seg}>
              {GENDERS.map((g) => (
                <TouchableOpacity key={g} onPress={() => setGender(g)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: gender === g ? c.blue : 'transparent' }]}>
                  <Text style={[styles.segTxt, { color: gender === g ? '#fff' : c.ink2 }]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fLabel, { color: c.muted, marginTop: 14 }]}>LACAGTA</Text>
            <View style={styles.seg}>
              {FEES.map((f) => (
                <TouchableOpacity key={f.key} onPress={() => setFee(f.key)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: fee === f.key ? c.navy : 'transparent' }]}>
                  <Text style={[styles.segTxt, { color: fee === f.key ? '#fff' : c.ink2 }]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Secondary-school intake — arday dugsiga hore ka soo galay Form 1 */}
            <TouchableOpacity
              onPress={() => setSecondary((v) => !v)}
              activeOpacity={0.8}
              style={[styles.secToggle, { borderColor: secondary ? c.blue : c.line, backgroundColor: secondary ? c.blueSoft : 'transparent' }]}
            >
              <View style={[styles.secCheck, { borderColor: secondary ? c.blue : c.muted2, backgroundColor: secondary ? c.blue : 'transparent' }]}>
                {secondary ? <Icon name="check" size={12} color="#fff" strokeWidth={3} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.secTitle, { color: c.ink }]}>Arday dugsiga sare cusub (Form 1)</Text>
                <Text style={[styles.secSub, { color: c.muted }]}>Kuwa dugsiga hore ka soo qalin-jabiyay ee imtixaan ka soo baxay</Text>
              </View>
            </TouchableOpacity>

            {secondary ? (
              <View style={[styles.secBox, { borderColor: c.line, backgroundColor: c.bg }]}>
                <Field label="NATIIJADA IMTIXAANKA DUGSIGA HORE" value={examResult} onChangeText={setExamResult} placeholder="tusaale: A · 86% · Mortqaal" />
                <Field label="SANNADKA QALIN-JABINTA" value={examYear} onChangeText={setExamYear} placeholder="tusaale: 2025" keyboardType="number-pad" />
                <Field label="LAMBARKA SHAHAADADA" value={certNo} onChangeText={setCertNo} placeholder="tusaale: PRI-2025-00412" />
              </View>
            ) : null}

            <View style={styles.foot}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]} onPress={onClose}>
                <Text style={[styles.btnTxt, { color: c.ink2 }]}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: name.trim() ? c.blue : c.muted2 }]} onPress={save} disabled={!name.trim()}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
                <Text style={[styles.btnTxt, { color: '#fff' }]}>Kaydi Ardayga</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  body: { padding: 20, paddingBottom: 36 },
  photoRow: { alignItems: 'center', marginBottom: 18, gap: 8 },
  idPreview: { padding: 12, borderRadius: 12, marginBottom: 14, alignItems: 'center' },
  idPreviewLbl: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4 },
  idPreviewVal: { fontSize: 18, fontWeight: '800', marginTop: 3, letterSpacing: 0.5 },
  photoHint: { fontSize: 12, fontWeight: '600' },
  field: { marginBottom: 14 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14 },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  segTxt: { fontSize: 13, fontWeight: '700' },
  autoNote: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 14 },
  autoNoteTxt: { flex: 1, fontSize: 12, fontWeight: '700' },
  secToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 18 },
  secCheck: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  secTitle: { fontSize: 13.5, fontWeight: '800' },
  secSub: { fontSize: 11.5, fontWeight: '600', marginTop: 2 },
  secBox: { borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12 },
  foot: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
