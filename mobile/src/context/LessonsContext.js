/* ============================================================
   Kobciye — Lessons + Ministry review (shared state)

   Lessons live here (not in a single screen) so two very different views
   can read the SAME data:
     • the in-app Casharrada screen (teacher prepares / admin approves), and
     • the code-gated Ministry review portal (Wasaarad views approved plans
       and leaves feedback the teacher then sees).

   Frontend-only: the "ministry" is not a logged-in account — it reaches a
   read-only portal with the school's review code (REVIEW_CODE) and every
   APPROVED lesson is automatically visible there.
   ============================================================ */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { LESSONS, LESSON_DETAILS } from '../data/datasets';

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
  const [lessons, setLessons] = useState(seedLessons);

  const setLessonStatus = useCallback((id, status) => {
    setLessons((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
  }, []);

  const addLesson = useCallback((v, teacher) => {
    setLessons((ls) => [{ ...v, status: 'draft', teacher: teacher || 'Macalin', submitted_at: 'Hadda', ministry_feedback: [] }, ...ls]);
  }, []);

  // ministry leaves a complaint / advice on a lesson → teacher & admin see it
  const addMinistryFeedback = useCallback((id, entry) => {
    setLessons((ls) => ls.map((l) => (l.id === id
      ? { ...l, ministry_feedback: [...(l.ministry_feedback || []), { id: 'fb_' + (l.ministry_feedback || []).length + '_' + id, by: 'Wasaaradda Waxbarashada', ...entry }] }
      : l)));
  }, []);

  return (
    <LessonsContext.Provider value={{ lessons, reviewCode: REVIEW_CODE, setLessonStatus, addLesson, addMinistryFeedback }}>
      {children}
    </LessonsContext.Provider>
  );
}

export const useLessons = () => useContext(LessonsContext);
