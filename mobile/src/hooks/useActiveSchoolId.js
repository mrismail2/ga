/* ============================================================
   Kobciye — active school resolver

   The ONE hook a school-specific screen uses to get the real uuid it must
   scope its Supabase queries with:

     • School Admin → their own school (from the DB profile)
     • Super Admin  → the school they picked in "Dooro Dugsi" (or null until
                      they pick one)

   The returned value is always a real uuid or null — never "*"/"all"/"".
   `needsSchoolSelection` is true only for a Super Admin who has not picked a
   school yet, which is the screens' cue to render <SchoolSelectPrompt/>
   instead of running any school-specific query.
   ============================================================ */
import { useSchools } from '../context/SchoolContext';

export default function useActiveSchoolId() {
  const { activeSchoolId, needsSchoolSelection, isSuperAdmin } = useSchools();
  return { schoolId: activeSchoolId || null, needsSchoolSelection: !!needsSchoolSelection, isSuperAdmin: !!isSuperAdmin };
}
