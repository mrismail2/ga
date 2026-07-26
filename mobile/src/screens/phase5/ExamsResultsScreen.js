/* Imtixaanno / Natiijooyin — real Supabase exams + the draft→submitted→
   approved→published result workflow. Admin creates exams and runs the
   approval/publish steps; teachers enter results for assigned pairs; publish
   notifies parents. Students/parents see only published results (RLS). */
import React from 'react';
import { ModuleScreenFrame } from '../../components/Phase5Scaffold';
import Phase5ModuleView from '../../components/Phase5ModuleView';
import { p4List } from '../../services/phase4';
import { listExams, createExam, submitResults, approveResults, publishResults } from '../../services/phase5';

export default function ExamsResultsScreen() {
  const module = {
    single: 'Imtixaan', icon: 'exams', emptyText: 'Weli imtixaan lama diiwaangelin.',
    list: (schoolId) => listExams(schoolId),
    create: (row) => createExam(row),
    fields: [
      { key: 'title', label: 'CINWAANKA', required: true, placeholder: 'tusaale: Imtixaanka Dhexe' },
      { key: 'class_id', label: 'FASALKA', required: true, fk: { list: (s) => p4List('classes', s), labelKey: 'name' } },
      { key: 'subject_id', label: 'MAADDADA', required: true, fk: { list: (s) => p4List('subjects', s), labelKey: 'name' } },
      { key: 'teacher_id', label: 'MACALLINKA', fk: { list: (s) => p4List('teachers', s), labelKey: 'full_name' } },
      { key: 'term_id', label: 'XILLIGA', fk: { list: (s) => p4List('terms', s), labelKey: 'name' } },
      { key: 'full_marks', label: 'BUUXA', number: true, default: '100', placeholder: '100' },
      { key: 'pass_mark', label: 'LAGA GUDBO', number: true, default: '50', placeholder: '50' },
      { key: 'status', label: 'XAALADDA', default: 'draft', options: [
        { value: 'draft', label: 'Qabyo' }, { value: 'published', label: 'La daabacay' },
      ] },
    ],
    listTitle: (r) => r.title,
    listSub: (r) => (r.status || 'draft') + ' · ' + (r.full_marks || 100) + ' dhibcood',
    rowActions: [
      { label: 'Gudbi', run: async (r, ctx) => { try { const n = await submitResults(ctx.schoolId, r.id); ctx.setSuccess(`La gudbiyay: ${n}.`); } catch (e) { ctx.setLoadErr('Lama gudbin karin.'); } } },
      { label: 'Ansixi', run: async (r, ctx) => { try { const n = await approveResults(ctx.schoolId, r.id); ctx.setSuccess(`La ansixiyay: ${n}.`); } catch (e) { ctx.setLoadErr('Kaliya maamulaha ayaa ansixin kara.'); } } },
      { label: 'Daabac', run: async (r, ctx) => { try { const n = await publishResults(ctx.schoolId, r.id); ctx.setSuccess(`La daabacay: ${n}. Ogeysiisyo waalid waa la diray.`); } catch (e) { ctx.setLoadErr('Kaliya maamulaha ayaa daabici kara.'); } } },
    ],
  };
  return (
    <ModuleScreenFrame title="Imtixaanno & Natiijooyin" subtitle="Qorshaynta iyo natiijada">
      <Phase5ModuleView module={module} />
    </ModuleScreenFrame>
  );
}
