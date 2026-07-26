/* Jadwal — real Supabase timetable (§7). Three admin editors over one screen:
   • Jadwalka  — class/subject/teacher timetable entries
   • Xilliyada — the daily period grid (name + start/end, breaks)
   • Maalmaha  — which weekdays are teaching days
   Teachers/students/parents see only their own entries (RLS). Admins
   configure all three. No demo data, no device-local storage. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ModuleScreenFrame } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import { p4List } from '../../services/phase4';
import {
  listTimetableEntries, createTimetableEntry,
  listTimetablePeriods, createTimetablePeriod,
  listSchoolDays, upsertSchoolDay,
} from '../../services/phase5';

const DAYS = [
  { value: '1', label: 'Isniin' }, { value: '2', label: 'Talaado' }, { value: '3', label: 'Arbaco' },
  { value: '4', label: 'Khamiis' }, { value: '5', label: 'Jimce' }, { value: '6', label: 'Sabti' }, { value: '0', label: 'Axad' },
];
const dayLabel = (v) => (DAYS.find((d) => d.value === String(v)) || {}).label || String(v);

const ENTRIES_MODULE = {
  single: 'Jadwal', icon: 'clock', emptyText: 'Weli jadwal lama diiwaangelin.',
  list: (schoolId) => listTimetableEntries(schoolId),
  create: (row) => createTimetableEntry(row),
  fields: [
    { key: 'class_id', label: 'FASALKA', required: true, fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
    { key: 'subject_id', label: 'MAADDADA', required: true, fk: { list: (s) => p4List('subjects', s), labelKey: 'name' } },
    { key: 'teacher_id', label: 'MACALLINKA', required: true, fk: { list: (s) => p4List('teachers', s), labelKey: 'full_name' } },
    { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', required: true, fk: { list: (s) => p4List('academic_years', s), labelKey: 'name' } },
    { key: 'day_of_week', label: 'MAALINTA', required: true, options: DAYS },
    { key: 'start_time', label: 'BILOW (HH:MM)', required: true, time: true, placeholder: '08:00' },
    { key: 'end_time', label: 'DHAMMAAD (HH:MM)', required: true, time: true, placeholder: '08:45' },
    { key: 'room', label: 'QOLKA', placeholder: 'ikhtiyaari' },
  ],
  listTitle: (r) => dayLabel(r.day_of_week) + ' · ' + (r.start_time || '').slice(0, 5),
  listSub: (r) => [r.room].filter(Boolean).join(' · ') || (r.end_time || '').slice(0, 5),
};

const PERIODS_MODULE = {
  single: 'Xilli', icon: 'clock', emptyText: 'Weli xilliyo lama qeexin.',
  list: (schoolId) => listTimetablePeriods(schoolId),
  create: (row) => createTimetablePeriod(row),
  fields: [
    { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Xilli 1' },
    { key: 'sort_order', label: 'KALSOOCID', number: true, default: '1', placeholder: '1' },
    { key: 'start_time', label: 'BILOW (HH:MM)', required: true, time: true, placeholder: '08:00' },
    { key: 'end_time', label: 'DHAMMAAD (HH:MM)', required: true, time: true, placeholder: '08:45' },
    { key: 'is_break', label: 'NASASHO', default: 'false', bool: true, options: [
      { value: 'false', label: 'Casharo' }, { value: 'true', label: 'Nasasho' },
    ] },
  ],
  listTitle: (r) => r.name,
  listSub: (r) => (r.start_time || '').slice(0, 5) + '–' + (r.end_time || '').slice(0, 5) + (r.is_break ? ' · Nasasho' : ''),
};

const DAYS_MODULE = {
  single: 'Maalin', icon: 'clock', emptyText: 'Weli maalmo waxbarasho lama dhigin.',
  list: (schoolId) => listSchoolDays(schoolId),
  create: (row) => upsertSchoolDay(row),
  fields: [
    { key: 'day_of_week', label: 'MAALINTA', required: true, options: DAYS },
    { key: 'is_teaching_day', label: 'NOOCA', default: 'true', bool: true, options: [
      { value: 'true', label: 'Maalin waxbarasho' }, { value: 'false', label: 'Fasax' },
    ] },
  ],
  listTitle: (r) => dayLabel(r.day_of_week),
  listSub: (r) => (r.is_teaching_day ? 'Maalin waxbarasho' : 'Fasax'),
};

const TABS = [
  { key: 'entries', label: 'Jadwalka', module: ENTRIES_MODULE },
  { key: 'periods', label: 'Xilliyada', module: PERIODS_MODULE },
  { key: 'days', label: 'Maalmaha', module: DAYS_MODULE },
];

export default function TimetableScreen({ navigation }) {
  const { c } = useTheme();
  const [tab, setTab] = useState('entries');
  const active = TABS.find((t) => t.key === tab) || TABS[0];
  return (
    <ModuleScreenFrame title="Jadwal" subtitle="Jadwalka, xilliyada iyo maalmaha">
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = t.key === tab;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} activeOpacity={0.85}
              style={[styles.tab, { borderColor: on ? c.blue : c.line2, backgroundColor: on ? c.blueSoft : c.surface }]}>
              <Text style={[styles.tabTxt, { color: on ? c.blue : c.muted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Phase5ModuleView key={tab} module={active.module} navigation={navigation} />
    </ModuleScreenFrame>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { borderWidth: 1.5, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14 },
  tabTxt: { fontSize: 13, fontWeight: '800' },
});
