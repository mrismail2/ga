import React, { useId } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';
import { shadow } from '../theme/colors';
import Icon from './Icon';

const TONES = {
  blue: (c) => ({ bg: c.blueSoft, fg: c.blue, g1: '#3F7FF0', g2: '#2F6BF0' }),
  gold: (c) => ({ bg: c.goldSoft, fg: c.gold700, g1: '#D9BC6E', g2: '#CFAD5E' }),
  green: (c) => ({ bg: c.greenSoft, fg: c.green, g1: '#22C55E', g2: '#16A34A' }),
  navy: (c) => ({ bg: c.blueSoft, fg: c.navy, g1: '#13458F', g2: '#0A2E6B' }),
  rose: (c) => ({ bg: c.roseSoft, fg: c.rose, g1: '#F2686C', g2: '#E5484D' }),
};

/* Premium stat card — a gradient icon tile, a bold value and a trend
   pill. Shared by every dashboard, Finance, Exams and Billing so the
   whole app gets one cohesive, eye-catching summary style. */
export default function StatCard({ label, value, tone = 'blue', delta, icon }) {
  const { c } = useTheme();
  const t = (TONES[tone] || TONES.blue)(c);
  const down = typeof delta === 'string' && delta.trim().startsWith('-');
  // unique gradient id per instance — SVG ids are document-global, so a
  // shared id would make sibling cards resolve to the wrong gradient.
  const gid = 'sg' + useId().replace(/[:]/g, '');

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, shadow.card]}>
      <View style={styles.top}>
        {/* gradient icon tile */}
        <View style={styles.tile}>
          <Svg width={38} height={38} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={t.g1} />
                <Stop offset="1" stopColor={t.g2} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="38" height="38" rx="11" fill={`url(#${gid})`} />
          </Svg>
          <View style={{ zIndex: 1 }}>
            <Icon name={icon || 'dashboard'} size={19} color="#fff" />
          </View>
        </View>

        {/* trend pill — chevron rotated to point up (gain) / down (loss) */}
        {delta ? (
          <View style={[styles.pill, { backgroundColor: down ? c.roseSoft : c.greenSoft }]}>
            <View style={{ transform: [{ rotate: down ? '90deg' : '-90deg' }] }}>
              <Icon name="chevronRight" size={12} color={down ? c.rose : c.green} />
            </View>
            <Text style={[styles.pillTxt, { color: down ? c.rose : c.green }]}>{delta}</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.value, { color: c.ink }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[styles.label, { color: c.muted }]} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, minWidth: '46%', borderRadius: 18, borderWidth: 1, padding: 15 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tile: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingLeft: 4, paddingRight: 8, paddingVertical: 3, borderRadius: 20 },
  pillTxt: { fontSize: 11, fontWeight: '800' },
  value: { fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  label: { fontSize: 12.5, fontWeight: '600', marginTop: 2 },
});
