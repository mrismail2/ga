import React, { useState, useEffect } from 'react';
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

   LIVE mode passes `teacherAssignmentPairs` as an ARRAY of the teacher's
   own real, currently-active teacher_assignments (each entry:
   { classId, className, subjectId, subjectName }) — even when the teacher
   has zero assignments yet (an empty array, not null/undefined); that
   emptiness is the live-mode signal itself. DEMO mode passes neither
   (undefined), which is the only case that still uses the hardcoded
   CLASS_OPTS/free-text subject field.

   Pairs, not two independent lists, are the single source of truth: the
   class picker is built from the unique classes appearing in `pairs`, and
   picking a class filters the subject picker to ONLY the subjects that are
   actually paired with that class in teacher_assignments — an invalid
   combination (e.g. a class from one pair with a subject from another)
   can never be selected. Because `pairs` can arrive asynchronously AFTER
   the modal has already opened, a dedicated effect (re)initializes the
   selection whenever `pairs` changes: it clears a selection that is no
   longer valid and picks the first real pair once assignments actually
   exist, without ever clobbering a still-valid in-progress user choice.
   Live Mode with ZERO assignments (before or after loading finishes) shows
   an honest empty/disabled state (reusing the existing dashed-box style
   used for the cover-photo empty state below) instead of any demo class or
   free-text subject, and Save stays disabled — no classless/subjectless/
   invalid-pair plan can ever be submitted from this modal. The database
   itself remains the real guard either way. */
