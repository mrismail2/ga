/* Shaqo-guri — complete real Supabase assignment workflow. */
import React from 'react';
import { ModuleScreenFrame } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import { p4List } from '../../services/phase4';
import { listAssignments, createAssignment, updateAssignment } from '../../services/phase5';

export default function AssignmentsScreen({ navigation }) {
  const module = {
    single: 'Shaqo-guri', icon: 'note', emptyText: 'Weli shaqo-guri lama diiwaangelin.',
    createRoles: ['schooladmin', 'superadmin', 'teacher'],
    list: (schoolId) => listAssignments(schoolId),
    create: (row) => createAssignment(row),
    update: (id, row) => updateAssignment(id, row),
    fields: [
      { key: 'title', label: 'CINWAANKA', required: true, placeholder: 'tusaale: Xisaab — Cutubka 3' },
      { key: 'academic_year_id', label: 'SANAD-DUGSIYEEDKA', fk: { list: (s) => p4List('academic_years', s), labelKey: 'name' } },
      { key: 'term_id', label: 'TERM-KA', fk: { list: (s) => p4List('terms', s), labelKey: 'name' } },
      { key: 'class_id', label: 'FASALKA', required: true, fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
      { key: 'stream_id', label: 'STREAM / QAYBTA', fk: { list: (s) => p4List('class_streams', s), labelKey: 'name' } },
      { key: 'subject_id', label: 'MAADDADA', required: true, fk: { list: (s) => p4List('subjects', s), labelKey: 'name' } },
      { key: 'teacher_id', label: 'MACALLINKA', required: true, fk: { list: (s) => p4List('teachers', s), labelKey: 'full_name' } },
      { key: 'instructions', label: 'TILMAAMAHA', placeholder: 'ikhtiyaari' },
      { key: 'assigned_on', label: 'TAARIIKHDA LA BIXIYAY', date: true, required: true, default: new Date().toISOString().slice(0, 10), placeholder: '2026-10-01' },
      { key: 'due_on', label: 'TAARIIKHDA GUDBINTA', date: true, placeholder: '2026-10-07' },
      { key: 'max_score', label: 'DHIBCAHA UGU BADAN', number: true, placeholder: '10' },
      { key: 'allow_resubmission', label: 'DIB-U-GUDBIN MA LA OGGOL YAHAY?', bool: true, default: 'false', options: [{ value: 'false', label: 'Maya' }, { value: 'true', label: 'Haa' }] },
    ],
    listTitle: (r) => r.title,
    listSub: (r) => `${r.status || 'draft'}${r.due_on ? ` · ${r.due_on}` : ''}${r.allow_resubmission ? ' · dib-u-gudbin' : ''}`,
    rowActions: [
      {
        label: 'Daabac', roles: ['schooladmin', 'superadmin', 'teacher'],
        run: async (r, ctx) => {
          if (r.status === 'published') { ctx.setSuccess('Horey ayaa loo daabacay.'); return; }
          try { await updateAssignment(r.id, { status: 'published' }); ctx.setSuccess('Waa la daabacay.'); await ctx.reload(); }
          catch (_e) { ctx.setLoadErr('Lama daabici karin. Hubi fasalka, maaddada iyo macallinka.'); }
        },
      },
      {
        label: 'Xir', roles: ['schooladmin', 'superadmin', 'teacher'],
        run: async (r, ctx) => {
          try { await updateAssignment(r.id, { status: 'closed' }); ctx.setSuccess('Gudbinta waa la xiray.'); await ctx.reload(); }
          catch (_e) { ctx.setLoadErr('Shaqada lama xiri karo.'); }
        },
      },
      {
        label: 'Kaydi/Archive', roles: ['schooladmin', 'superadmin'],
        run: async (r, ctx) => {
          try { await updateAssignment(r.id, { status: 'archived' }); ctx.setSuccess('Shaqada archive ayaa loo wareejiyay.'); await ctx.reload(); }
          catch (_e) { ctx.setLoadErr('Archive lama samayn karo.'); }
        },
      },
      { label: 'Gudbinno', roles: ['schooladmin', 'superadmin', 'teacher'], run: (r, ctx) => { if (ctx.navigation?.navigate) ctx.navigation.navigate('AssignmentSubmissions', { assignment: r }); } },
      { label: 'Gudbi', roles: ['student'], run: (r, ctx) => { if (ctx.navigation?.navigate) ctx.navigation.navigate('AssignmentSubmissions', { assignment: r }); } },
    ],
  };
  return <ModuleScreenFrame title="Shaqo-guri" subtitle="Shaqooyinka guriga"><Phase5ModuleView module={module} navigation={navigation} /></ModuleScreenFrame>;
}
