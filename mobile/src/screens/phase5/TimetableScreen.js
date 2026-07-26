/* Jadwal — real Supabase timetable. Admins configure periods and entries;
   teachers/students/parents see only their own (RLS). */
import React from 'react';
import { ModuleScreenFrame } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import { p4List } from '../../services/phase4';
import { listTimetableEntries, createTimetableEntry, listTimetablePeriods } from '../../services/phase5';

const DAYS = [
  { value: '1', label: 'Isniin' }, { value: '2', label: 'Talaado' }, { value: '3', label: 'Arbaco' },
  { value: '4', label: 'Khamiis' }, { value: '5', label: 'Jimce' }, { value: '6', label: 'Sabti' }, { value: '0', label: 'Axad' },
];

export default function TimetableScreen() {
  const module = {
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
    listTitle: (r) => (DAYS.find((d) => d.value === String(r.day_of_week)) || {}).label + ' · ' + (r.start_time || '').slice(0, 5),
    listSub: (r) => [r.room].filter(Boolean).join(' · ') || (r.end_time || '').slice(0, 5),
  };
  return (
    <ModuleScreenFrame title="Jadwal" subtitle="Jadwalka fasallada">
      <Phase5ModuleView module={module} />
    </ModuleScreenFrame>
  );
}