export default function LessonPrepModal({ visible, onClose, onSave, teacherAssignmentPairs }) {
  const { c } = useTheme();
  const { photos, pickPhoto } = usePhotos();
  const isLiveAssignmentMode = Array.isArray(teacherAssignmentPairs);
  const pairs = isLiveAssignmentMode ? teacherAssignmentPairs : [];
  const liveHasNoAssignments = isLiveAssignmentMode && pairs.length === 0;
  const classOptions = isLiveAssignmentMode
    ? [...new Map(pairs.map((p) => [p.classId, { value: p.classId, label: p.className }])).values()]
    : [];

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectId, setSubjectId] = useState(null);
  const [cls, setCls] = useState(isLiveAssignmentMode ? '' : 'Form 5A');
  const [classId, setClassId] = useState(null);
  const [topic, setTopic] = useState('');
  const [objectives, setObjectives] = useState('');
  const [materials, setMaterials] = useState('');
  const [duration, setDuration] = useState('');
  const [week, setWeek] = useState('');
  const [homework, setHomework] = useState('');
  const [notes, setNotes] = useState('');
  const [id] = useState(() => 'lesson_' + Math.floor(1000 + Math.random() * 9000));

  // Live Mode only: (re)initialize the class+subject selection whenever the
  // real assignment pairs change (they may still be loading when the modal
  // first opens). A currently-selected pair that's still valid is left
  // alone; an invalid/stale one is cleared or replaced by the first real
  // pair, so a delayed arrival of assignments never leaves a null
  // selection behind once real options exist.
  useEffect(() => {
    if (!isLiveAssignmentMode) return;
    setClassId((prevClassId) => {
      const keepClass = pairs.some((p) => p.classId === prevClassId);
      const nextClassId = keepClass ? prevClassId : (pairs[0] ? pairs[0].classId : null);

      setSubjectId((prevSubjectId) => {
        const keepPair = pairs.some((p) => p.classId === nextClassId && p.subjectId === prevSubjectId);
        if (keepPair) return prevSubjectId;
        const firstForClass = pairs.find((p) => p.classId === nextClassId);
        return firstForClass ? firstForClass.subjectId : null;
      });

      const matchedClass = pairs.find((p) => p.classId === nextClassId);
      setCls(matchedClass ? matchedClass.className : '');

      return nextClassId;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLiveAssignmentMode, JSON.stringify(pairs)]);

  const cover = photos[id];
  const reset = () => {
    setTitle(''); setSubject(''); setTopic(''); setObjectives(''); setMaterials(''); setDuration(''); setWeek(''); setHomework(''); setNotes('');
    if (isLiveAssignmentMode) {
      setCls(pairs.length ? pairs[0].className : ''); setClassId(pairs.length ? pairs[0].classId : null);
      setSubjectId(pairs.length ? pairs[0].subjectId : null);
    } else {
      setCls('Form 5A'); setClassId(null); setSubjectId(null);
    }
  };
  // picking a class always snaps the subject to a real pair for that class
  // (the subject list rendered below is already filtered to it, but this
  // keeps state consistent even if called programmatically)
  const pickClass = (o) => {
    setClassId(o.value);
    const match = pairs.find((p) => p.classId === o.value);
    setCls(o.label);
    setSubjectId(match ? match.subjectId : null);
  };
  const pickSubject = (o) => { setSubject(o.label); setSubjectId(o.value); };

  const subjectOptionsForClass = isLiveAssignmentMode
    ? pairs.filter((p) => p.classId === classId).map((p) => ({ value: p.subjectId, label: p.subjectName }))
    : [];
  const hasValidLivePair = !isLiveAssignmentMode || pairs.some((p) => p.classId === classId && p.subjectId === subjectId);

  const canSave = !!title.trim() && !liveHasNoAssignments && hasValidLivePair;
  const save = () => {
    if (!canSave) return;
    const subjectName = isLiveAssignmentMode ? (pairs.find((p) => p.subjectId === subjectId) || {}).subjectName : (subject.trim() || 'Maadda');
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

            {isLiveAssignmentMode ? (
              liveHasNoAssignments ? (
                <View style={styles.field}>
                  <Text style={[styles.fLabel, { color: c.muted }]}>MAADDADA & FASALKA</Text>
                  <View style={[styles.cover, styles.noAssignBox, { backgroundColor: c.bg, borderColor: c.line }]}>
                    <Text style={[styles.coverHint, { color: c.muted, textAlign: 'center' }]}>
                      Wali lagama xilsaarin fasal ama maaddo. La xiriir maamulaha dugsiga si laguugu xilsaariyo, kadibna soo noqo si aad cashar u qorto.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {/* class first — picking it determines which subjects are offered below */}
                  <Text style={[styles.fLabel, { color: c.muted }]}>FASALKA</Text>
                  <View style={styles.seg}>
                    {classOptions.map((o) => (
                      <TouchableOpacity key={o.value} onPress={() => pickClass(o)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: classId === o.value ? c.blue : 'transparent' }]}>
                        <Text style={[styles.segTxt, { color: classId === o.value ? '#fff' : c.ink2 }]}>{o.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={{ height: 14 }} />
                  <Text style={[styles.fLabel, { color: c.muted }]}>MAADDADA</Text>
                  <View style={styles.seg}>
                    {subjectOptionsForClass.map((o) => (
                      <TouchableOpacity key={o.value} onPress={() => pickSubject(o)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: subjectId === o.value ? c.blue : 'transparent' }]}>
                        <Text style={[styles.segTxt, { color: subjectId === o.value ? '#fff' : c.ink2 }]}>{o.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )
            ) : (
              <>
                <Field label="MAADDADA" value={subject} onChangeText={setSubject} placeholder="tusaale: Xisaab" />
                <Text style={[styles.fLabel, { color: c.muted }]}>FASALKA</Text>
                <View style={styles.seg}>
                  {CLASS_OPTS.map((o) => (
                    <TouchableOpacity key={o} onPress={() => setCls(o)} style={[styles.segBtn, { borderColor: c.line, backgroundColor: cls === o ? c.blue : 'transparent' }]}>
                      <Text style={[styles.segTxt, { color: cls === o ? '#fff' : c.ink2 }]}>{o}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

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
              <TouchableOpacity style={[styles.btn, { backgroundColor: canSave ? c.blue : c.muted2 }]} onPress={save} disabled={!canSave}>
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
  noAssignBox: { height: 'auto', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 16 },
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
