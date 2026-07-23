import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

/* tone → [background, text] using theme tokens */
function toneColors(c, tone) {
  switch (tone) {
    case 'green': return [c.greenSoft, c.green];
    case 'gold': return [c.goldSoft, c.gold700];
    case 'rose': return [c.roseSoft, c.rose];
    case 'blue': return [c.blueSoft, c.blue];
    case 'navy': return [c.blueSoft, c.navy];
    case 'muted': return [c.line, c.muted];
    default: return [c.blueSoft, c.blue];
  }
}

export default function Badge({ label, tone = 'blue', style }) {
  const { c } = useTheme();
  const [bg, fg] = toneColors(c, tone);
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.txt, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20, alignSelf: 'flex-start' },
  txt: { fontSize: 12, fontWeight: '700' },
});
