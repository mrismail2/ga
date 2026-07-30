import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Modal, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import SectionTitle from '../components/SectionTitle';
import Icon from '../components/Icon';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import {
  getLiveSchoolPreferences, updateLivePersonalProfile, updateLiveSchoolProfile,
  updateLiveStudentIdPrefix, updateLiveAccountPassword,
} from '../services/settings';
const { SCHOOL_MANAGEMENT_DESTINATIONS, activateSettingsDestination } = require('../domain/settingsPolicy');

const PREF_KEY = 'kobciye_local_preferences_v2';
const DEMO_KEY = 'kobciye_demo_settings_preview_v2';
const LANGS = ['Soomaali', 'English', 'العربية'];

export default function SettingsScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const auth = useAuth();
  const isSchoolAdmin = auth.isLive ? auth.roleKey === 'schooladmin' : profile.key === 'schooladmin';
  const [lang, setLang] = useState(0);
  const [notif, setNotif] = useState({ push: true, email: false });
  const [schoolPrefs, setSchoolPrefs] = useState(null);
  const [schoolPrefsStatus, setSchoolPrefsStatus] = useState('idle');
  const [editing, setEditing] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((raw) => {
      if (!raw) return;
      try { const pref = JSON.parse(raw); if (Number.isInteger(pref.lang)) setLang(pref.lang); if (pref.notif) setNotif(pref.notif); } catch (e) { /* local preference only */ }
    });
  }, []);

  const loadSchoolPrefs = useCallback(async () => {
    if (!auth.isLive || !isSchoolAdmin) { setSchoolPrefsStatus('idle'); return; }
    setSchoolPrefsStatus('loading');
    try { setSchoolPrefs(await getLiveSchoolPreferences()); setSchoolPrefsStatus('ready'); }
    catch (e) { setSchoolPrefs(null); setSchoolPrefsStatus('error'); }
  }, [auth.isLive, auth.profile, isSchoolAdmin]);
  useEffect(() => { loadSchoolPrefs(); }, [loadSchoolPrefs]);

  const persistPreference = (patch) => {
    const next = { lang, notif, ...patch };
    AsyncStorage.setItem(PREF_KEY, JSON.stringify(next)).catch(() => {});
  };
  const flash = (text) => { setDone(text); setTimeout(() => setDone(''), 2200); };

  const openEditor = (type) => {
    setFormError(null);
    if (auth.isLive && (type === 'schoolProfile' || type === 'idFormat') && schoolPrefsStatus !== 'ready') return;
    if (type === 'profile') {
      setValues({ full_name: (auth.profile && auth.profile.full_name) || profile.name || '', phone: (auth.profile && auth.profile.phone) || '' });
    } else if (type === 'schoolProfile') {
      setValues({ name: (schoolPrefs && schoolPrefs.name) || '', location: (schoolPrefs && schoolPrefs.location) || '' });
    } else if (type === 'idFormat') {
      setValues({ prefix: (schoolPrefs && schoolPrefs.student_id_prefix) || 'KOB' });
    } else if (type === 'password') setValues({ password: '', confirmation: '' });
    setEditing(type);
  };

  const saveEditor = async () => {
    if (!editing || saving) return;
    setSaving(true); setFormError(null);
    try {
      if (!auth.isLive) {
        if (editing === 'password') flash('Demo mode ma beddelo password dhab ah');
        else {
          await AsyncStorage.setItem(DEMO_KEY, JSON.stringify({ type: editing, values }));
          flash('Demo preview ayaa qalabka lagu kaydiyey');
        }
      } else if (editing === 'profile') {
        await updateLivePersonalProfile(values); await auth.refreshProfile(); flash('Profile-ka waa la cusboonaysiiyey');
      } else if (editing === 'schoolProfile') {
        const updated = await updateLiveSchoolProfile(values);
        setSchoolPrefs((current) => ({ ...current, ...updated })); await auth.refreshProfile(); flash('Xogta dugsiga waa la cusboonaysiiyey');
      } else if (editing === 'idFormat') {
        const updated = await updateLiveStudentIdPrefix(values.prefix);
        setSchoolPrefs((current) => ({ ...current, ...updated })); flash('Prefix-ka ardayda waa la cusboonaysiiyey');
      } else if (editing === 'password') {
        await updateLiveAccountPassword(values.password, values.confirmation); flash('Password-ka waa la beddelay');
      }
      setEditing(null);
    } catch (e) { setFormError((e && e.message) || 'Kaydintu way fashilantay.'); }
    finally { setSaving(false); }
  };

  const accountItems = [
    { key: 'profile', icon: 'profile', label: 'My Profile', sub: 'Magaca iyo taleefoonka', action: () => openEditor('profile') },
  ];
  const schoolItems = isSchoolAdmin ? [
    { key: 'schoolProfile', icon: 'building', label: 'School Profile', sub: 'Magaca iyo magaalada oo Supabase ku kaydsan', disabled: auth.isLive && schoolPrefsStatus !== 'ready', action: () => openEditor('schoolProfile') },
    { key: 'idFormat', icon: 'students', label: 'Student ID Format', sub: 'Prefix-ka ardayda cusub', disabled: auth.isLive && schoolPrefsStatus !== 'ready', action: () => openEditor('idFormat') },
    ...SCHOOL_MANAGEMENT_DESTINATIONS.map((item) => ({ ...item, action: () => activateSettingsDestination(item, (nextRoute, params) => navigation.navigate(nextRoute, params)) })),
    ...(!auth.isLive ? [{ key: 'permissions', icon: 'shield', label: 'User Roles & Permissions', sub: 'Ogolaanshaha isticmaalayaasha', action: () => navigation.navigate('Permissions') }] : []),
  ] : [];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Goobaha" subtitle={profile.labelSo} right={<TouchableOpacity onPress={() => navigation.goBack()} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}><Icon name="back" size={20} color={c.ink} /></TouchableOpacity>} />
        <Card style={styles.profile}><Avatar name={profile.name} code={profile.key} size={52} /><View style={{ flex: 1, marginLeft: 14 }}><Text style={[styles.pName, { color: c.ink }]}>{profile.name}</Text><Text style={[styles.pSub, { color: c.muted }]}>{profile.sub}</Text></View><Badge label={profile.labelSo} tone="navy" /></Card>

        <SettingsGroup title="Akoonkayga" items={accountItems} c={c} />
        {schoolItems.length ? <SettingsGroup title="Dugsiga" items={schoolItems} c={c} /> : null}
        {auth.isLive && isSchoolAdmin && schoolPrefsStatus === 'error' ? <View style={[styles.prefError, { backgroundColor: c.roseSoft }]}><Text style={[styles.itemSub, { color: c.rose, flex: 1 }]}>Xogta dugsiga lama soo dejin. Wax edit ah lama oggola ilaa xogta LIVE la helo.</Text><TouchableOpacity onPress={loadSchoolPrefs}><Text style={{ color: c.blue, fontWeight: '800' }}>Isku day mar kale</Text></TouchableOpacity></View> : null}

        <SectionTitle title="Ogeysiisyada" tone={c.blue} />
        <Card padded={false}><PreferenceToggle label="Push notifications" icon="bell" value={notif.push} onChange={(value) => { const next = { ...notif, push: value }; setNotif(next); persistPreference({ notif: next }); }} c={c} />
          <PreferenceToggle top label="Email notifications" icon="mail" value={notif.email} onChange={(value) => { const next = { ...notif, email: value }; setNotif(next); persistPreference({ notif: next }); }} c={c} /></Card>

        <SectionTitle title="Luqadda" tone={c.gold} />
        <Card padded={false}>{LANGS.map((label, index) => <TouchableOpacity key={label} onPress={() => { setLang(index); persistPreference({ lang: index }); }} style={[styles.lang, { borderTopColor: c.line, borderTopWidth: index ? 1 : 0 }]}><Text style={[styles.itemLabel, { color: c.ink }]}>{label}</Text>{lang === index ? <Icon name="check" size={16} color={c.blue} /> : null}</TouchableOpacity>)}</Card>

        <SectionTitle title="Amniga & Soo-galka" tone={c.navy} />
        <TouchableOpacity onPress={() => openEditor('password')} style={[styles.security, { backgroundColor: c.surface, borderColor: c.line }]}><View style={[styles.itemIcon, { backgroundColor: c.blueSoft }]}><Icon name="key" size={18} color={c.navy} /></View><Text style={[styles.itemLabel, { color: c.ink, flex: 1 }]}>Beddel Password-ka</Text><Icon name="chevronRight" size={18} color={c.muted2} /></TouchableOpacity>

        {done ? <Text style={[styles.done, { color: c.green }]}>✓ {done}</Text> : null}
        <Text style={[styles.foot, { color: c.muted2 }]}>{auth.isLive ? 'LIVE · xogta maamulka waxay ka timaaddaa Supabase.' : 'DEMO · kaliya preferences/preview ayaa qalabkan ku kaydsan.'}</Text>
      </ScrollView>
      <EditorModal type={editing} values={values} setValues={setValues} error={formError} saving={saving} onSave={saveEditor} onClose={() => setEditing(null)} c={c} />
    </SafeAreaView>
  );
}

