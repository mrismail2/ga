/* Shaqo-guri — real Supabase assignments. A teacher creates for an assigned
   class+subject; publish notifies parents. Students/parents see published
   assignments for their enrollment (RLS). */
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
    fields: [
      { key: 'title', label: 'CINWAANKA', required: true, placeholder: 'tusaale: Xisaab — Cutubka 3' },
      { key: 'class_id', label: 'FASALKA', required: true, fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
      { key: 'subject_id', label: 'MAADDADA', required: true, fk: { list: (s) => p4List('subjects', s), labelKey: 'name' } },
      { key: 'teacher_id', label: 'MACALLINKA', required: true, fk: { list: (s) => p4List('teachers', s), labelKey: 'full_name' } },
      { key: 'instructions', label: 'TILMAAMAHA', placeholder: 'ikhtiyaari' },
      { key: 'due_on', label: 'TAARIIKHDA GUDBINTA (YYYY-MM-DD)', date: true, placeholder: '2026-10-01' },
      { key: 'max_score', label: 'DHIBCAHA UGU BADAN', number: true, placeholder: '10' },
    ],
    listTitle: (r) => r.title,
    listSub: (r) => (r.status || 'draft') + (r.due_on ? ' · ' + r.due_on : ''),
    rowActions: [
      {
        label: 'Daabac',
        roles: ['schooladmin', 'superadmin', 'teacher'],
        run: async (r, ctx) => {
          if (r.status === 'published') { ctx.setSuccess('Horey ayaa loo daabacay.'); return; }
          try { await updateAssignment(r.id, { status: 'published' }); ctx.setSuccess('Waa la daabacay.'); await ctx.reload(); }
          catch (e) { ctx.setLoadErr('Lama daabici karin.'); }
        },
      },
      // teacher/admin review + grade submissions
      { label: 'Gudbinno', roles: ['schooladmin', 'superadmin', 'teacher'], run: (r, ctx) => { if (ctx.navigation && ctx.navigation.navigate) ctx.navigation.navigate('AssignmentSubmissions', { assignment: r }); } },
      // a student submits their own work (RLS lets them insert only their own)
      { label: 'Gudbi', roles: ['student'], run: (r, ctx) => { if (ctx.navigation && ctx.navigation.navigate) ctx.navigation.navigate('AssignmentSubmissions', { assignment: r }); } },
    ],
  };
  return (
    <ModuleScreenFrame title="Shaqo-guri" subtitle="Shaqooyinka guriga">
      <Phase5ModuleView module={module} navigation={navigation} />
    </ModuleScreenFrame>
  );
}
