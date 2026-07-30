import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/* A section heading with a colored accent bar — the shared, platform-wide
   way to introduce a block. Pass `tone` to colour the bar, `action` for a
   trailing control. */
export default function SectionTitle({ title, tone, style, action }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={[styles.bar, { backgroundColor: tone || c.blue }]} />
      <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
      {action ? <View style={{ marginLeft: 'auto' }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 22, marginBottom: 12 },
  bar: { width: 4, height: 18, borderRadius: 3 },
  title: { fontSize: 16, fontWeight: '800' },
});