function SettingsGroup({ title, items, c }) {
  return <View><SectionTitle title={title} tone={c.navy} /><Card padded={false}>{items.map((item, index) => <TouchableOpacity key={item.key} onPress={item.action} disabled={item.disabled} style={[styles.item, { borderTopColor: c.line, borderTopWidth: index ? 1 : 0, opacity: item.disabled ? 0.45 : 1 }]}><View style={[styles.itemIcon, { backgroundColor: c.blueSoft }]}><Icon name={item.icon} size={18} color={c.navy} /></View><View style={{ flex: 1 }}><Text style={[styles.itemLabel, { color: c.ink }]}>{item.label}</Text><Text style={[styles.itemSub, { color: c.muted }]}>{item.sub}</Text></View><Icon name="chevronRight" size={18} color={c.muted2} /></TouchableOpacity>)}</Card></View>;
}
function PreferenceToggle({ top, label, icon, value, onChange, c }) { return <View style={[styles.toggle, { borderTopColor: c.line, borderTopWidth: top ? 1 : 0 }]}><View style={styles.row}><Icon name={icon} size={18} color={c.ink2} /><Text style={[styles.itemLabel, { color: c.ink }]}>{label}</Text></View><Switch value={value} onValueChange={onChange} trackColor={{ true: c.blue }} /></View>; }

