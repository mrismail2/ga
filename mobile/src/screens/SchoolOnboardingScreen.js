/* ============================================================
   Kobciye — Phase 3: Super Admin school onboarding

   The super_admin's live workspace:
     • Register New School  → "Create School & Send Invite" (Edge Function)
     • Live school list      (real Supabase data)
     • Invitation status     (pending / accepted / expired / cancelled)
     • Resend / Cancel        invitation actions (Edge Functions)

   No SQL Editor needed for ordinary registration. All writes go through the
   secure Edge Functions; this screen only reads (super_admin RLS) and calls
   those functions. Duplicate submission is blocked while a request is running.
   ============================================================ */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useRole } from '../context/RoleContext';
import ScreenHeader from '../components/ScreenHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Icon from '../components/Icon';
import LoadingDots from '../components/LoadingDots';
import {
  createSchoolAndInvite, resendSchoolInvite, cancelSchoolInvite, listSchools, listInvitations,
} from '../services/supabase';
import { INSTITUTION_TYPES, INSTITUTION_TYPE_OPTIONS, isValidInstitutionType } from '../config/institutionTypes';
import { SCHOOL_STAGE_OPTIONS, isValidSchoolStage } from '../config/schoolStages';

const STATUS_TONE = { pending: 'gold', accepted: 'green', expired: 'muted', cancelled: 'rose' };
const STATUS_LABEL = { pending: 'Sugaya', accepted: 'La aqbalay', expired: 'Dhacay', cancelled: 'La joojiyay' };

