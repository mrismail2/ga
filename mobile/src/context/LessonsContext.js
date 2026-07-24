/* ============================================================
   Kobciye — Lessons + Ministry review (shared state)

   Lessons live here (not in a single screen) so two very different views
   can read the SAME data:
     • the in-app Casharrada screen (teacher prepares / admin approves), and
     • the code-gated Ministry review portal (Wasaarad views approved plans
       and leaves feedback the teacher then sees).

   DEMO mode (unchanged): the seeded prototype lessons, in-memory only.

   LIVE mode: ONLY canonical lesson_plans rows from Supabase — the demo
   LESSONS seed is never used. A new school shows the approved empty
   state; drafts persist after refresh; teachers submit their own plans
   and only a school admin can approve/reject (enforced by the database,
   not just this UI). The Lesson Plan UI itself is untouched.
   ============================================================ */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { LESSONS, LESSON_DETAILS } from '../data/datasets';
import { useAuth } from './AuthContext';
import { listLessonPlans, createLessonPlan, setLessonPlanStatus } from '../services/lessonPlans';
import { onCanonicalChange } from '../services/canonicalStore';

// the school's ministry-review access code (shared with the Wasaarad)
export const REVIEW_CODE = 'WAS-HID-2026';

// seed tuples → rich lesson objects (with the prepared plan detail merged in)
function seedLessons() {
  return LESSONS.map((t, i) => ({
    id: 'lesson_seed_' + i, subject: t[0], cls: t[1], title: t[2], status: t[3],
    teacher: t[4], submitted_at: t[5], ministry_feedback: [], ...(LESSON_DETAILS[t[2]] || {}),
  }));
}

const LessonsContext = createContext(null);

export function LessonsProvider({ children }) {
  const { isLive, profile } = useAuth();
  const [demoLessons, setDemoLessons] = useState(seedLessons);
  const [liveLessons, setLiveLessons] = useState([]);

  const schoolId = isLive && profile ? profile.school_id : null;

  // LIVE: load canonical lesson_plans; reload on any canonical change so an
  // approval made anywhere shows everywhere; refresh-proof by re-reading.
  const reloadLive = useCallback(async () => {
    if (!schoolId) { setLiveLessons([]); return; }
    try { setLiveLessons(await listLessonPlans(schoolId)); }
    catch (e) { setLiveLessons([]); }
  }, [schoolId]);

  useEffect(() => { reloadLive(); }, [reloadLive]);
  useEffect(() => {
    if (!schoolId) return undefined;
    return onCanonicalChange((table) => { if (table === 'lesson_plans') reloadLive(); });
  }, [schoolId, reloadLive]);

  const setLessonStatus = useCallback((id, status) => {
    if (schoolId) {
      // optimistic update, then persist canonically (rolls back via reload on error)
      setLiveLessons((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
      setLessonPlanStatus(id, status).catch(() => reloadLive());
      return;
    }
    setDemoLessons((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
  }, [schoolId, reloadLive]);

  const addLesson = useCallback((v, teacher) => {
    if (schoolId) {
      createLessonPlan(schoolId, profile ? profile.id : null, teacher, v)
        .then((row) => setLiveLessons((ls) => [row, ...ls]))
        .catch(() => reloadLive());
      return;
    }
    setDemoLessons((ls) => [{ ...v, status: 'draft', teacher: teacher || 'Macalin', submitted_at: 'Hadda', ministry_feedback: [] }, ...ls]);
  }, [schoolId, profile, reloadLive]);

  // ministry leaves a complaint / advice on a lesson → teacher & admin see it
  // (demo-only portal feature — untouched in Live Mode)
  const addMinistryFeedback = useCallback((id, entry) => {
    setDemoLessons((ls) => ls.map((l) => (l.id === id
      ? { ...l, ministry_feedback: [...(l.ministry_feedback || []), { id: 'fb_' + (l.ministry_feedback || []).length + '_' + id, by: 'Wasaaradda Waxbarashada', ...entry }] }
      : l)));
  }, []);

  const lessons = schoolId ? liveLessons : demoLessons;

  return (
    <LessonsContext.Provider value={{ lessons, reviewCode: REVIEW_CODE, setLessonStatus, addLesson, addMinistryFeedback }}>
      {children}
    </LessonsContext.Provider>
  );
}

export const useLessons = () => useContext(LessonsContext);
