import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Avatar from './Avatar';
import Badge from './Badge';
import { shadow } from '../theme/colors';
import { summarizeStudentExams } from '../data/results';
import { getClassDisplayName } from '../data/identity';

const gradeOf = (p) => (p >= 80 ? 'A' : p >= 70 ? 'B' : p >= 60 ? 'C' : p >= 50 ? 'D' : 'F');

/* Read-only natiijo gradebook for ONE child — used by the Parent (and Student)
   exams view. Subjects as rows: dhibco, celcelis, grade, Gudbay/Dhacay, plus a
   header card (child identity + overall) and a per-term note when two terms. */
export default function ChildResultsGradebook({ child, results, subjects, terms }) {
  const { c } = useTheme();
  if (!child) return null;

  const summary = summarizeStudentExams(results, terms, subjects, child.student_internal_id);
  const rows = summary.map((s) => {
    const totalScore = s.terms.reduce((a, t) => a + (t.score || 0), 0);
    const totalFull = s.terms.reduce((a, t) => a + (t.full || 0), 0);
    return { ...s, totalScore, totalFull, pct: s.combined, passed: s.combined != null && s.combined >= 50 };
  });
  const pcts = rows.map((r) => r.pct).filter((n) => n != null);
  const overall = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;
  const allPass = rows.length > 0 && rows.every((r) => r.passed);

  return (
    <View style={{ marginBottom: 18 }}>
      {/* identity + overall header */}
      <View style={[styles.headCard, { backgroundColor: c.navy }, shadow.card]}>
        <Avatar name={child.name} code={child.student_internal_id} size={46} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.hName} numberOfLines={1}>{child.name}</Text>
          <Text style={styles.hMeta}>{child.student_id} · {getClassDisplayName(child.class_id)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.hPct}>{overall == null ? '—' : overall + '%'}</Text>
          <Text style={styles.hPctLbl}>Celcelis guud</Text>
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.emptyTxt, { color: c.muted }]}>Weli natiijo lama daabicin maaddooyinka ilmahaaga.</Text>
        </View>
      ) : (
        <View style={[styles.table, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
          <View style={[styles.tHead, { borderBottomColor: c.line }]}>
            <Text style={[styles.thMaadda, { color: c.muted }]}>MAADDA</Text>
            <Text style={[styles.thMid, { color: c.muted }]}>DHIBCO</Text>
            <Text style={[styles.thMid, { color: c.muted }]}>CELCELIS</Text>
            <Text style={[styles.thEnd, { color: c.muted }]}>NATIIJO</Text>
          </View>
          {rows.map((r, i) => {
            const tone = r.pct == null ? c.muted2 : r.passed ? c.green : c.rose;
            return (
              <View key={r.subject} style={[styles.tRow, { borderTopColor: c.line, backgroundColor: i % 2 ? c.bg : 'transparent' }]}>
                <View style={styles.tdMaadda}>
                  <Text style={[styles.subjName, { color: c.ink }]} numberOfLines={1}>{r.subject}</Text>
                  {r.terms.length >= 2 ? (
                    <Text style={[styles.termNote, { color: c.muted2 }]} numberOfLines={1}>
                      {r.terms.map((t) => `${t.term}: ${t.pct}%`).join('  ·  ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.tdMid, { color: c.ink2 }]}>{r.totalFull ? `${r.totalScore}/${r.totalFull}` : '—'}</Text>
                <Text style={[styles.tdMid, styles.pct, { color: tone }]}>{r.pct == null ? '—' : r.pct + '%'}</Text>
                <View style={styles.tdEnd}>
                  {r.pct == null ? <Text style={{ color: c.muted2 }}>—</Text> : (
                    <View style={[styles.gradeChip, { backgroundColor: tone }]}><Text style={styles.gradeTxt}>{gradeOf(r.pct)}</Text></View>
                  )}
                </View>
              </View>
            );
          })}
          {/* overall result row */}
          <View style={[styles.tFoot, { borderTopColor: c.line }]}>
            <Text style={[styles.footLbl, { color: c.ink }]}>Natiijada guud</Text>
            <Badge label={allPass ? 'GUDBAY' : 'DHACAY'} tone={allPass ? 'green' : 'rose'} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 14 },
  hName: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  hMeta: { color: 'rgba(255,255,255,.75)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  hPct: { color: '#fff', fontSize: 22, fontWeight: '900' },
  hPctLbl: { color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: '600' },
  empty: { borderWidth: 1, borderRadius: 14, padding: 18, marginTop: 10 },
  emptyTxt: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  table: { borderWidth: 1, borderRadius: 14, marginTop: 10, overflow: 'hidden' },
  tHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  thMaadda: { flex: 1, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  thMid: { width: 62, textAlign: 'center', fontSize: 10.5, fontWeight: '800' },
  thEnd: { width: 50, textAlign: 'right', fontSize: 10.5, fontWeight: '800' },
  tRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1 },
  tdMaadda: { flex: 1, paddingRight: 6 },
  subjName: { fontSize: 13.5, fontWeight: '700' },
  termNote: { fontSize: 10.5, fontWeight: '600', marginTop: 2 },
  tdMid: { width: 62, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  pct: { fontWeight: '800' },
  tdEnd: { width: 50, alignItems: 'flex-end' },
  gradeChip: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gradeTxt: { color: '#fff', fontSize: 12, fontWeight: '800' },
  tFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  footLbl: { fontSize: 13.5, fontWeight: '800' },
});
