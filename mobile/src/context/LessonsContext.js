/* ============================================================
   Kobciye — Lessons + Ministry review (shared state)

   DEMO mode keeps the seeded prototype lessons in memory.

   LIVE mode reads ONLY canonical lesson_plans rows from Supabase and scopes
   every operation to the validated active school UUID resolved by
   SchoolContext:
     • School Admin / Teacher -> their own school
     • Super Admin -> the real school selected in "Dooro Dugsi"

   A missing Super Admin selection produces an honest empty state and never
   falls back to demo lessons. Switching schools clears the previous school's
   rows immediately and stale async responses are ignored.
   ============================================================ */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { LESSONS, LESSON_DETAILS } from '../data/datasets';
import { useAuth } from './AuthContext';
import useActiveSchoolId from '../hooks/useActiveSchoolId';
import { listLessonPlans, createLessonPlan, setLessonPlanStatus } from '../services/lessonPlans';
import { onCanonicalChange } from '../services/canonicalStore';

export const REVIEW_CODE = 'WAS-HID-2026';

function seedLessons() {
  return LESSONS.map((t, i) => ({
    id: 'lesson_seed_' + i, subject: t[0], cls: t[1], title: t[2], status: t[3],
    teacher: t[4], submitted_at: t[5], ministry_feedback: [], ...(LESSON_DETAILS[t[2]] || {}),
  }));
}

const LessonsContext = createContext(null);

export function LessonsProvider({ children }) {
  const { isLive, profile } = useAuth();
  const { schoolId, needsSchoolSelection } = useActiveSchoolId();
  const [demoLessons, setDemoLessons] = useState(seedLessons);
  const [liveLessons, setLiveLessons] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const requestSeq = useRef(0);

  const reloadLive = useCallback(async () => {
    const requestId = ++requestSeq.current;
    // Clear old-school data before a new request starts. This also means a
    // Super Admin with no selected school sees zero canonical lessons.
    setLiveLessons([]);
    setLiveError(null);
    if (!isLive || !schoolId) { setLiveLoading(false); return; }
    setLiveLoading(true);
    try {
      const rows = await listLessonPlans(schoolId);
      if (requestSeq.current === requestId) setLiveLessons(rows);
    } catch (e) {
      if (requestSeq.current === requestId) {
        setLiveLessons([]);
        setLiveError((e && e.message) || 'Casharrada lama soo dejin karin.');
      }
    } finally {
      if (requestSeq.current === requestId) setLiveLoading(false);
    }
  }, [isLive, schoolId]);

  useEffect(() => {
    reloadLive();
    return () => { requestSeq.current += 1; };
  }, [reloadLive]);

  useEffect(() => {
    if (!isLive || !schoolId) return undefined;
    return onCanonicalChange((table) => {
      if (table === 'lesson_plans') reloadLive();
    });
  }, [isLive, schoolId, reloadLive]);

  const setLessonStatus = useCallback(async (id, status) => {
    if (isLive) {
      if (!schoolId) throw new Error('Dooro dugsi sax ah.');
      setLiveError(null);
      try {
        const row = await setLessonPlanStatus(id, status);
        setLiveLessons((ls) => ls.map((l) => (l.id === id ? row : l)));
        return row;
      } catch (e) {
        setLiveError((e && e.message) || 'Xaaladda casharka lama beddeli karin.');
        await reloadLive();
        throw e;
      }
    }
    setDemoLessons((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    return null;
  }, [isLive, schoolId, reloadLive]);

  const addLesson = useCallback(async (v, teacher) => {
    if (isLive) {
      if (!schoolId) throw new Error('Dooro dugsi sax ah.');
      if (!profile || !profile.id) throw new Error('Akoon macallin sax ah ayaa loo baahan yahay.');
      setLiveError(null);
      try {
        const row = await createLessonPlan(schoolId, profile.id, teacher, v);
        setLiveLessons((ls) => [row, ...ls.filter((l) => l.id !== row.id)]);
        return row;
      } catch (e) {
        setLiveError((e && e.message) || 'Casharka lama kaydin karin.');
        throw e;
      }
    }
    setDemoLessons((ls) => [{ ...v, status: 'draft', teacher: teacher || 'Macalin', submitted_at: 'Hadda', ministry_feedback: [] }, ...ls]);
    return null;
  }, [isLive, schoolId, profile]);

  const addMinistryFeedback = useCallback((id, entry) => {
    // The code-gated ministry preview remains a demo-only prototype. It is
    // never used as a fallback for an authenticated Live Mode session.
    setDemoLessons((ls) => ls.map((l) => (l.id === id
      ? { ...l, ministry_feedback: [...(l.ministry_feedback || []), { id: 'fb_' + (l.ministry_feedback || []).length + '_' + id, by: 'Wasaaradda Waxbarashada', ...entry }] }
      : l)));
  }, []);

  const lessons = isLive ? liveLessons : demoLessons;

  return (
    <LessonsContext.Provider value={{
      lessons,
      reviewCode: isLive ? null : REVIEW_CODE,
      setLessonStatus,
      addLesson,
      addMinistryFeedback,
      schoolId,
      needsSchoolSelection: isLive && needsSchoolSelection,
      loading: isLive && liveLoading,
      error: isLive ? liveError : null,
      reload: reloadLive,
    }}>
      {children}
    </LessonsContext.Provider>
  );
}

export const useLessons = () => useContext(LessonsContext);
