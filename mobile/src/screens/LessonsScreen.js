import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import LessonPrepModal from '../components/LessonPrepModal';
import LessonDetailModal from '../components/LessonDetailModal';
import { LESSON_STATUS } from '../data/datasets';
import { useLessons } from '../context/LessonsContext';
import { shadow } from '../theme/colors';

const STATUS_COLOR = (c) => ({ approved: c.green, pending: c.gold700, draft: c.blue, rejected: c.rose });

/* Casharrada — lesson plans with an admin approval workflow.
   - Teacher: prepares a plan (Qabyo) then submits it for review (La sugayo).
   - School/Super Admin: reviews submitted plans and Approves / Rejects.
   Status flow: draft → pending → approved | rejected. */
export default function LessonsScreen({ navigation }) {
  const { c } = useTheme();
  const { role, profile } = useRole();
  const { lessons, reviewCode, setLessonStatus, addLesson: addLessonCtx } = useLessons();
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState(null);
  const [filter, setFilter] = useState('all');
  const [showCode, setShowCode] = useState(false);

  const canApprove = role === 'superadmin' || role === 'schooladmin';
  const isTeacher = role === 'teacher';
  const sColor = STATUS_COLOR(c);

  const counts = useMemo(() => ({
    pending: lessons.filter((l) => l.status === 'pending').length,
    approved: lessons.filter((l) => l.status === 'approved').length,
    draft: lessons.filter((l) => l.status === 'draft').length,
  }), [lessons]);

  const setStatus = (id, status) => setLessonStatus(id, status);
  const addLesson = (v) => addLessonCtx(v, profile.name);

  const shown = filter === 'all' ? lessons : lessons.filter((l) => l.status === filter);

  const SummaryCell = ({ value, label, color, k }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => setFilter(filter === k ? 'all' : k)}
      style={[styles.sumCell, { backgroundColor: c.surface, borderColor: filter === k ? color : c.line }, shadow.sm]}>
      <Text style={[styles.sumVal, { color }]}>{value}</Text>
      <Text style={[styles.sumLbl, { color: c.muted }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title="Casharrada"
          subtitle={canApprove ? `${counts.pending} sugaya ansixinta · ${lessons.length} guud` : `${lessons.length} cashar · diyaarinta`}
          right={navigation ? (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={20} color={c.ink} />
            </TouchableOpacity>
          ) : null}
        />

        {/* status summary — tap a cell to filter */}
        <View style={styles.summary}>
          <SummaryCell k="pending" value={counts.pending} label="La sugayo" color={c.gold700} />
          <SummaryCell k="approved" value={counts.approved} label="La ansixiyay" color={c.green} />
          <SummaryCell k="draft" value={counts.draft} label="Qabyo" color={c.blue} />
        </View>

        {canApprove ? (
          <View style={[styles.hint, { backgroundColor: c.blueSoft }]}>
            <Icon name="shield" size={14} color={c.navy} />
            <Text style={[styles.hintTxt, { color: c.navy }]}>Dib u eeg casharrada macalimiintu soo gudbiyeen, kana ansixi ama diid.</Text>
          </View>
        ) : null}

        {/* invite the Ministry — reveal the read-only review code to share */}
        {(canApprove || isTeacher) ? (
          <View style={[styles.minCard, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
            <View style={[styles.minIcon, { backgroundColor: c.greenSoft }]}>
              <Icon name="shield" size={16} color={c.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.minTitle, { color: c.ink }]}>Eegista Wasaaradda</Text>
              {showCode ? (
                <Text style={[styles.minCode, { color: c.green }]}>{reviewCode}</Text>
              ) : (
                <Text style={[styles.minDesc, { color: c.muted }]}>Lambarkan ayay wasaaraddu ku eegi kartaa casharrada la ansixiyay iyo xogta guud ee dugsiga (ardayda, macallimiinta iyo xaadiriska).</Text>
              )}
            </View>
            <TouchableOpacity style={[styles.minBtn, { backgroundColor: showCode ? c.green : c.navy }]} activeOpacity={0.85} onPress={() => setShowCode((s) => !s)}>
              <Text style={styles.minBtnTxt}>{showCode ? 'Qari' : 'Casuumo'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FlatList
          data={shown}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>🗂️ Cashar lama helin</Text>}
          renderItem={({ item }) => {
            const st = LESSON_STATUS[item.status] || LESSON_STATUS.draft;
            const accent = sColor[item.status] || c.blue;
            return (
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <View style={[styles.accent, { backgroundColor: accent }]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{item.title}</Text>
                    <Badge label={st.label} tone={st.tone} />
                  </View>
                  <View style={styles.metaRow}>
                    <Icon name="lessons" size={13} color={c.muted} />
                    <Text style={[styles.meta, { color: c.muted }]} numberOfLines={1}>{item.subject} · {item.cls}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Avatar name={item.teacher} code={item.teacher} size={22} />
                    <Text style={[styles.meta, { color: c.ink2 }]} numberOfLines={1}>{item.teacher}</Text>
                    <Text style={[styles.dot, { color: c.muted2 }]}>·</Text>
                    <Icon name="clock" size={12} color={c.muted2} />
                    <Text style={[styles.metaTime, { color: c.muted2 }]}>{item.submitted_at}</Text>
                  </View>

                  {/* view full plan — always available */}
                  <TouchableOpacity style={[styles.detailBtn, { backgroundColor: c.bg, borderColor: c.line }]} activeOpacity={0.8} onPress={() => setDetail(item)}>
                    <Icon name="note" size={14} color={c.navy} strokeWidth={2} />
                    <Text style={[styles.detailTxt, { color: c.navy }]}>Faahfaahinta Casharka</Text>
                    <Icon name="chevronRight" size={15} color={c.muted} />
                  </TouchableOpacity>

                  {/* role-aware actions */}
                  {canApprove && item.status === 'pending' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.green }]} activeOpacity={0.85} onPress={() => setStatus(item.id, 'approved')}>
                        <Icon name="check" size={15} color="#fff" strokeWidth={2.4} />
                        <Text style={styles.actTxt}>Ansixi</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.surface, borderColor: c.rose, borderWidth: 1.5 }]} activeOpacity={0.85} onPress={() => setStatus(item.id, 'rejected')}>
                        <Icon name="close" size={15} color={c.rose} strokeWidth={2.4} />
                        <Text style={[styles.actTxt, { color: c.rose }]}>Diid</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isTeacher && (item.status === 'draft' || item.status === 'rejected') ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.blue }]} activeOpacity={0.85} onPress={() => setStatus(item.id, 'pending')}>
                        <Icon name="send" size={14} color="#fff" strokeWidth={2.2} />
                        <Text style={styles.actTxt}>Soo gudbi ansixin</Text>
                      </TouchableOpacity>
                    </View>
                  ) : item.status === 'approved' ? (
                    <View style={[styles.statusNote, { borderTopColor: c.line }]}>
                      <Icon name="check" size={13} color={c.green} strokeWidth={2.4} />
                      <Text style={[styles.noteTxt, { color: c.green }]}>Maamulaha ayaa ansixiyay</Text>
                    </View>
                  ) : item.status === 'pending' ? (
                    <View style={[styles.statusNote, { borderTopColor: c.line }]}>
                      <Icon name="clock" size={13} color={c.gold700} />
                      <Text style={[styles.noteTxt, { color: c.gold700 }]}>Sugaya ansixinta maamulaha</Text>
                    </View>
                  ) : item.status === 'rejected' ? (
                    <View style={[styles.statusNote, { borderTopColor: c.line }]}>
                      <Icon name="close" size={13} color={c.rose} strokeWidth={2.4} />
                      <Text style={[styles.noteTxt, { color: c.rose }]}>La diiday — dib u eeg oo soo gudbi</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          }}
        />
      </View>

      <TouchableOpacity style={[styles.fab, { backgroundColor: c.blue }, shadow.card]} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
        <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
      </TouchableOpacity>

      <LessonPrepModal visible={showAdd} onClose={() => setShowAdd(false)} onSave={addLesson} />
      <LessonDetailModal visible={!!detail} lesson={detail} onClose={() => setDetail(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  sumCell: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingVertical: 14 },
  sumVal: { fontSize: 22, fontWeight: '800' },
  sumLbl: { fontSize: 11, fontWeight: '700', marginTop: 3 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, marginBottom: 14 },
  hintTxt: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  minCard: { flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 14 },
  minIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  minTitle: { fontSize: 13.5, fontWeight: '800' },
  minDesc: { fontSize: 11.5, fontWeight: '600', marginTop: 2, lineHeight: 15 },
  minCode: { fontSize: 16, fontWeight: '900', marginTop: 2, fontFamily: 'monospace', letterSpacing: 1 },
  minBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10 },
  minBtnTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  card: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
  accent: { width: 5 },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15.5, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  meta: { fontSize: 12.5, fontWeight: '600' },
  metaTime: { fontSize: 11.5, fontWeight: '600' },
  dot: { fontSize: 13, fontWeight: '800', marginHorizontal: 1 },
  detailBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1 },
  detailTxt: { flex: 1, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 11, borderRadius: 11 },
  actTxt: { color: '#fff', fontSize: 13.5, fontWeight: '700' },
  statusNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, paddingTop: 10, borderTopWidth: 1 },
  noteTxt: { fontSize: 12, fontWeight: '700' },
  empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 30 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
