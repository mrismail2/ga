/* ============================================================
   Kobciye — stage-aware School UI terminology (Phase 3, Problem-3 fix)

   Primary/Middle and Secondary schools share ONE SchoolAppShell; the only
   allowed difference is wording, and every screen must take that wording
   from here (backed by config/schoolStages.js) — never from scattered
   `if (stage === 'secondary')` checks.

   The stage comes from the LIVE database profile (profile.school.school_stage,
   loaded by AuthContext). Demo mode, a super_admin with no school row, or a
   pre-classification school all fall back to the neutral Primary/Middle
   terms — Secondary-only wording ("Formamka") never appears by accident.
   ============================================================ */
import { useAuth } from '../context/AuthContext';
import { terminologyForStage } from '../config/schoolStages';

export default function useStageTerminology() {
  const { profile } = useAuth();
  const stage = profile && profile.school ? profile.school.school_stage : null;
  return terminologyForStage(stage);
}
