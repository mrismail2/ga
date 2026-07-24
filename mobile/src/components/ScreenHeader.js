import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function ScreenHeader({ title, subtitle, right }) {
  const { c } = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: c.muted }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
});
