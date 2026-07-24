import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { shadow } from '../theme/colors';
import Avatar from './Avatar';
import Badge from './Badge';
import Icon from './Icon';

/* Generic card row used across feature screens:
   optional avatar, title + subtitle, optional right badge/value.
   Pass `verified` to show a small blue check next to the title. */
export default function RowCard({ avatarName, avatarCode, color, title, subtitle, meta, badge, verified, unread, onPress }) {
  const { c } = useTheme();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.line }, shadow.sm]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {avatarName ? (
        <Avatar name={avatarName} code={avatarCode || avatarName} size={44} />
      ) : null}
      <View style={{ flex: 1, marginLeft: avatarName ? 12 : 0 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: c.ink, fontWeight: unread ? '800' : '700' }]} numberOfLines={1}>{title}</Text>
          {verified ? (
            <View style={[styles.verified, { backgroundColor: c.blue }]}>
              <Icon name="check" size={9} color="#fff" strokeWidth={3} />
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={[styles.sub, { color: unread ? c.ink2 : c.muted, fontWeight: unread ? '600' : '400' }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {meta ? <Text style={[styles.meta, { color: unread ? c.blue : c.ink2 }]}>{meta}</Text> : null}
        {unread ? <View style={[styles.unreadDot, { backgroundColor: c.blue }]} /> : null}
      </View>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 4 },
  dot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dotTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verified: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '700', flexShrink: 1 },
  sub: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 13, fontWeight: '700', marginLeft: 8 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
});
