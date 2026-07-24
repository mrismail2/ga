import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Icon from './Icon';
import Avatar from './Avatar';
import { getStudentsByClass } from '../services/appDataRepository';

// letter grade from a percentage (matches results.js)
const gradeOf = (p) => (p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F');

/* Teacher marks entry.
   - When `fullMarks` is given (the admin-locked total: 25/50/100) the modal runs
     in SINGLE-COLUMN mode: one score per student out of fullMarks, and CELCELIS
     is the auto percentage (score / fullMarks).
   - Otherwise it falls back to the legacy two-term mode (Term 1 + Term 2 averaged).
   The roster comes from the ONE central store (school_id + class_id). */
export default function ExamMarksModal({ visible, subject, className, schoolId, classId, fullMarks, termLabel, onClose, onSave }) {
  const { c } = useTheme();
  const single = fullMarks != null;
  const [roster, setRoster] = useState([]);
  const [marks, setMarks] = useState({}); // internal_id -> single { score } | legacy { t1, t2 }

  useEffect(() => {
    if (visible && schoolId && classId) {
      let alive = true;
      getStudentsByClass(schoolId, classId).then((rows) => { if (alive) setRoster((rows || []).slice(0, 12)); });
      setMarks({});
      return () => { alive = false; };
    }
    if (visible) { setRoster([]); setMarks({}); }
  }, [visible, schoolId, classId]);

  // single-column setter — clamp to the admin-locked full marks
  const setScore = (id, val) => {
    let v = val.replace(/[^0-9]/g, '').slice(0, 3);
    if (v !== '' && fullMarks != null && parseInt(v, 10) > fullMarks) v = String(fullMarks);
    setMarks((m) => ({ ...m, [id]: { score: v } }));
  };
  // legacy two-term setter
  const setTerm = (id, term, val) => {
    const v = val.replace(/[^0-9]/g, '').slice(0, 3);
    setMarks((m) => ({ ...m, [id]: { ...(m[id] || {}), [term]: v } }));
  };

  // percentage for one student (single → score/fullMarks; legacy → avg of two terms)
  const pctOf = (id) => {
    const m = marks[id] || {};
    if (single) {
      const s = parseInt(m.score, 10);
      if (isNaN(s)) return null;
      return Math.round((s / fullMarks) * 100);
    }
    const t1 = parseInt(m.t1, 10);
    const t2 = parseInt(m.t2, 10);
    const vals = [t1, t2].filter((n) => !isNaN(n));
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };

  const classAvg = (() => {
    const all = roster.map((s) => pctOf(s.student_internal_id)).filter((n) => n != null);
    if (!all.length) return null;
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  })();

  // progress: how many of the roster already have a mark
  const enteredCount = roster.filter((s) => pctOf(s.student_internal_id) != null).length;
  const total = roster.length || 1;
  const passCount = roster.filter((s) => { const p = pctOf(s.student_internal_id); return p != null && p >= 50; }).length;

  // per-student rows to persist (skip blanks)
  const buildEntries = () => roster.map((s) => {
    const id = s.student_internal_id;
    const m = marks[id] || {};
    if (single) {
      const score = parseInt(m.score, 10);
      if (isNaN(score)) return null;
      return { student_internal_id: id, score, full_marks: fullMarks, percentage: Math.round((score / fullMarks) * 100) };
    }
    const pct = pctOf(id);
    if (pct == null) return null;
    return { student_internal_id: id, score: pct, full_marks: 100, percentage: pct };
  }).filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <View style={[styles.headIcon, { backgroundColor: c.blueSoft }]}>
              <Icon name="exams" size={18} color={c.navy} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.ink }]}>Geli Dhibcaha</Text>
              <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>
                {subject} · {className}{single ? ` · ${termLabel || ''}` : ''}
              </Text>
            </View>
            {single ? <View style={[styles.markPill, { backgroundColor: c.navy }]}><Text style={styles.markPillTxt}>/{fullMarks}</Text></View> : null}
            <TouchableOpacity onPress={onClose} hitSlop={10} style={{ marginLeft: 8 }}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
          </View>

          {/* progress strip */}
          <View style={styles.progWrap}>
            <View style={styles.progTop}>
              <Text style={[styles.progLbl, { color: c.muted }]}>La galiyay</Text>
              <Text style={[styles.progVal, { color: c.ink }]}>{enteredCount}/{total}</Text>
            </View>
            <View style={[styles.progBar, { backgroundColor: c.line }]}>
              <View style={[styles.progFill, { backgroundColor: enteredCount === total ? c.green : c.blue, width: `${Math.round((enteredCount / total) * 100)}%` }]} />
            </View>
          </View>

          {/* column headers */}
          <View style={[styles.colHead, { borderBottomColor: c.line }]}>
            <Text style={[styles.chName, { color: c.muted }]}>ARDAYGA</Text>
            {single ? (
              <Text style={[styles.chTerm, { color: c.muted }]}>DHIBCO</Text>
            ) : (
              <>
                <Text style={[styles.chTerm, { color: c.muted }]}>TERM 1</Text>
                <Text style={[styles.chTerm, { color: c.muted }]}>TERM 2</Text>
              </>
            )}
            <Text style={[styles.chAvg, { color: c.muted }]}>NATIIJO</Text>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
            {roster.map((s) => {
              const id = s.student_internal_id;
              const pct = pctOf(id);
              const tone = pct == null ? c.muted2 : pct >= 50 ? c.green : c.rose;
              return (
                <View key={id} style={[styles.row, { borderBottomColor: c.line }]}>
                  <Avatar name={s.name} code={id} size={32} />
                  <Text style={[styles.name, { color: c.ink }]} numberOfLines={1}>{s.name}</Text>
                  {single ? (
                    <TextInput
                      value={(marks[id] || {}).score || ''}
                      onChangeText={(v) => setScore(id, v)}
                      keyboardType="number-pad" placeholder="—" placeholderTextColor={c.muted2}
                      style={[styles.input, styles.inputWide, { backgroundColor: c.bg, borderColor: pct == null ? c.line : tone, color: c.ink }]}
                    />
                  ) : (
                    <>
                      <TextInput
                        value={(marks[id] || {}).t1 || ''}
                        onChangeText={(v) => setTerm(id, 't1', v)}
                        keyboardType="number-pad" placeholder="—" placeholderTextColor={c.muted2}
                        style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
                      />
                      <TextInput
                        value={(marks[id] || {}).t2 || ''}
                        onChangeText={(v) => setTerm(id, 't2', v)}
                        keyboardType="number-pad" placeholder="—" placeholderTextColor={c.muted2}
                        style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]}
                      />
                    </>
                  )}
                  <View style={styles.resultCell}>
                    {pct == null ? (
                      <Text style={[styles.avg, { color: c.muted2 }]}>—</Text>
                    ) : (
                      <>
                        <Text style={[styles.avg, { color: tone }]}>{pct}%</Text>
                        <View style={[styles.gradeChip, { backgroundColor: tone }]}><Text style={styles.gradeTxt}>{gradeOf(pct)}</Text></View>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.foot, { borderTopColor: c.line }]}>
            <View style={styles.footStats}>
              <View>
                <Text style={[styles.fLbl, { color: c.muted }]}>Celcelis fasalka</Text>
                <Text style={[styles.fVal, { color: c.navy }]}>{classAvg == null ? '—' : classAvg + '%'}</Text>
              </View>
              <View style={[styles.footDiv, { backgroundColor: c.line }]} />
              <View>
                <Text style={[styles.fLbl, { color: c.muted }]}>Gudbay</Text>
                <Text style={[styles.fVal, { color: c.green, fontSize: 18 }]}>{enteredCount ? `${passCount}/${enteredCount}` : '—'}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: classAvg == null ? c.muted2 : c.blue }]} disabled={classAvg == null} onPress={() => { onSave && onSave({ average: classAvg, entries: buildEntries() }); onClose(); }}>
              <Icon name="check" size={16} color="#fff" strokeWidth={2.2} />
              <Text style={styles.saveTxt}>Kaydi</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1 },
  headIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
  markPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 9 },
  markPillTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  progWrap: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  progTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progLbl: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  progVal: { fontSize: 12.5, fontWeight: '800' },
  progBar: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progFill: { height: 7, borderRadius: 4 },
  colHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: 1 },
  chName: { flex: 1, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.3, marginLeft: 40 },
  chTerm: { width: 56, textAlign: 'center', fontSize: 10.5, fontWeight: '700' },
  chAvg: { width: 78, textAlign: 'right', fontSize: 10.5, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, gap: 8 },
  name: { flex: 1, fontSize: 13, fontWeight: '700' },
  input: { width: 50, height: 40, borderWidth: 1.5, borderRadius: 10, textAlign: 'center', fontSize: 15, fontWeight: '800' },
  inputWide: { width: 70 },
  resultCell: { width: 78, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  avg: { fontSize: 14.5, fontWeight: '800' },
  gradeChip: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  gradeTxt: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderTopWidth: 1 },
  footStats: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  footDiv: { width: 1, height: 30 },
  fLbl: { fontSize: 11, fontWeight: '600' },
  fVal: { fontSize: 22, fontWeight: '800' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 13, paddingHorizontal: 22, borderRadius: 12 },
  saveTxt: { color: '#fff', fontSize: 14.5, fontWeight: '700' },
});
