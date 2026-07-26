import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useRole } from '../context/RoleContext';
import { useAuth } from '../context/AuthContext';
import { NAV_META } from '../data/roles';
import useStageTerminology from '../hooks/useStageTerminology';
import Icon from './Icon';
import Avatar from './Avatar';
import Logo from './Logo';
const { canRoleNavigate, activateNavigationItem } = require('../domain/navigationPolicy');

/* Desktop sidebar — the left navigation column, mirroring the web app's
   sidebar. Lists the active role's nav items; clicking selects a view. */
export default function Sidebar({ active, onNavigate }) {
  const { c } = useTheme();
  const { profile } = useRole();
  const { isLive, demoActive, signOut } = useAuth();
  const stageTerms = useStageTerminology();
  const items = profile.nav.filter((k) => NAV_META[k] && canRoleNavigate(profile.key, k, isLive));
  // stage-aware wording (Fasallada vs Formamka) — config/schoolStages.js
  const labelFor = (k, label) => (k === 'classes' ? stageTerms.classLabelPlural : label);

  return (
    <View style={[styles.sidebar, { backgroundColor: c.surface, borderRightColor: c.line }]}>
      {/* brand — Kobciye app logo (no upload badge) */}
      <View style={[styles.brand, { borderBottomColor: c.line }]}>
        <Logo size={34} />
      </View>

      <Text style={[styles.navLabel, { color: c.muted2 }]}>MENU</Text>
      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {items.map((k) => {
          const [icon, label, route] = NAV_META[k];
          const on = active === route;
          return (
            <TouchableOpacity
              key={k}
              style={[styles.item, on && { backgroundColor: c.blueSoft }]}
              onPress={() => activateNavigationItem({ roleKey: profile.key, key: k, navMeta: NAV_META, navigate: onNavigate, isLive })}
              activeOpacity={0.7}
            >
              {on && <View style={[styles.activeBar, { backgroundColor: c.blue }]} />}
              <Icon name={icon} size={20} color={on ? c.blue : c.muted} />
              <Text style={[styles.itemTxt, { color: on ? c.navy : c.ink2 }]}>{labelFor(k, label)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* profile footer — with the web Sign Out action. signOut() is the
          REAL authentication termination (AuthContext → Supabase signOut +
          full auth/profile/role state clear); App.js then routes back to
          the Landing/Login gate and every protected screen unmounts, so a
          refresh or browser-back can never reopen protected data. */}
      <View style={[styles.foot, { borderTopColor: c.line }]}>
        <Avatar name={profile.name} code={profile.key} size={38} editable />
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Text style={[styles.fName, { color: c.ink }]} numberOfLines={1}>{profile.name}</Text>
          <Text style={[styles.fRole, { color: c.muted }]} numberOfLines={1}>{profile.labelSo}</Text>
        </View>
        {(isLive || demoActive) ? (
          <TouchableOpacity
            onPress={signOut}
            hitSlop={10}
            style={[styles.signOutBtn, { borderColor: c.line }]}
            accessibilityLabel={isLive ? 'Ka bax (Sign out)' : 'Ka bax Demo'}
          >
            <Icon name="back" size={16} color={c.rose} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 256, borderRightWidth: 1, paddingVertical: 18, paddingHorizontal: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14, marginBottom: 8, borderBottomWidth: 1, paddingHorizontal: 6 },
  markWrap: { width: 38, height: 38 },
  mark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  markImg: { width: 38, height: 38, borderRadius: 19 },
  markTxt: { color: '#fff', fontWeight: '800', fontSize: 20 },
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  brandWord: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  navLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2, position: 'relative' },
  activeBar: { position: 'absolute', left: -14, top: 9, bottom: 9, width: 4, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  itemTxt: { fontSize: 13.5, fontWeight: '600' },
  foot: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, paddingTop: 14, marginTop: 6 },
  fName: { fontSize: 13.5, fontWeight: '700' },
  fRole: { fontSize: 11.5, marginTop: 1 },
  signOutBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
