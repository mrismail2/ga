import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { usePhotos } from '../context/PhotoContext';
import Avatar from './Avatar';
import Badge from './Badge';
import Icon from './Icon';
import { LESSON_STATUS } from '../data/datasets';

/* Read-only lesson-plan detail — opened from the "Faahfaahin" button on a
   lesson card. Shows the cover (if any) + every field the teacher prepared. */
function Section({ c, icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.section}>
      <View style={styles.secHead}>
        <Icon name={icon} size={14} color={c.muted} />
        <Text style={[styles.secLbl, { color: c.muted }]}>{label}</Text>
      </View>
      <Text style={[styles.secVal, { color: c.ink }]}>{value}</Text>
    </View>
  );
}

export default function LessonDetailModal({ visible, lesson, onClose, ministryMode = false, onFeedback }) {
  const { c } = useTheme();
  const { photos } = usePhotos();
  const [fbType, setFbType] = useState('cabasho');
  const [fbText, setFbText] = useState('');
  if (!lesson) return null;

  const st = LESSON_STATUS[lesson.status] || LESSON_STATUS.draft;
  const cover = lesson.id ? photos[lesson.id] : null;
  const feedback = lesson.ministry_feedback || [];

  const sendFeedback = () => {
    if (!fbText.trim() || !onFeedback) return;
    onFeedback(lesson.id, { type: fbType, text: fbText.trim(), at: 'Hadda' });
    setFbText('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={[styles.sheet, { backgroundColor: c.surface }]} activeOpacity={1}>
          <View style={[styles.head, { borderBottomColor: c.line }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: c.ink }]} numberOfLines={2}>{lesson.title}</Text>
              <Text style={[styles.sub, { color: c.muted }]}>{lesson.subject} · {lesson.cls}</Text>
            </View>
            <Badge label={st.label} tone={st.tone} />
            <TouchableOpacity onPress={onClose} hitSlop={10} style={{ marginLeft: 10 }}><Icon name="close" size={20} color={c.muted} /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {cover ? <Image source={{ uri: cover }} style={[styles.cover, { borderColor: c.line }]} resizeMode="cover" /> : null}

            {/* teacher + submission meta */}
            <View style={[styles.metaCard, { backgroundColor: c.bg, borderColor: c.line }]}>
              <Avatar name={lesson.teacher} code={lesson.teacher} size={36} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.metaName, { color: c.ink }]}>{lesson.teacher}</Text>
                <Text style={[styles.metaSub, { color: c.muted }]}>Macalinka diyaariyey</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.metaSub, { color: c.muted }]}>La soo gudbiyey</Text>
                <Text style={[styles.metaTime, { color: c.ink2 }]}>{lesson.submitted_at || '—'}</Text>
              </View>
            </View>

            <Section c={c} icon="lessons" label="CUTUBKA / MAWDUUCA" value={lesson.topic} />
            <Section c={c} icon="note" label="UJEEDDOOYINKA CASHARKA" value={lesson.objectives} />
            <Section c={c} icon="classes" label="QALABKA LOO BAAHAN YAHAY" value={lesson.materials} />

            <View style={styles.rowTwo}>
              <View style={[styles.miniCard, { backgroundColor: c.blueSoft }]}>
                <Icon name="clock" size={14} color={c.navy} />
                <Text style={[styles.miniVal, { color: c.navy }]}>{lesson.duration ? lesson.duration + ' daq' : '—'}</Text>
                <Text style={[styles.miniLbl, { color: c.navy }]}>Muddada</Text>
              </View>
              <View style={[styles.miniCard, { backgroundColor: c.goldSoft }]}>
                <Icon name="dashboard" size={14} color={c.gold700} />
                <Text style={[styles.miniVal, { color: c.gold700 }]}>{lesson.week || '—'}</Text>
                <Text style={[styles.miniLbl, { color: c.gold700 }]}>Toddobaadka</Text>
              </View>
            </View>

            <Section c={c} icon="edit" label="HAWSHA GURIGA" value={lesson.homework} />
            <Section c={c} icon="note" label="QORAAL DHEERAAD AH" value={lesson.notes} />

            {/* ministry feedback / complaints — visible to teacher, admin & ministry */}
            {feedback.length ? (
              <View style={{ marginTop: 4 }}>
                <View style={styles.secHead}>
                  <Icon name="shield" size={14} color={c.muted} />
                  <Text style={[styles.secLbl, { color: c.muted }]}>CABASHADA WASAARADDA ({feedback.length})</Text>
                </View>
                {feedback.map((f, i) => (
                  <View key={f.id || i} style={[styles.fbItem, { backgroundColor: f.type === 'cabasho' ? c.roseSoft : c.blueSoft, borderColor: c.line }]}>
                    <View style={styles.fbTop}>
                      <Badge label={f.type === 'cabasho' ? 'Cabasho' : 'Talo'} tone={f.type === 'cabasho' ? 'rose' : 'blue'} />
                      <Text style={[styles.fbMeta, { color: c.muted }]}>{f.by} · {f.at}</Text>
                    </View>
                    <Text style={[styles.fbText, { color: c.ink }]}>{f.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ministry composer — only inside the review portal */}
            {ministryMode ? (
              <View style={[styles.composer, { backgroundColor: c.bg, borderColor: c.line }]}>
                <Text style={[styles.secLbl, { color: c.muted, marginBottom: 8 }]}>U QOR MACALINKA</Text>
                <View style={styles.fbTypeRow}>
                  {[{ k: 'cabasho', label: 'Cabasho' }, { k: 'talo', label: 'Talo' }].map((o) => (
                    <TouchableOpacity key={o.k} onPress={() => setFbType(o.k)}
                      style={[styles.fbChip, { borderColor: c.line, backgroundColor: fbType === o.k ? c.navy : 'transparent' }]}>
                      <Text style={[styles.fbChipTxt, { color: fbType === o.k ? '#fff' : c.ink2 }]}>{o.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={fbText} onChangeText={setFbText} multiline
                  placeholder="Qor cabasho ama talo casharkan ku saabsan…" placeholderTextColor={c.muted2}
                  style={[styles.fbInput, { backgroundColor: c.surface, borderColor: c.line, color: c.ink }]}
                />
                <TouchableOpacity style={[styles.fbSend, { backgroundColor: fbText.trim() ? c.navy : c.muted2 }]} disabled={!fbText.trim()} onPress={sendFeedback}>
                  <Icon name="send" size={15} color="#fff" strokeWidth={2.2} />
                  <Text style={styles.fbSendTxt}>U dir macalinka</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!lesson.topic && !lesson.objectives && !lesson.materials && !lesson.homework && !lesson.notes ? (
              <Text style={[styles.emptyTxt, { color: c.muted }]}>Faahfaahin dheeraad ah lama gelin casharkan.</Text>
            ) : null}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontSize: 17.5, fontWeight: '800' },
  sub: { fontSize: 12.5, fontWeight: '600', marginTop: 3 },
  body: { padding: 20, paddingBottom: 36 },
  cover: { width: '100%', height: 150, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  metaCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 16 },
  metaName: { fontSize: 14, fontWeight: '800' },
  metaSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  metaTime: { fontSize: 12.5, fontWeight: '700', marginTop: 1 },
  section: { marginBottom: 16 },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  secLbl: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  secVal: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  rowTwo: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  miniCard: { flex: 1, alignItems: 'center', borderRadius: 14, paddingVertical: 14, gap: 3 },
  miniVal: { fontSize: 16, fontWeight: '800' },
  miniLbl: { fontSize: 11, fontWeight: '700' },
  emptyTxt: { fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 16 },
  fbItem: { borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 8 },
  fbTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fbMeta: { fontSize: 10.5, fontWeight: '600' },
  fbText: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  composer: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  fbTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  fbChip: { borderWidth: 1, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 16 },
  fbChipTxt: { fontSize: 12.5, fontWeight: '700' },
  fbInput: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, fontSize: 14, textAlignVertical: 'top' },
  fbSend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, marginTop: 10 },
  fbSendTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
