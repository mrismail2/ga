import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePhotos } from '../context/PhotoContext';
import Icon from './Icon';

const CLASS_OPTS = ['Form 5A', 'Form 6B', 'Form 7A'];

function Field({ label, value, onChangeText, placeholder, multiline }) {
  const { c } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={c.muted2} multiline={multiline}
        style={[styles.input, multiline && styles.area, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
      />
    </View>
  );
}

/* Lesson preparation — a full plan with a cover photo/attachment and the
   important teaching details (topic, objectives, materials, duration,
   week, homework, notes). Frontend prototype; image via PhotoContext.

   LIVE mode passes `teacherClassOpts`/`teacherSubjectOpts` (the teacher's own
   teacher_assignments, real canonical ids — see LessonsScreen) — when
   given, the SAME segmented-picker visual style sources its options from
   them instead of the demo CLASS_OPTS/free-text subject field, and the
   picked class_id/subject_id are included in onSave. A teacher with zero
   assignments yet, or DEMO mode, falls back to the existing behaviour
   unchanged (the database itself is the real guard either way — an
   unassigned class/subject can never be saved regardless of what the UI
   offers). */
export default function LessonPrepModal({ visible, onClose, onSave, teacherClassOpts, teacherSubjectOpts }) {
  const { c } = useTheme();
  const { photos, pickPhoto } = usePhotos();
  const liveClassOpts = teacherClassOpts && teacherClassOpts.length ? teacherClassOpts : null;
  const liveSubjectOpts = teacherSubjectOpts && teacherSubjectOpts.length ? teacherSubjectOpts : null;
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectId, setSubjectId] = useState(liveSubjectOpts ? liveSubjectOpts[0].value : null);
  const [cls, setCls] = useState(liveClassOpts ? liveClassOpts[0].label : 'Form 5A');
  const [classId, setClassId] = useState(liveClassOpts ? liveClassOpts[0].value : null);
  const [topic, setTopic] = useState('');
  const [objectives, setObjectives] = useState('');
  const [materials, setMaterials] = useState('');
  const [duration, setDuration] = useState('');
  const [week, setWeek] = useState('');
  const [homework, setHomework] = useState('');
  const [notes, setNotes] = useState('');
  const [id] = useState(() => 'lesson_' + Math.floor(1000 + Math.random() * 9000));

  const cover = photos[id];
  const reset = () => {
    setTitle(''); setSubject(''); setTopic(''); setObjectives(''); setMaterials(''); setDuration(''); setWeek(''); setHomework(''); setNotes('');
    setCls(liveClassOpts ? liveClassOpts[0].label : 'Form 5A'); setClassId(liveClassOpts ? liveClassOpts[0].value : null);
    setSubjectId(liveSubjectOpts ? liveSubjectOpts[0].value : null);
  };
  const pickClass = (o) => { setCls(o.label); setClassId(o.value); };
  const pickSubject = (o) => { setSubject(o.label); setSubjectId(o.value); };

  const save = () => {
    if (!title.trim()) return;
    const subjectName = liveSubjectOpts ? (liveSubjectOpts.find((o) => o.value === subjectId) || {}).label : (subject.trim() || 'Maadda');
    onSave({ id, title: title.trim(), subject: subjectName || 'Maadda', subjectId, cls, classId, topic, objectives, materials, duration, week, homework, notes });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.ink }]}>Diyaarinta Casharka</Text>
              <Text style={[styles.sub, { color: c.muted }]}>Qorshe cashar oo dhammaystiran</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* cover photo / attachment */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => pickPhoto(id)} style={[styles.cover, { backgroundColor: c.bg, borderColor: c.line }]}>
              {cover ? (
                <Image source={{ uri: cover }} style={styles.coverImg} />
              ) : (
                <View style={styles.coverEmpty}>
                  <View style={[styles.camCircle, { backgroundColor: c.blueSoft }]}>
                    <Icon name="camera" size={22} color={c.blue} />
                  </View>
                  <Text style={[styles.coverHint, { color: c.muted }]}>Sawir / qalab cashar ku dar</Text>
                </View>
              )}
            </TouchableOpacity>

            <Field label="CINWAANKA CASHARKA" value={title} onChangeText={setTitle} placeholder="tusaale: Jajab & Boqolkiiba" />

            {liveSubjectOpts ? (
              <View style={{ marginBottom: 14 }}>
                <Text style={[styles.fLabel, { color: c.muted }]}>MAADDADA</Text>
                <View style={styles.seg}>
                  {liveSubjectOpts.map((o) => (
                    <TouchableOpacity key={o.value} onPress={() => pickSubject(o)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: subjectId === o.value ? c.blue : 'transparent' }]}>
                      <Text style={[styles.segTxt, { color: subjectId === o.value ? '#fff' : c.ink2 }]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <Field label="MAADDADA" value={subject} onChangeText={setSubject} placeholder="tusaale: Xisaab" />
            )}

            <Text style={[styles.fLabel, { color: c.muted }]}>FASALKA</Text>
            <View style={styles.seg}>
              {(liveClassOpts || CLASS_OPTS.map((o) => ({ value: o, label: o }))).map((o) => (
                <TouchableOpacity key={o.value} onPress={() => (liveClassOpts ? pickClass(o) : setCls(o.value))} style={[styles.segBtn, { borderColor: c.line, backgroundColor: cls === o.label ? c.blue : 'transparent' }]}>
                  <Text style={[styles.segTxt, { color: cls === o.label ? '#fff' : c.ink2 }]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ height: 14 }} />
            <Field label="CUTUBKA / MAWDUUCA" value={topic} onChangeText={setTopic} placeholder="tusaale: Cutubka 3 — Jajabka" />
            <Field label="UJEEDDOOYINKA CASHARKA" value={objectives} onChangeText={setObjectives} placeholder="Waxa ardaydu baran doonaan…" multiline />
            <Field label="QALABKA LOO BAAHAN YAHAY" value={materials} onChangeText={setMaterials} placeholder="tusaale: Sabuurad, buug, projector" multiline />

            <View style={styles.rowTwo}>
              <View style={{ flex: 1 }}>
                <Field label="MUDDADA (DAQIIQO)" value={duration} onChangeText={setDuration} placeholder="40" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="TODDOBAADKA" value={week} onChangeText={setWeek} placeholder="W3" />
              </View>
            </View>

            <Field label="HAWSHA GURIGA" value={homework} onChangeText={setHomework} placeholder="Shaqada guriga…" multiline />
            <Field label="QORAAL DHEERAAD AH" value={notes} onChangeText={setNotes} placeholder="Faallo macalin…" multiline />

            <View style={styles.foot}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]} onPress={onClose}>
                <Text style={[styles.btnTxt, { color: c.ink2 }]}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: title.trim() ? c.blue : c.muted2 }]} onPress={save} disabled={!title.trim()}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
                <Text style={[styles.btnTxt, { color: '#fff' }]}>Kaydi Casharka</Text>
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
  sheet: { maxHeight: '94%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  body: { padding: 20, paddingBottom: 36 },
  cover: { height: 130, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', overflow: 'hidden', marginBottom: 16 },
  coverImg: { width: '100%', height: '100%' },
  coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  camCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  coverHint: { fontSize: 13, fontWeight: '600' },
  field: { marginBottom: 14 },
  fLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 14 },
  area: { height: 70, paddingTop: 12, textAlignVertical: 'top' },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  segTxt: { fontSize: 12.5, fontWeight: '700' },
  rowTwo: { flexDirection: 'row', gap: 12 },
  foot: { flexDirection: 'row', gap: 12, marginTop: 18 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
