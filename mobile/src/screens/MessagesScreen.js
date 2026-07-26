import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, View, Text, Image, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { shadow } from '../theme/colors';
import { MESSAGES } from '../data/datasets';
import { filterMessagesForProfile, hasPermission } from '../data/access';
import { pickStudentImageFromGallery } from '../services/studentPhotoStorage';
import { listMyConversations, listConversationMessages, sendConversationMessage, markConversationRead } from '../services/messaging';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from '../components/SchoolSelector';

const firstName = (s) => String(s || '').replace(/\(.*\)/, '').trim().split(' ')[0];

// a short seed conversation per contact (text + a voice note, like the design)
function seedThread(msg) {
  return [
    { me: false, text: msg.preview, time: msg.time },
    { me: true, text: 'Waad mahadsantahay, waan eegayaa.', time: msg.time },
    { me: false, voice: true, dur: '0:08', time: msg.time },
    { me: true, text: 'Hagaag, mahadsanid.', time: msg.time },
  ];
}

/* Teacher ↔ Student messaging only. Parent and Accountant never reach this
   screen (not in their nav). Admin / Super Admin see a moderation summary —
   message bodies are hidden by default.

   DEMO mode: the Phase 1/2 seeded preview threads, unchanged.

   LIVE mode: ONLY the canonical conversations / conversation_members /
   messages rows (services/messaging.js) — the demo MESSAGES array is never
   used. An empty school shows “Weli wada-hadal ma jiro.”; unread state
   comes from last_read_at; text messages persist after refresh; voice and
   photo attachments are DISABLED (never simulated) in Live Mode. */
