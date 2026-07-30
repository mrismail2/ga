/* Jadwal — real Supabase timetable. Admins configure teaching days, periods
   and entries. Teacher/Student/Parent rows are RLS-scoped and read-only because
   Phase5ModuleView hides create/edit controls from non-admin roles. */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ModuleScreenFrame } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import { p4List } from '../../services/phase4';
import {
  listTimetableEntries, createTimetableEntry, updateTimetableEntry,
  listTimetablePeriods, createTimetablePeriod, updateTimetablePeriod,
  listSchoolDays, upsertSchoolDay, updateSchoolDay,
} from '../../services/phase5';

const DAYS = [
  { value: '1', label: 'Isniin' }, { value: '2', label: 'Talaado' }, { value: '3', label: 'Arbaco' },
  { value: '4', label: 'Khamiis' }, { value: '5', label: 'Jimce' }, { value: '6', label: 'Sabti' }, { value: '0', label: 'Axad' },
];
const dayLabel = (v) => (DAYS.find((d) => d.value === String(v)) || {}).label || String(v);
const ACTIVE = [{ value: 'active', label: 'Firfircoon' }, { value: 'archived', label: 'Kayd' }];

const ENTRIES_MODULE = {
  single: 'Jadwal', icon: 'clock', emptyText: 'Weli jadwal lama diiwaangelin.',
  list: (schoolId) => listTimetableEntries(schoolId),
  create: (row) => createTimetableEntry(row),
  update: (id, row) => updateTimetableEntry(id, row),
  fields: [
    { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', required: true, fk: { list: (s) => p4List('academic_years', s), labelKey: 'name' } },
    { key: 'term_id', label: 'TERM-KA', fk: { list: (s) => p4List('terms', s), labelKey: 'name' } },
    { key: 'class_id', label: 'FASALKA', required: true, fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
    { key: 'stream_id', label: 'QAYBTA/STREAM-KA', fk: { list: (s) => p4List('class_streams', s), labelKey: 'name' } },
    { key: 'subject_id', label: 'MAADDADA', required: true, fk: { list: (s) => p4List('subjects', s), labelKey: 'name' } },
    { key: 'teacher_id', label: 'MACALLINKA', required: true, fk: { list: (s) => p4List('teachers', s), labelKey: 'full_name' } },
    { key: 'period_id', label: 'XILLIGA', fk: { list: (s) => listTimetablePeriods(s), labelKey: 'name' } },
    { key: 'day_of_week', label: 'MAALINTA', required: true, options: DAYS },
    { key: 'start_time', label: 'BILOW (HH:MM)', required: true, time: true, placeholder: '08:00' },
    { key: 'end_time', label: 'DHAMMAAD (HH:MM)', required: true, time: true, placeholder: '08:45' },
    { key: 'room', label: 'QOLKA', placeholder: 'ikhtiyaari' },
    { key: 'status', label: 'XAALADDA', default: 'active', options: ACTIVE },
  ],
  listTitle: (r) => `${dayLabel(r.day_of_week)} · ${(r.start_time || '').slice(0, 5)}–${(r.end_time || '').slice(0, 5)}`,
  listSub: (r) => [r.room, r.status === 'archived' ? 'Kayd' : null].filter(Boolean).join(' · ') || 'Cashar',
};

const PERIODS_MODULE = {
  single: 'Xilli', icon: 'clock', emptyText: 'Weli xilliyo lama qeexin.',
  list: (schoolId) => listTimetablePeriods(schoolId),
  create: (row) => createTimetablePeriod(row),
  update: (id, row) => updateTimetablePeriod(id, row),
  fields: [
    { key: 'academic_year_id', label: 'SANNAD-DUGSIYEEDKA', fk: { list: (s) => p4List('academic_years', s), labelKey: 'name' } },
    { key: 'name', label: 'MAGACA', required: true, placeholder: 'tusaale: Xilli 1' },
    { key: 'sort_order', label: 'KALSOOCID', number: true, default: '1', placeholder: '1' },
    { key: 'start_time', label: 'BILOW (HH:MM)', required: true, time: true, placeholder: '08:00' },
    { key: 'end_time', label: 'DHAMMAAD (HH:MM)', required: true, time: true, placeholder: '08:45' },
    { key: 'is_break', label: 'NOOCA', default: 'false', bool: true, options: [
      { value: 'false', label: 'Cashar' }, { value: 'true', label: 'Nasasho' },
    ] },
    { key: 'is_active', label: 'XAALADDA', default: 'true', bool: true, options: [
      { value: 'true', label: 'Firfircoon' }, { value: 'false', label: 'Kayd' },
    ] },
  ],
  listTitle: (r) => r.name,
  listSub: (r) => `${(r.start_time || '').slice(0, 5)}–${(r.end_time || '').slice(0, 5)}${r.is_break ? ' · Nasasho' : ''}${!r.is_active ? ' · Kayd' : ''}`,
};

const DAYS_MODULE = {
  single: 'Maalin', icon: 'clock', emptyText: 'Weli maalmo waxbarasho lama dhigin.',
  list: (schoolId) => listSchoolDays(schoolId),
  create: (row) => upsertSchoolDay(row),
  update: (id, row) => updateSchoolDay(id, row),
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
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  tab: { borderWidth: 1.5, borderRadius: 11, paddingVertical: 9, paddingHorizontal: 14 },
  tabTxt: { fontSize: 13, fontWeight: '800' },
});
