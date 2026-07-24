import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import useStageTerminology from '../hooks/useStageTerminology';
import Icon from '../components/Icon';
import P4ModuleView from '../components/P4ModuleView';
import GuardianManagementView from '../components/GuardianManagementView';
import { SchoolSelectPrompt, SuperAdminSchoolBar } from '../components/SchoolSelector';
import { useSchools } from '../context/SchoolContext';
import { SCHOOL_MODULES } from '../config/phase4Modules';
import { applySchoolStageToModule } from '../config/schoolStages';
const { canManageSchoolData } = require('../domain/navigationPolicy');

export default function SchoolManagementScreen({ navigation, route }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const auth = useAuth();
  const { needsSchoolSelection } = useSchools();
  const stageTerms = useStageTerminology();
  const requestedKey = route && route.params ? route.params.moduleKey : null;
  const requestedKeys = route && route.params && Array.isArray(route.params.moduleKeys) ? route.params.moduleKeys : [];
  const [activeKey, setActiveKey] = useState(requestedKey || null);
  const modules = useMemo(() => SCHOOL_MODULES.map((module) => applySchoolStageToModule(module, stageTerms)), [stageTerms]);
  const active = modules.find((module) => module.key === activeKey) || null;
  const direct = Boolean(requestedKey);
  const scopedModules = requestedKeys.map((key) => modules.find((module) => module.key === key)).filter(Boolean);

  useEffect(() => { setActiveKey(requestedKey || null); }, [requestedKey]);

  const accessRole = auth.isLive ? auth.roleKey : profile.key;
  if (!canManageSchoolData(accessRole)) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.denied}><Icon name="shield" size={28} color={c.rose} /><Text style={[styles.deniedTitle, { color: c.ink }]}>Ma lihid oggolaansho</Text>
        <Text style={[styles.deniedSub, { color: c.muted }]}>Qaybtan waxaa geli kara Maamulaha Dugsiga oo keliya.</Text>
        <TouchableOpacity onPress={() => navigation && navigation.goBack()} style={[styles.backLink, { backgroundColor: c.blue }]}><Text style={styles.backLinkTxt}>Dib u noqo</Text></TouchableOpacity>
      </View>
    </SafeAreaView>;
  }

  // Super Admin: block every school-management screen until a real school is
  // picked — this is the fix for the "invalid input syntax for type uuid:
  // '*'" crash (Classes and every other school-scoped screen used to run
  // queries with the Super Admin's placeholder school_id before this gate).
  if (auth.isLive && needsSchoolSelection) {
    return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}><SchoolSelectPrompt /></SafeAreaView>;
  }

  const back = () => {
    if (active && !direct) setActiveKey(null);
    else if (navigation) navigation.goBack();
  };

  return <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <SuperAdminSchoolBar />
      <View style={styles.headRow}>
        <TouchableOpacity onPress={back} hitSlop={10} style={[styles.backBtn, { backgroundColor: c.surface, borderColor: c.line }]}><Icon name="back" size={18} color={c.ink} strokeWidth={2.2} /></TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.title, { color: c.ink }]} numberOfLines={1}>{active ? active.title : 'Maamulka Dugsiga'}</Text>
          <Text style={[styles.sub, { color: c.muted }]} numberOfLines={1}>{active ? 'Liiska, ku-darista iyo wax-ka-beddelka' : 'Xogta asaasiga ah ee dugsigaaga'}</Text></View>
      </View>

      {active ? <>
        {scopedModules.length > 1 ? <View style={styles.moduleTabs}>{scopedModules.map((module) => <TouchableOpacity key={module.key} onPress={() => setActiveKey(module.key)}
          style={[styles.moduleTab, { borderColor: active.key === module.key ? c.blue : c.line, backgroundColor: active.key === module.key ? c.blueSoft : c.surface }]}>
          <Text style={[styles.moduleTabTxt, { color: active.key === module.key ? c.blue : c.muted }]}>{module.title}</Text></TouchableOpacity>)}</View> : null}
        {active.key === 'parents' ? <GuardianManagementView /> : <P4ModuleView module={active} titleOverride={active.title} />}
      </> : <View style={styles.grid}>{modules.map((module) => <TouchableOpacity key={module.key} onPress={() => setActiveKey(module.key)} activeOpacity={0.85}
        style={[styles.tile, { backgroundColor: c.surface, borderColor: c.line }]}>
        <View style={[styles.tileIcon, { backgroundColor: c.blueSoft }]}><Icon name={module.icon} size={20} color={c.blue} strokeWidth={2} /></View>
        <Text style={[styles.tileTitle, { color: c.ink }]} numberOfLines={1}>{module.title}</Text><Icon name="chevronRight" size={16} color={c.muted2} />
      </TouchableOpacity>)}</View>}
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 16, paddingBottom: 40, maxWidth: 760, width: '100%', alignSelf: 'center' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }, backBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800' }, sub: { fontSize: 12.5, fontWeight: '600', marginTop: 2 }, grid: { gap: 10 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14 }, tileIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, tileTitle: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  moduleTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }, moduleTab: { borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 11 }, moduleTabTxt: { fontSize: 12, fontWeight: '800' },
  denied: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, deniedTitle: { fontSize: 18, fontWeight: '800', marginTop: 12 }, deniedSub: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 6 },
  backLink: { height: 46, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 18 }, backLinkTxt: { color: '#fff', fontSize: 14, fontWeight: '800' },
});
