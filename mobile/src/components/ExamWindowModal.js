import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Icon from './Icon';

const MARK_OPTIONS = [25, 50, 100];

/* Admin opens ONE exam window: pick a teacher → one of THAT teacher's assigned
   subjects → a term → the marks total (25/50/100). Subject choices cascade from
   the selected teacher, so a teacher can never be opened for a subject they do
   not teach. Marks total is locked here by the admin. */
export default function ExamWindowModal({ visible, teachers = [], subjects = [], terms = [], onClose, onSubmit }) {
  const { c } = useTheme();
  const [teacherId, setTeacherId] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [termId, setTermId] = useState(null);
  const [fullMarks, setFullMarks] = useState(100);

  useEffect(() => {
    if (visible) { setTeacherId(null); setSubjectId(null); setTermId(null); setFullMarks(100); }
  }, [visible]);

  const subjectName = (sid) => (subjects.find((s) => s.subject_id === sid) || {}).name || sid;
  const teacher = teachers.find((t) => t.teacher_id === teacherId) || null;
  const teacherSubjectIds = useMemo(() => (teacher ? (teacher.assigned_subject_ids || []) : []), [teacher]);

  const ok = teacherId && subjectId && termId && fullMarks;
  const submit = () => { if (!ok) return; onSubmit({ teacherId, subjectId, termId, fullMarks }); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.ink }]}>Fur Ogolaansho Imtixaan</Text>
              <Text style={[styles.sub, { color: c.muted }]}>Macalin · Maadda · Term · Dhibco</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* 1 — teacher */}
            <Text style={[styles.lbl, { color: c.muted }]}>MACALINKA</Text>
            <View style={styles.chips}>
              {teachers.map((t) => {
                const on = teacherId === t.teacher_id;
                const has = (t.assigned_subject_ids || []).length > 0;
                return (
                  <TouchableOpacity key={t.teacher_id} disabled={!has}
                    onPress={() => { setTeacherId(t.teacher_id); setSubjectId(null); }}
                    style={[styles.chip, { borderColor: c.line, backgroundColor: on ? c.blue : 'transparent', opacity: has ? 1 : 0.4 }]}>
                    <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>{t.teacher_name || t.teacher_id}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 2 — subject (cascades from teacher) */}
            <Text style={[styles.lbl, { color: c.muted, marginTop: 16 }]}>MAADDADA (la qoondeeyay)</Text>
            {teacher ? (
              teacherSubjectIds.length ? (
                <View style={styles.chips}>
                  {teacherSubjectIds.map((sid) => {
                    const on = subjectId === sid;
                    return (
                      <TouchableOpacity key={sid} onPress={() => setSubjectId(sid)}
                        style={[styles.chip, { borderColor: c.line, backgroundColor: on ? c.navy : 'transparent' }]}>
                        <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>{subjectName(sid)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : <Text style={[styles.hint, { color: c.muted2 }]}>Macalinkan maadda canonical looma qoondayn.</Text>
            ) : <Text style={[styles.hint, { color: c.muted2 }]}>Marka hore dooro macalin.</Text>}

            {/* 3 — term */}
            <Text style={[styles.lbl, { color: c.muted, marginTop: 16 }]}>TERM-KA</Text>
            <View style={styles.chips}>
              {terms.map((t) => {
                const on = termId === t.term_id;
                return (
                  <TouchableOpacity key={t.term_id} onPress={() => setTermId(t.term_id)}
                    style={[styles.chip, { borderColor: c.line, backgroundColor: on ? c.gold700 : 'transparent' }]}>
                    <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 4 — marks total (admin locks) */}
            <Text style={[styles.lbl, { color: c.muted, marginTop: 16 }]}>CADADKA BUUXA (maamulaha ayaa xidha)</Text>
            <View style={styles.chips}>
              {MARK_OPTIONS.map((m) => {
                const on = fullMarks === m;
                return (
                  <TouchableOpacity key={m} onPress={() => setFullMarks(m)}
                    style={[styles.chip, styles.markChip, { borderColor: c.line, backgroundColor: on ? c.green : 'transparent' }]}>
                    <Text style={[styles.chipTxt, { color: on ? '#fff' : c.ink2 }]}>/{m}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.foot}>
              <TouchableOpacity style={[styles.btn, { backgroundColor: c.bg, borderColor: c.line, borderWidth: 1 }]} onPress={onClose}>
                <Text style={[styles.btnTxt, { color: c.ink2 }]}>Jooji</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { backgroundColor: ok ? c.blue : c.muted2 }]} onPress={submit} disabled={!ok}>
                <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
                <Text style={[styles.btnTxt, { color: '#fff' }]}>Fur Ogolaanshaha</Text>
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
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  body: { padding: 20, paddingBottom: 36 },
  lbl: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  hint: { fontSize: 12.5, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13 },
  markChip: { minWidth: 56, alignItems: 'center' },
  chipTxt: { fontSize: 12.5, fontWeight: '700' },
  foot: { flexDirection: 'row', gap: 12, marginTop: 22 },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 12 },
  btnTxt: { fontSize: 14.5, fontWeight: '700' },
});
