import React from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import Card from '../components/Card';
import ScreenHeader from '../components/ScreenHeader';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import RoleSwitcher from '../components/RoleSwitcher';
import Icon from '../components/Icon';
import { NAV_META } from '../data/roles';
import useStageTerminology from '../hooks/useStageTerminology';
import { APP } from '../data/mock';
const { canRoleNavigate, activateNavigationItem } = require('../domain/navigationPolicy');

/* Routes that exist as bottom tabs only for some roles. From "More" we
   navigate to their always-present stack alias so it works for every role. */
const STACK_ALIAS = {
  Ardayda: 'ArdaydaStack',
  Fasallada: 'FasalladaStack',
  Attendance: 'AttendanceStack',
  Finance: 'FinanceStack',
  Messages: 'MessagesStack',
};

/* a tinted chip colour per menu icon, so the hub reads at a glance */
const ICON_TONE = {
  advisor: 'blue', simulator: 'blue', students: 'blue', teachers: 'gold',
  classes: 'green', attendance: 'green', finance: 'navy', billing: 'gold',
  exams: 'blue', lessons: 'gold', incidents: 'rose', notice: 'gold',
  reports: 'blue', permissions: 'navy', messages: 'blue', management: 'navy', settings: 'navy',
};
const toneOf = (c, icon) => {
  const map = {
    blue: { bg: c.blueSoft, fg: c.blue }, gold: { bg: c.goldSoft, fg: c.gold700 },
    green: { bg: c.greenSoft, fg: c.green }, navy: { bg: c.blueSoft, fg: c.navy },
    rose: { bg: c.roseSoft, fg: c.rose },
  };
  return map[ICON_TONE[icon] || 'blue'];
};

/* Role-aware hub: lists every nav item the current role is allowed to
   open. Tabs already cover the top few; this reaches all the rest so
   no feature is hidden on mobile. */
export default function MoreScreen({ navigation }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive, demoActive, signOut } = useAuth();
  const stageTerms = useStageTerminology();
  // stage-aware wording (Fasallada vs Formamka) — config/schoolStages.js
  const labelFor = (k, label) => (k === 'classes' ? stageTerms.classLabelPlural : label);

  // everything in the role's nav except the dashboard (always a tab)
  const items = profile.nav.filter((k) => k !== 'dashboard' && NAV_META[k] && canRoleNavigate(profile.key, k, isLive));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Dheeraad" />

        <Card style={styles.profile}>
          <Avatar name={profile.name} code={profile.key} size={52} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.pName, { color: c.ink }]}>{profile.name}</Text>
            <Text style={[styles.pRole, { color: c.muted }]}>{profile.sub}</Text>
          </View>
        </Card>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLbl, { color: c.muted }]}>DOORKA HADDA</Text>
          <View style={[styles.switchPill, { backgroundColor: c.navy }]}>
            <RoleSwitcher />
          </View>
        </View>

        <Text style={[styles.section, { color: c.ink }]}>Qaybaha ({items.length})</Text>
        <Card padded={false}>
          {items.map((k, i) => {
            const [icon, label, route] = NAV_META[k];
            const t = toneOf(c, icon);
            return (
              <TouchableOpacity
                key={k}
                style={[styles.link, { borderTopColor: c.line, borderTopWidth: i === 0 ? 0 : 1 }]}
                activeOpacity={0.6}
                onPress={() => activateNavigationItem({
                  roleKey: profile.key,
                  key: k,
                  navMeta: NAV_META,
                  navigate: (nextRoute) => navigation.navigate(STACK_ALIAS[nextRoute] || nextRoute),
                  isLive,
                })}
              >
                <View style={[styles.linkChip, { backgroundColor: t.bg }]}>
                  <Icon name={icon} size={19} color={t.fg} />
                </View>
                <Text style={[styles.linkTxt, { color: c.ink }]}>{labelFor(k, label)}</Text>
                <Icon name="chevronRight" size={18} color={c.muted2} />
              </TouchableOpacity>
            );
          })}
        </Card>

        {(isLive || demoActive) ? (
          <TouchableOpacity style={[styles.signOut, { borderColor: c.rose }]} onPress={signOut} activeOpacity={0.85}>
            <Icon name="back" size={17} color={c.rose} />
            <Text style={[styles.signOutTxt, { color: c.rose }]}>{isLive ? 'Ka bax (Sign out)' : 'Ka bax Demo'}</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.version, { color: c.muted2 }]}>{APP.name} · v{APP.version}{isLive ? ' · Live' : (demoActive ? ' · Demo' : '')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  profile: { flexDirection: 'row', alignItems: 'center' },
  pName: { fontSize: 17, fontWeight: '800' },
  pRole: { fontSize: 12.5, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 4 },
  switchLbl: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.3 },
  switchPill: { borderRadius: 20 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 22, marginBottom: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13, paddingHorizontal: 14 },
  linkChip: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  linkTxt: { flex: 1, fontSize: 14.5, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 24 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 12, borderWidth: 1.5, marginTop: 24 },
  signOutTxt: { fontSize: 14.5, fontWeight: '800' },
});
