import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

/* A simple donut/progress ring (percent 0-100). Uses react-native-svg so
   it renders the same on iOS, Android and web — like the web app's
   Chart.js donuts, kept lightweight. */
export default function Donut({ percent = 0, size = 120, stroke = 12, color, label, sub }) {
  const { c } = useTheme();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const dash = (pct / 100) * circ;
  const ring = color || c.blue;

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ring} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.center}>
        <Text style={[styles.pct, { color: c.ink }]}>{pct}%</Text>
        {label ? <Text style={[styles.lbl, { color: c.muted }]}>{label}</Text> : null}
      </View>
      {sub ? <Text style={[styles.sub, { color: c.muted }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  pct: { fontSize: 24, fontWeight: '800' },
  lbl: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 8 },
});
