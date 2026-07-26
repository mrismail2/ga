/* Kiisaska — real Supabase discipline cases. Authorised staff create/update;
   confidential notes are staff-only (RLS); parents see only their child's
   non-confidential header. */
import React from 'react';
import { ModuleScreenFrame } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import { p4List } from '../../services/phase4';
import { listIncidents, createIncident, updateIncident } from '../../services/phase5';

export default function DisciplineScreen() {
  const module = {
    single: 'Kiis', icon: 'incidents', emptyText: 'Weli kiis lama diiwaangelin.',
    list: (schoolId) => listIncidents(schoolId),
    create: (row) => createIncident(row),
    fields: [
      { key: 'title', label: 'CINWAANKA', required: true, placeholder: 'tusaale: Soo daahid joogto ah' },
      { key: 'student_id', label: 'ARDAYGA', fk: { list: (s) => p4List('students', s), labelKey: 'full_name' } },
      { key: 'category', label: 'NOOCA', placeholder: 'tusaale: waqti-xumo' },
      { key: 'detail', label: 'FAAHFAAHIN', placeholder: 'sharraxaad' },
      { key: 'severity', label: 'DARARKA', default: 'dhexe', options: [
        { value: 'hoose', label: 'Hoose' }, { value: 'dhexe', label: 'Dhexe' },
        { value: 'sare', label: 'Sare' }, { value: 'halis', label: 'Halis' },
      ] },
      { key: 'action', label: 'TALLAABADA', placeholder: 'ikhtiyaari' },
      { key: 'follow_up_on', label: 'LA-SOCOD (YYYY-MM-DD)', date: true, placeholder: '2026-10-10' },
    ],
    listTitle: (r) => r.title,
    listSub: (r) => (r.severity || 'dhexe') + ' · ' + (r.status || 'open'),
    rowActions: [{
      label: 'Xir',
      run: async (r, ctx) => {
        if (r.status === 'resolved') { ctx.setSuccess('Horey ayaa loo xiray.'); return; }
        try { await updateIncident(r.id, { status: 'resolved' }); ctx.setSuccess('Kiiska waa la xiray.'); await ctx.reload(); }
        catch (e) { ctx.setLoadErr('Lama xiri karin.'); }
      },
    }],
  };
  return (
    <ModuleScreenFrame title="Kiisaska" subtitle="Anshaxa iyo kiisaska">
      <Phase5ModuleView module={module} />
    </ModuleScreenFrame>
  );
}
