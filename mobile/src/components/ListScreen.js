import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import ScreenHeader from './ScreenHeader';
import Icon from './Icon';
import StatCard from './StatCard';
import { shadow } from '../theme/colors';

/* Reusable scaffold for the feature screens: a back-aware header,
   optional stat strip, and a FlatList of rows. Keeps every screen
   consistent and compact. Pass `onAdd` to show a floating + button. */
export default function ListScreen({ navigation, title, subtitle, stats, data, renderItem, headerExtra, onAdd }) {
  const { c } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.content}>
        <ScreenHeader
          title={title}
          subtitle={subtitle}
          right={
            navigation ? (
              <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={[styles.back, { backgroundColor: c.surface, borderColor: c.line }]}>
                <Icon name="back" size={20} color={c.ink} />
              </TouchableOpacity>
            ) : null
          }
        />
        {stats ? (
          <View style={styles.stats}>
            {stats.map((s, i) => (
              <StatCard key={i} label={s.label} value={s.value} tone={s.tone} icon={s.icon} delta={s.delta} />
            ))}
          </View>
        ) : null}
        {headerExtra}
        <FlatList
          data={data}
          keyExtractor={(item, i) => String(i)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: onAdd ? 90 : 24 }}
        />
      </View>
      {onAdd ? (
        <TouchableOpacity style={[styles.fab, { backgroundColor: c.blue }, shadow.card]} onPress={onAdd} activeOpacity={0.85}>
          <Icon name="plus" size={26} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flex: 1, padding: 16 },
  fab: { position: 'absolute', right: 18, bottom: 24, width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  back: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  stat: { flex: 1, minWidth: '46%', borderWidth: 1, borderRadius: 14, padding: 14 },
  sVal: { fontSize: 20, fontWeight: '800' },
  sLbl: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