function EditorModal({ type, values, setValues, error, saving, onSave, onClose, c }) {
  const specs = {
    profile: { title: 'My Profile', fields: [['full_name', 'MAGACA BUUXA', false], ['phone', 'TALEEFOON', false]] },
    schoolProfile: { title: 'School Profile', fields: [['name', 'MAGACA DUGSIGA', false], ['location', 'MAGAALADA / GOOBTA', false]] },
    idFormat: { title: 'Student ID Format', fields: [['prefix', 'PREFIX-KA DUGSIGA', false]] },
    password: { title: 'Beddel Password-ka', fields: [['password', 'PASSWORD CUSUB', true], ['confirmation', 'XAQIIJI PASSWORD-KA', true]] },
  };
  const spec = type ? specs[type] : null;
  return <Modal visible={Boolean(spec)} transparent animationType="fade" onRequestClose={onClose}><Pressable style={styles.overlay} onPress={onClose}><Pressable style={[styles.sheet, { backgroundColor: c.surface }]} onPress={() => {}}>{spec ? <>
    <Text style={[styles.modalTitle, { color: c.ink }]}>{spec.title}</Text>{spec.fields.map(([key, label, secure]) => <View key={key} style={styles.field}><Text style={[styles.fieldLabel, { color: c.muted }]}>{label}</Text><TextInput value={values[key] || ''} secureTextEntry={secure} onChangeText={(text) => setValues({ ...values, [key]: text })} style={[styles.input, { backgroundColor: c.bg, borderColor: c.line, color: c.ink }]} /></View>)}
    {error ? <Text style={[styles.error, { color: c.rose }]}>{error}</Text> : null}<View style={styles.actions}><TouchableOpacity onPress={onClose} style={[styles.action, { borderColor: c.line, borderWidth: 1 }]}><Text style={[styles.actionTxt, { color: c.ink }]}>Jooji</Text></TouchableOpacity><TouchableOpacity onPress={onSave} disabled={saving} style={[styles.action, { backgroundColor: c.blue }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={[styles.actionTxt, { color: '#fff' }]}>Kaydi</Text>}</TouchableOpacity></View>
  </> : null}</Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, paddingBottom: 36 }, back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center' }, pName: { fontSize: 17, fontWeight: '800' }, pSub: { fontSize: 12.5, marginTop: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 }, itemIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, itemLabel: { fontSize: 14.5, fontWeight: '700' }, itemSub: { fontSize: 12, marginTop: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, lang: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  security: { padding: 12, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, done: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 14 }, foot: { fontSize: 11.5, fontWeight: '600', textAlign: 'center', marginTop: 22 },
  prefError: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12, marginTop: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(10,27,45,.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }, sheet: { width: '100%', maxWidth: 440, borderRadius: 20, padding: 20 }, modalTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  field: { marginTop: 12 }, fieldLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 }, input: { height: 47, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 14 }, error: { fontSize: 12.5, fontWeight: '700', marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 }, action: { flex: 1, height: 47, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, actionTxt: { fontSize: 14, fontWeight: '800' },
});