const slugify = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export default function SchoolOnboardingScreen() {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { role } = useRole(); // set from DB role in live, from picker in demo

  const [tab, setTab] = useState('register'); // 'register' | 'schools' | 'invites'
  const [schools, setSchools] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  // form state
  const [f, setF] = useState({
    name: '', slug: '', slugTouched: false, location: '', adminName: '', adminEmail: '', adminPhone: '',
    institutionType: '', schoolStage: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { kind:'ok'|'err', msg }
  const [rowBusy, setRowBusy] = useState(null);    // invitation id being resent/cancelled

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // any super_admin may SEE this screen (incl. demo preview); real creation +
  // the live school/invitation lists require a live (authenticated) session.
  const isSuperAdmin = role === 'superadmin';
  const canManage = isLive && isSuperAdmin;

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    try {
      const [s, i] = await Promise.all([listSchools(), listInvitations()]);
      setSchools(s); setInvites(i);
    } catch (e) {
      setFeedback({ kind: 'err', msg: e.message || 'Could not load data.' });
    } finally {
      setLoading(false);
    }
  }, [canManage]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  // Register New School must not submit until Nooca Hay'adda (and, for a
  // school, Heerka Dugsiga) is correctly selected — see
  // supabase/migrations/20260705000001_institution_type.sql for the matching
  // server-side rule this mirrors.
  const institutionValid = isValidInstitutionType(f.institutionType);
  const schoolStageValid = f.institutionType === INSTITUTION_TYPES.UNIVERSITY
    ? true
    : isValidSchoolStage(f.schoolStage);
  const canSubmitInstitution = institutionValid && schoolStageValid;

  const selectInstitutionType = (v) => setF((p) => ({ ...p, institutionType: v, schoolStage: '' }));
  const selectSchoolStage = (v) => setF((p) => ({ ...p, schoolStage: v }));

  const submit = async () => {
    if (submitting) return;                     // block double submit
    setFeedback(null);
    const name = f.name.trim();
    const slug = (f.slugTouched ? f.slug : slugify(f.name)).trim();
    const email = f.adminEmail.trim();
    if (name.length < 2) return setFeedback({ kind: 'err', msg: 'Geli magaca dugsiga.' });
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return setFeedback({ kind: 'err', msg: 'Slug: xarfo yaryar, lambaro iyo "-" oo keliya.' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setFeedback({ kind: 'err', msg: 'Geli email sax ah oo maamulaha.' });
    if (!institutionValid) return setFeedback({ kind: 'err', msg: "Dooro Nooca Hay'adda: Dugsi ama Jaamacad." });
    if (!schoolStageValid) return setFeedback({ kind: 'err', msg: 'Dooro Heerka Dugsiga: Dugsi Hoose/Dhexe ama Dugsi Sare.' });

    // demo preview: show the flow without creating anything for real
    if (!canManage) {
      setFeedback({ kind: 'ok', msg: `Preview: "${name}" — si dhab ah u gal (Sign in) adigoo super admin si aad u abuurto oo aad casuumaad ugu dirto ${email}.` });
      return;
    }

    setSubmitting(true);
    try {
      const res = await createSchoolAndInvite({
        name, slug, location: f.location.trim() || null,
        adminName: f.adminName.trim(), adminEmail: email, adminPhone: f.adminPhone.trim() || null,
        institutionType: f.institutionType,
        schoolStage: f.institutionType === INSTITUTION_TYPES.UNIVERSITY ? null : f.schoolStage,
      });
      // honest delivery reporting: only claim "sent" when the email really went
      if (res.delivery === 'failed') {
        setFeedback({ kind: 'err', msg: 'School created, but the invitation email was not delivered. Fix email settings and resend.' });
      } else if (res.delivery === 'pending_delivery' || res.idempotent) {
        setFeedback({ kind: 'ok', msg: 'Dugsigan horey ayaa loo abuuray — isticmaal "Dib u dir" si aad email-ka dib u soo dirto.' });
      } else {
        setFeedback({ kind: 'ok', msg: `Dugsiga waa la abuuray. Casuumaad ayaa loo diray ${res.invitee_email}.` });
      }
      setF({ name: '', slug: '', slugTouched: false, location: '', adminName: '', adminEmail: '', adminPhone: '', institutionType: '', schoolStage: '' });
      await load();
      setTab('invites');
    } catch (e) {
      const msg = e && e.code === 'existing_account_requires_manual_resolution'
        ? 'Email-kan horey ayuu akoon u leeyahay. Si gacanta ah ku xalli — dugsi lama abuurin, akoonka jiraana lama beddelin.'
        : (e.message || 'Waa la fashilmay. Isku day mar kale.');
      setFeedback({ kind: 'err', msg });
    } finally {
      setSubmitting(false);
    }
  };

  const doResend = async (id) => {
    if (rowBusy) return;
    setRowBusy(id); setFeedback(null);
    try {
      const res = await resendSchoolInvite(id);
      if (res && res.delivery === 'failed') {
        setFeedback({ kind: 'err', msg: 'Casuumaadda waa la cusboonaysiiyay, laakiin email lama gaarsiin. Hagaaji SMTP-ga.' });
      } else {
        setFeedback({ kind: 'ok', msg: 'Casuumaadda dib ayaa loo diray.' });
      }
      await load();
    } catch (e) { setFeedback({ kind: 'err', msg: e.message || 'Resend failed.' }); }
    finally { setRowBusy(null); }
  };

  const doCancel = async (id) => {
    if (rowBusy) return;
    setRowBusy(id); setFeedback(null);
    try { await cancelSchoolInvite(id); setFeedback({ kind: 'ok', msg: 'Casuumaadda waa la joojiyay.' }); await load(); }
    catch (e) { setFeedback({ kind: 'err', msg: e.message || 'Cancel failed.' }); }
    finally { setRowBusy(null); }
  };

  const filteredSchools = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter((s) => (s.name || '').toLowerCase().includes(q) || (s.slug || '').toLowerCase().includes(q));
  }, [schools, query]);

  const filteredInvites = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invites;
    return invites.filter((i) => (i.invitee_email || '').toLowerCase().includes(q) || (i.school?.name || '').toLowerCase().includes(q));
  }, [invites, query]);

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <Icon name="shield" size={30} color={c.muted2} />
          <Text style={[styles.emptyTitle, { color: c.ink }]}>Maamulaha guud oo keliya</Text>
          <Text style={[styles.emptySub, { color: c.muted }]}>
            Diiwaangelinta dugsiyada waxaa sameeya maamulaha guud (super admin) oo keliya.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.blue} />}
      >
        <ScreenHeader title="Dugsiyada & Casuumaad" subtitle="Abuur dugsi cusub oo casuumo maamule" />

        {/* tabs */}
        <View style={styles.tabs}>
          {[['register', 'Diiwaangeli'], ['schools', `Dugsiyada (${schools.length})`], ['invites', `Casuumaad (${invites.length})`]].map(([k, label]) => {
            const on = tab === k;
            return (
              <TouchableOpacity key={k} onPress={() => setTab(k)}
                style={[styles.tab, { borderColor: on ? c.navy : c.line, backgroundColor: on ? c.navy : c.surface }]}>
                <Text style={[styles.tabTxt, { color: on ? '#fff' : c.muted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!canManage ? (
          <View style={[styles.feedback, { backgroundColor: c.goldSoft }]}>
            <Icon name="shield" size={15} color={c.gold700} />
            <Text style={[styles.feedbackTxt, { color: c.gold700 }]}>Preview mode — si dhab ah u gal (Sign in) si aad dugsi u abuurto oo aad casuumaad u dirto.</Text>
          </View>
        ) : null}

        {feedback ? (
          <View style={[styles.feedback, { backgroundColor: feedback.kind === 'ok' ? c.greenSoft : c.roseSoft }]}>
            <Icon name={feedback.kind === 'ok' ? 'check' : 'alert'} size={15} color={feedback.kind === 'ok' ? c.green : c.rose} />
            <Text style={[styles.feedbackTxt, { color: feedback.kind === 'ok' ? c.green : c.rose }]}>{feedback.msg}</Text>
          </View>
        ) : null}

        {tab === 'register' ? (
          <Card style={{ marginTop: 4 }}>
            <Text style={[styles.cardTitle, { color: c.ink }]}>Register New School</Text>
            <Field c={c} label="MAGACA DUGSIGA" value={f.name}
              onChangeText={(v) => setF((p) => ({ ...p, name: v, slug: p.slugTouched ? p.slug : slugify(v) }))}
              placeholder="tusaale: Dugsiga Horseed" />
            <Field c={c} label="SLUG (UNIQUE)" value={f.slugTouched ? f.slug : slugify(f.name)}
              onChangeText={(v) => setF((p) => ({ ...p, slug: slugify(v), slugTouched: true }))}
              placeholder="dugsiga-horseed" autoCapitalize="none" />
            <Field c={c} label="GOOBTA / MAGAALADA" value={f.location} onChangeText={(v) => set('location', v)} placeholder="tusaale: Gabiley" />

            <OptionRow c={c} label="NOOCA HAY'ADDA" options={INSTITUTION_TYPE_OPTIONS}
              value={f.institutionType} onSelect={selectInstitutionType} />
            {f.institutionType === INSTITUTION_TYPES.SCHOOL ? (
              <OptionRow c={c} label="HEERKA DUGSIGA" options={SCHOOL_STAGE_OPTIONS}
                value={f.schoolStage} onSelect={selectSchoolStage} />
            ) : null}

            <View style={styles.divider} />
            <Text style={[styles.subhead, { color: c.muted }]}>MAAMULAHA DUGSIGA (KOOWAAD)</Text>
            <Field c={c} label="MAGACA BUUXA" value={f.adminName} onChangeText={(v) => set('adminName', v)} placeholder="Magaca maamulaha" />
            <Field c={c} label="EMAIL (GMAIL)" value={f.adminEmail} onChangeText={(v) => set('adminEmail', v)} placeholder="admin@gmail.com" keyboardType="email-address" autoCapitalize="none" />
            <Field c={c} label="TALEEFOON" value={f.adminPhone} onChangeText={(v) => set('adminPhone', v)} placeholder="+252 …" keyboardType="phone-pad" />

            <TouchableOpacity style={[styles.btn, { backgroundColor: c.navy, opacity: (submitting || !canSubmitInstitution) ? 0.5 : 1 }]}
              onPress={submit} activeOpacity={0.9} disabled={submitting || !canSubmitInstitution}>
              {submitting ? <LoadingDots color="#fff" size={7} gap={5} /> : (
                <>
                  <Icon name="send" size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.btnTxt}>Create School &amp; Send Invite</Text>
                </>
              )}
            </TouchableOpacity>
            {!canSubmitInstitution ? (
              <Text style={[styles.note, { color: c.gold700 }]}>
                Dooro Nooca Hay'adda{f.institutionType === INSTITUTION_TYPES.SCHOOL ? ' iyo Heerka Dugsiga' : ''} ka hor intaadan diiwaangelin.
              </Text>
            ) : null}
            <Text style={[styles.note, { color: c.muted2 }]}>
              Cidna furaha diyaar looma diro — maamulaha ayaa link-ga email-ka ku dooranaya furihiisa gaarka ah.
            </Text>
          </Card>
        ) : null}

        {tab !== 'register' ? (
          <View style={[styles.field, { backgroundColor: c.surface, borderColor: c.line, marginTop: 4 }]}>
            <Icon name="search" size={16} color={c.muted2} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Raadi…" placeholderTextColor={c.muted2} autoCapitalize="none" style={[styles.input, { color: c.ink }]} />
          </View>
        ) : null}

        {loading ? <LoadingDots color={c.blue} size={9} gap={7} style={{ marginTop: 24 }} /> : null}

        {tab === 'schools' && !loading ? (
          filteredSchools.length === 0 ? (
            <Empty c={c} icon="building" title="Weli dugsi ma jiro" sub="Abuur dugsigaaga koowaad tab-ka Diiwaangeli." />
          ) : (
            filteredSchools.map((s) => {
              const sub = (s.subscriptions && s.subscriptions[0]) || null;
              return (
                <Card key={s.id} style={styles.row} padded>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{s.name}</Text>
                    <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>
                      {s.slug}{s.location ? ` · ${s.location}` : ''}
                    </Text>
                  </View>
                  <Badge label={sub ? (sub.status === 'trialing' ? 'Tijaabo' : sub.status) : (s.status || 'active')}
                    tone={sub && sub.status === 'trialing' ? 'gold' : 'green'} />
                </Card>
              );
            })
          )
        ) : null}

        {tab === 'invites' && !loading ? (
          filteredInvites.length === 0 ? (
            <Empty c={c} icon="mail" title="Weli casuumaad ma jirto" sub="Casuumaadaha waxay ka soo baxaan marka aad dugsi diiwaangeliso." />
          ) : (
            filteredInvites.map((i) => {
              const tone = STATUS_TONE[i.status] || 'muted';
              const busy = rowBusy === i.id;
              return (
                <Card key={i.id} style={{ marginTop: 10 }} padded>
                  <View style={styles.inviteHead}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowTitle, { color: c.ink }]} numberOfLines={1}>{i.invitee_email}</Text>
                      <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>
                        {(i.school && i.school.name) || 'School'}{i.invitee_name ? ` · ${i.invitee_name}` : ''}
                      </Text>
                    </View>
                    <Badge label={STATUS_LABEL[i.status] || i.status} tone={tone} />
                  </View>
                  {i.email_delivery_status === 'failed' ? (
                    <View style={styles.deliverWarn}>
                      <Icon name="alert" size={13} color={c.rose} />
                      <Text style={[styles.deliverWarnTxt, { color: c.rose }]}>Email lama gaarsiin — hagaaji SMTP-ga oo dib u dir.</Text>
                    </View>
                  ) : (i.status === 'pending' && i.email_delivery_status === 'sent' ? (
                    <Text style={[styles.deliverOk, { color: c.green }]}>✓ Email waa la diray</Text>
                  ) : null)}
                  {i.status === 'pending' || i.status === 'expired' ? (
                    <View style={styles.actions}>
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: c.blue }]} onPress={() => doResend(i.id)} disabled={busy} activeOpacity={0.8}>
                        {busy ? <LoadingDots color={c.blue} size={6} gap={4} /> : <Text style={[styles.actionTxt, { color: c.blue }]}>Dib u dir</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { borderColor: c.rose }]} onPress={() => doCancel(i.id)} disabled={busy} activeOpacity={0.8}>
                        <Text style={[styles.actionTxt, { color: c.rose }]}>Jooji</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </Card>
              );
            })
          )
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ c, label, ...props }) {
  return (
    <>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={[styles.field, { backgroundColor: c.bg, borderColor: c.line }]}>
        <TextInput placeholderTextColor={c.muted2} style={[styles.input, { color: c.ink }]} {...props} />
      </View>
    </>
  );
}

/* Required single-select chip row (Nooca Hay'adda / Heerka Dugsiga). Nothing
   is pre-selected — the form cannot submit until the super_admin picks one. */
function OptionRow({ c, label, options, value, onSelect }) {
  return (
    <>
      <Text style={[styles.label, { color: c.muted }]}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <TouchableOpacity key={o.value} onPress={() => onSelect(o.value)} activeOpacity={0.85}
              style={[styles.option, { borderColor: on ? c.navy : c.line, backgroundColor: on ? c.navy : c.bg }]}>
              <Text style={[styles.optionTxt, { color: on ? '#fff' : c.muted }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

function Empty({ c, icon, title, sub }) {
  return (
    <View style={styles.emptyBox}>
      <Icon name={icon} size={26} color={c.muted2} />
      <Text style={[styles.emptyTitle, { color: c.ink }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: c.muted }]}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  tabs: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, borderWidth: 1, alignItems: 'center' },
  tabTxt: { fontSize: 12.5, fontWeight: '700' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 11, marginBottom: 12 },
  feedbackTxt: { fontSize: 12.5, fontWeight: '700', flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 7, marginTop: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1.5 },
  optionTxt: { fontSize: 12.5, fontWeight: '700' },
  subhead: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginTop: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  input: { flex: 1, fontSize: 14 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.06)', marginVertical: 16 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 14, marginTop: 20 },
  btnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  note: { fontSize: 11.5, fontWeight: '600', marginTop: 10, lineHeight: 17, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  rowTitle: { fontSize: 14.5, fontWeight: '800' },
  rowSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  inviteHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deliverWarn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  deliverWarnTxt: { fontSize: 12, fontWeight: '700', flex: 1 },
  deliverOk: { fontSize: 11.5, fontWeight: '700', marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { fontSize: 13, fontWeight: '800' },
  emptyBox: { alignItems: 'center', padding: 30, gap: 8 },
  emptyTitle: { fontSize: 15.5, fontWeight: '800', marginTop: 6 },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
});