export default function MessagesScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive, profile: liveProfile } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const [open, setOpen] = useState(null);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recTimer = useRef(null);
  const convRequestSeq = useRef(0);
  const threadRequestSeq = useRef(0);

  // LIVE canonical conversations are always scoped to the resolved active
  // school. No selection means no query and no demo fallback.
  const profileId = isLive && liveProfile ? liveProfile.id : null;
  const [liveConvs, setLiveConvs] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const reloadConvs = useCallback(async () => {
    const requestId = ++convRequestSeq.current;
    setLiveConvs([]); setConvError(null);
    if (!isLive || !profileId || !schoolId) { setConvLoading(false); return; }
    setConvLoading(true);
    try {
      const rows = await listMyConversations(profileId, schoolId);
      if (convRequestSeq.current === requestId) setLiveConvs(rows);
    } catch (e) {
      if (convRequestSeq.current === requestId) { setLiveConvs([]); setConvError((e && e.message) || 'Wada-hadallada lama soo dejin karin.'); }
    } finally {
      if (convRequestSeq.current === requestId) setConvLoading(false);
    }
  }, [isLive, profileId, schoolId]);

  // Switching schools must clear every piece of School A state immediately.
  useEffect(() => {
    threadRequestSeq.current += 1;
    setOpen(null); setThread([]); setDraft(''); setQ('');
    setThreadError(null); setSendError(null); setSending(false);
    setRecording(false); setRecSecs(0);
    reloadConvs();
    return () => { convRequestSeq.current += 1; threadRequestSeq.current += 1; };
  }, [reloadConvs]);

  const moderator = profile.scope === 'platform' || profile.scope === 'school';
  const canSend = isLive ? Boolean(profileId && schoolId) : (hasPermission(profile, 'messages.send') || profile.scope === 'self');
  // photo / voice must never SIMULATE success — live mode disables them
  const canAttach = canSend && !isLive;
  const all = isLive ? liveConvs : filterMessagesForProfile(profile, MESSAGES);
  const list = all.filter((m) => m.from.toLowerCase().includes(q.toLowerCase()));
  const unread = all.filter((m) => m.unread).length;

  // live recording timer (frontend preview — no real audio capture)
  useEffect(() => {
    if (recording) { recTimer.current = setInterval(() => setRecSecs((s) => s + 1), 1000); }
    return () => clearInterval(recTimer.current);
  }, [recording]);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const openThread = async (msg) => {
    if (moderator && !isLive) return;
    setOpen(msg); setDraft(''); setRecording(false); setRecSecs(0); setThreadError(null); setSendError(null);
    if (isLive) {
      if (!profileId || !schoolId) return;
      const requestId = ++threadRequestSeq.current;
      const expectedSchool = schoolId;
      setThread([]); setThreadLoading(true);
      try {
        const msgs = await listConversationMessages(msg.id, profileId, expectedSchool);
        if (threadRequestSeq.current !== requestId || schoolId !== expectedSchool) return;
        setThread(msgs);
        await markConversationRead(msg.id, profileId, expectedSchool);
        reloadConvs();
      } catch (e) {
        if (threadRequestSeq.current === requestId) { setThread([]); setThreadError((e && e.message) || 'Fariimaha lama soo dejin karin.'); }
      } finally {
        if (threadRequestSeq.current === requestId) setThreadLoading(false);
      }
      return;
    }
    setThread(seedThread(msg));
  };
  const send = async () => {
    const text = draft.trim();
    if (!text || !canSend) return;
    if (isLive && open) {
      if (sending) return;
      setSending(true); setSendError(null);
      try {
        await sendConversationMessage(open.id, schoolId, profileId, text);
        setDraft('');
        setThread((t) => [...t, { me: true, text, time: 'Hadda' }]);
        reloadConvs();
      } catch (e) {
        setSendError((e && e.message) || 'Fariinta lama dirin. Mar kale isku day.');
      } finally { setSending(false); }
      return;
    }
    setThread((t) => [...t, { me: true, text, time: 'Hadda' }]);
    setDraft('');
  };
  // attach a photo (gallery) — demo preview only, never simulated live
  const attachImage = async () => {
    if (!canAttach) return;
    const res = await pickStudentImageFromGallery();
    if (res && res.uri) setThread((t) => [...t, { me: true, image: res.uri, time: 'Hadda' }]);
  };
  // voice note: tap to start, tap again to send (demo preview only)
  const startRec = () => { if (!canAttach) return; setRecSecs(0); setRecording(true); };
  const stopRec = (sendIt) => {
    setRecording(false);
    if (sendIt && canAttach) setThread((t) => [...t, { me: true, voice: true, dur: fmt(recSecs || 1), time: 'Hadda' }]);
    setRecSecs(0);
  };

  if (isLive && needsSchoolSelection) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.content}>
          <ScreenHeader
            title="Fariimaha"
            subtitle="Dooro dugsi si aad u aragto fariimaha"
            right={navigation ? (
              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="back" size={20} color={c.ink} />
              </TouchableOpacity>
            ) : null}
          />
          <SchoolSelectPrompt />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title="Fariimaha"
          subtitle={moderator ? 'Moderation summary' : `${unread} aan la akhrin`}
          right={
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.line }]}>
              <Icon name="back" size={20} color={c.ink} />
            </TouchableOpacity>
          }
        />

        <SuperAdminSchoolBar />

        {moderator ? (
          <>
            <View style={styles.modSummary}>
              <View style={[styles.sumCell, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <Text style={[styles.sumVal, { color: c.navy }]}>{all.length}</Text>
                <Text style={[styles.sumLbl, { color: c.muted }]}>Wada-hadallo</Text>
              </View>
              <View style={[styles.sumCell, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <Text style={[styles.sumVal, { color: c.green }]}>{all.filter((m) => m.role === 'teacher').length}</Text>
                <Text style={[styles.sumLbl, { color: c.muted }]}>Macalimiin</Text>
              </View>
              <View style={[styles.sumCell, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}>
                <Text style={[styles.sumVal, { color: c.blue }]}>{all.filter((m) => m.role === 'student').length}</Text>
                <Text style={[styles.sumLbl, { color: c.muted }]}>Ardayda</Text>
              </View>
            </View>
            <View style={[styles.modBanner, { backgroundColor: c.goldSoft }]}>
              <Icon name="shield" size={15} color={c.gold700} />
              <Text style={[styles.modTxt, { color: c.gold700 }]}>Maamulku wuxuu arkaa koobid keliya — qoraalka gaarka ah waa qarsoon yahay.</Text>
            </View>
          </>
        ) : null}

        {/* top row of recent contacts (story-style) */}
        {!moderator && all.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storyRow} contentContainerStyle={{ gap: 14, paddingHorizontal: 2 }}>
            {all.map((m) => (
              <TouchableOpacity key={'s' + m.id} style={styles.story} onPress={() => openThread(m)} activeOpacity={0.8}>
                <View style={[styles.storyRing, { borderColor: m.unread ? c.blue : c.line }]}>
                  <Avatar name={m.from} code={m.avatar} size={52} />
                </View>
                <Text style={[styles.storyName, { color: c.ink2 }]} numberOfLines={1}>{firstName(m.from)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}

        {/* search */}
        <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Icon name="search" size={17} color={c.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Raadi fariin…" placeholderTextColor={c.muted2} style={[styles.searchInput, { color: c.ink }]} />
        </View>

        {convError ? (
          <View style={[styles.feedback, { backgroundColor: c.roseSoft, borderColor: c.rose }]}>
            <Text style={[styles.feedbackTxt, { color: c.rose }]}>{convError}</Text>
            <TouchableOpacity onPress={reloadConvs}><Text style={{ color: c.blue, fontWeight: '800' }}>Isku day mar kale</Text></TouchableOpacity>
          </View>
        ) : null}
        {convLoading ? <View style={styles.loading}><ActivityIndicator color={c.blue} /></View> : <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>{isLive ? 'Weli wada-hadal ma jiro.' : '🪶 Fariin ma jirto'}</Text>}
          renderItem={({ item }) => {
            const isStudent = item.role === 'student';
            return (
              <TouchableOpacity
                style={[styles.card, { backgroundColor: c.surface, borderColor: item.unread && !moderator ? c.blue : c.line }, shadow.sm]}
                activeOpacity={moderator && !isLive ? 1 : 0.7}
                onPress={moderator && !isLive ? undefined : () => openThread(item)}
              >
                <Avatar name={item.from} code={item.avatar} size={48} />
                <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
                  <View style={styles.cardNameRow}>
                    <Text style={[styles.rName, { color: c.ink, fontWeight: item.unread && !moderator ? '800' : '700' }]} numberOfLines={1}>{item.from}</Text>
                    <View style={[styles.roleChip, { backgroundColor: isStudent ? c.blueSoft : c.greenSoft }]}>
                      <Text style={[styles.roleChipTxt, { color: isStudent ? c.blue : c.green }]}>{isStudent ? 'Arday' : 'Macalin'}</Text>
                    </View>
                  </View>
                  {moderator ? (
                    <View style={styles.ctxChips}>
                      {item.subject ? (
                        <View style={[styles.ctxChip, { backgroundColor: c.bg, borderColor: c.line }]}>
                          <Icon name="lessons" size={11} color={c.muted} />
                          <Text style={[styles.ctxChipTxt, { color: c.ink2 }]}>{item.subject}</Text>
                        </View>
                      ) : null}
                      {item.exam ? (
                        <View style={[styles.ctxChip, { backgroundColor: c.bg, borderColor: c.line }]}>
                          <Icon name="exams" size={11} color={c.muted} />
                          <Text style={[styles.ctxChipTxt, { color: c.ink2 }]}>{item.exam}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={[styles.rPrev, { color: item.unread ? c.ink2 : c.muted }]} numberOfLines={1}>{item.preview}</Text>
                  )}
                </View>
                <View style={styles.rRight}>
                  <Text style={[styles.rTime, { color: item.unread && !moderator ? c.blue : c.muted2 }]}>{item.time}</Text>
                  {moderator ? (
                    <View style={[styles.lockPill, { backgroundColor: c.bg, borderColor: c.line }]}>
                      <Icon name="shield" size={11} color={c.muted} />
                    </View>
                  ) : item.unread ? (
                    <View style={[styles.badge, { backgroundColor: c.blue }]}><Text style={styles.badgeTxt}>1</Text></View>
                  ) : <View style={{ height: 20 }} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />}
      </View>

      {/* chat thread */}
      <Modal visible={!!open} transparent animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.sheet, { backgroundColor: c.bg }]}>
            {open && (
              <>
                <View style={[styles.head, { backgroundColor: c.surface, borderBottomColor: c.line }]}>
                  <TouchableOpacity onPress={() => setOpen(null)} hitSlop={10} style={{ marginRight: 10 }}>
                    <Icon name="back" size={22} color={c.ink} />
                  </TouchableOpacity>
                  <Avatar name={open.from} code={open.avatar} size={42} />
                  <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                    <Text style={[styles.hName, { color: c.ink }]} numberOfLines={1}>{open.from}</Text>
                    <Text style={[styles.hClass, { color: c.green }]} numberOfLines={1}>● Online{open.class_id ? ` · ${open.class_id}` : ''}</Text>
                  </View>
                  <View style={[styles.iconBtn, { backgroundColor: c.bg, borderColor: c.line }]}><Icon name="phone" size={17} color={c.navy} /></View>
                </View>

                {(open.subject || open.exam) ? (
                  <View style={[styles.context, { backgroundColor: c.blueSoft }]}>
                    {open.subject ? <Text style={[styles.ctxTxt, { color: c.navy }]}>Subject: <Text style={{ fontWeight: '800' }}>{open.subject}</Text></Text> : null}
                    {open.exam ? <Text style={[styles.ctxTxt, { color: c.navy }]}>Exam: <Text style={{ fontWeight: '800' }}>{open.exam}</Text></Text> : null}
                  </View>
                ) : null}

                {threadError ? <Text style={[styles.threadError, { color: c.rose }]}>{threadError}</Text> : null}
                {threadLoading ? <View style={styles.loading}><ActivityIndicator color={c.blue} /></View> : <ScrollView contentContainerStyle={styles.thread} showsVerticalScrollIndicator={false}>
                  <View style={styles.daySep}><View style={[styles.dayPill, { backgroundColor: c.surface, borderColor: c.line }]}><Text style={[styles.dayTxt, { color: c.muted }]}>Maanta</Text></View></View>
                  {thread.map((b, i) => (
                    <View key={i} style={[styles.bubbleRow, { justifyContent: b.me ? 'flex-end' : 'flex-start' }]}>
                      <View style={[styles.bubble, b.image && styles.imgBubble, { backgroundColor: b.me ? c.blue : c.surface, borderColor: c.line, borderWidth: b.me ? 0 : 1,
                        borderBottomRightRadius: b.me ? 4 : 16, borderBottomLeftRadius: b.me ? 16 : 4 }]}>
                        {b.image ? (
                          <Image source={{ uri: b.image }} style={styles.msgImg} resizeMode="cover" />
                        ) : b.voice ? (
                          <View style={styles.voiceRow}>
                            <View style={[styles.playBtn, { backgroundColor: b.me ? 'rgba(255,255,255,.25)' : c.blueSoft }]}>
                              <Icon name="play" size={13} color={b.me ? '#fff' : c.blue} strokeWidth={2} />
                            </View>
                            <View style={styles.wave}>
                              {[8, 14, 6, 18, 10, 16, 7, 13, 9, 15, 6, 12].map((h, k) => (
                                <View key={k} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: b.me ? 'rgba(255,255,255,.7)' : c.muted2 }} />
                              ))}
                            </View>
                            <Text style={{ fontSize: 11, fontWeight: '700', color: b.me ? 'rgba(255,255,255,.85)' : c.muted }}>{b.dur}</Text>
                          </View>
                        ) : (
                          <Text style={{ color: b.me ? '#fff' : c.ink, fontSize: 14, lineHeight: 20 }}>{b.text}</Text>
                        )}
                        <Text style={[styles.time, { color: b.me ? 'rgba(255,255,255,.7)' : c.muted2 }]}>{b.time}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>}

                {sendError ? <Text style={[styles.sendError, { color: c.rose, backgroundColor: c.roseSoft }]}>{sendError}</Text> : null}
                {/* composer — text, photo and voice (student & teacher) */}
                {recording ? (
                  <View style={[styles.composer, { backgroundColor: c.surface, borderTopColor: c.line }]}>
                    <TouchableOpacity style={[styles.cBtn, { backgroundColor: c.roseSoft }]} onPress={() => stopRec(false)}>
                      <Icon name="trash" size={18} color={c.rose} strokeWidth={2} />
                    </TouchableOpacity>
                    <View style={[styles.recBar, { backgroundColor: c.bg, borderColor: c.line }]}>
                      <View style={[styles.recDot, { backgroundColor: c.rose }]} />
                      <Text style={[styles.recTxt, { color: c.ink }]}>Duubaya cod… {fmt(recSecs)}</Text>
                    </View>
                    <TouchableOpacity style={[styles.sendBtn, { backgroundColor: c.blue }]} onPress={() => stopRec(true)}>
                      <Icon name="send" size={18} color="#fff" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={[styles.composer, { backgroundColor: c.surface, borderTopColor: c.line }]}>
                    <TouchableOpacity style={[styles.cBtn, { backgroundColor: c.blueSoft }]} onPress={attachImage} disabled={!canAttach}>
                      <Icon name="camera" size={18} color={canAttach ? c.navy : c.muted2} strokeWidth={2} />
                    </TouchableOpacity>
                    <TextInput value={draft} onChangeText={setDraft} editable={canSend} placeholder={canSend ? 'Qor fariin…' : 'Fariin ma diri kartid'} placeholderTextColor={c.muted2}
                      style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} />
                    {draft.trim() ? (
                      <TouchableOpacity style={[styles.sendBtn, { backgroundColor: c.blue, opacity: sending ? 0.7 : 1 }]} onPress={send} disabled={sending}>
                        {sending ? <ActivityIndicator color="#fff" size="small" /> : <Icon name="send" size={18} color="#fff" strokeWidth={2} />}
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={[styles.sendBtn, { backgroundColor: canAttach ? c.navy : c.muted2 }]} onPress={startRec} disabled={!canAttach}>
                        <Icon name="mic" size={18} color="#fff" strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 11, marginBottom: 10 },
  feedbackTxt: { flex: 1, fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  threadError: { padding: 12, textAlign: 'center', fontSize: 12.5, fontWeight: '700' },
  sendError: { paddingVertical: 8, paddingHorizontal: 14, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  iconBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 12, marginBottom: 12 },
  modTxt: { flex: 1, fontSize: 11.5, fontWeight: '700', lineHeight: 16 },
  storyRow: { marginBottom: 14, flexGrow: 0 },
  story: { alignItems: 'center', width: 64 },
  storyRing: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  storyName: { fontSize: 11.5, fontWeight: '600', marginTop: 5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 46, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  modSummary: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  sumCell: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
  sumVal: { fontSize: 20, fontWeight: '800' },
  sumLbl: { fontSize: 10.5, fontWeight: '700', marginTop: 3 },
  card: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  cardNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleChipTxt: { fontSize: 10, fontWeight: '800' },
  ctxChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  ctxChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ctxChipTxt: { fontSize: 11, fontWeight: '700' },
  lockPill: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rName: { fontSize: 14.5, flexShrink: 1 },
  rPrev: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  rRight: { alignItems: 'flex-end', marginLeft: 8, gap: 5 },
  rTime: { fontSize: 11.5, fontWeight: '700' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { fontSize: 13, fontWeight: '600', textAlign: 'center', padding: 30 },
  // chat
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.45)', justifyContent: 'flex-end' },
  sheet: { height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  hName: { fontSize: 15.5, fontWeight: '800' },
  hClass: { fontSize: 11.5, fontWeight: '700', marginTop: 1 },
  context: { paddingVertical: 8, paddingHorizontal: 16, gap: 2 },
  ctxTxt: { fontSize: 12.5, fontWeight: '600' },
  thread: { padding: 16, gap: 8 },
  daySep: { alignItems: 'center', marginBottom: 6 },
  dayPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  dayTxt: { fontSize: 11.5, fontWeight: '700' },
  bubbleRow: { flexDirection: 'row', marginBottom: 4 },
  bubble: { maxWidth: '78%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 16 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  playBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 20 },
  time: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, height: 44, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  recBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, height: 44 },
  recDot: { width: 10, height: 10, borderRadius: 5 },
  recTxt: { fontSize: 13.5, fontWeight: '700' },
  imgBubble: { padding: 4, overflow: 'hidden' },
  msgImg: { width: 200, height: 200, borderRadius: 14 },
});
