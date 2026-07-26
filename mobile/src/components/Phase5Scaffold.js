/* ============================================================
   Kobciye — Phase 5 shared UI scaffold

   One place for the states every Phase 5 module must show (§15): loading,
   empty, visible error + retry, and the Super Admin "Dooro Dugsi" gate. Keeps
   each module screen small and consistent while preserving the approved
   visual language (same tokens/spacing as the Phase 4 screens).
   ============================================================ */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from './SchoolSelector';
import ScreenHeader from './ScreenHeader';
import Icon from './Icon';
import { p5FriendlyError } from '../services/phase5';

/* a small hook that runs an async loader with loading/error state + reload */
export function useAsyncData(loader, deps, { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    if (!enabled) { setLoading(false); return; }
    setLoading(true); setError(null);
    try { setData(await loader()); }
    catch (e) { setError(p5FriendlyError(e)); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
  useEffect(() => { reload(); }, [reload]);
  return { data, loading, error, reload, setData };
}

/* full-screen module wrapper: header + super-admin gate/bar + state handling */
export default function Phase5Screen({ title, subtitle, icon, loading, error, empty, emptyText, onRetry, right, children, requireSchool = true }) {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { needsSchoolSelection } = useActiveSchoolId();

  if (requireSchool && isLive && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader title={title} subtitle={subtitle} right={right} />
        <SuperAdminSchoolBar />
        {loading ? (
          <View style={styles.state}><ActivityIndicator color={c.blue} /></View>
        ) : error ? (
          <View style={[styles.box, { backgroundColor: c.roseSoft, borderColor: c.roseSoft }]}>
            <Icon name="alert" size={22} color={c.rose} />
            <Text style={[styles.boxSub, { color: c.rose }]}>{error}</Text>
            {onRetry ? <TouchableOpacity onPress={onRetry}><Text style={[styles.retry, { color: c.blue }]}>Isku day mar kale</Text></TouchableOpacity> : null}
          </View>
        ) : empty ? (
          <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Icon name={icon || 'note'} size={26} color={c.muted2} />
            <Text style={[styles.boxSub, { color: c.muted }]}>{emptyText || 'Weli xog lama diiwaangelin.'}</Text>
            {onRetry ? <TouchableOpacity onPress={onRetry}><Text style={[styles.retry, { color: c.blue }]}>Dib u cusboonaysii</Text></TouchableOpacity> : null}
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 90 }}>
            {children}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

/* a full module screen: header + super-admin gate/bar + the generic
   list/create module view (Phase5ModuleView is imported lazily by the caller
   to avoid a cycle). */
export function ModuleScreenFrame({ title, subtitle, children }) {
  const { c } = useTheme();
  const { isLive } = useAuth();
  const { needsSchoolSelection } = useActiveSchoolId();
  if (isLive && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={title} subtitle={subtitle} />
        <SuperAdminSchoolBar />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

/* a submit button that disables while saving and blocks duplicate clicks */
export function SaveButton({ onPress, saving, disabled, label = 'Kaydi', savingLabel }) {
  const { c } = useTheme();
  const off = saving || disabled;
  return (
    <TouchableOpacity onPress={saving ? undefined : onPress} disabled={off} activeOpacity={0.9}
      style={[styles.save, { backgroundColor: off ? c.muted2 : c.blue }]}>
      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveTxt}>{label}</Text>}
    </TouchableOpacity>
  );
}

/* a green success banner (auto-provided, callers toggle a boolean) */
export function SuccessNote({ text }) {
  const { c } = useTheme();
  if (!text) return null;
  return (
    <View style={[styles.success, { backgroundColor: c.greenSoft }]}>
      <Icon name="check" size={15} color={c.green} strokeWidth={2.6} />
      <Text style={[styles.successTxt, { color: c.green }]}>{text}</Text>
    </View>
  );
}

/* an inline error line placed where the user can see it */
export function ErrorNote({ text }) {
  const { c } = useTheme();
  if (!text) return null;
  return <Text style={[styles.err, { color: c.rose }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  state: { alignItems: 'center', paddingVertical: 40 },
  box: { borderRadius: 16, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8, marginTop: 12 },
  boxSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  retry: { fontSize: 13, fontWeight: '800', marginTop: 8 },
  save: { height: 50, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  saveTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
  success: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderRadius: 11, marginTop: 12 },
  successTxt: { flex: 1, fontSize: 13, fontWeight: '700' },
  err: { fontSize: 12.5, fontWeight: '700', marginTop: 10, lineHeight: 18 },
});
