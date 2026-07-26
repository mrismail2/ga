# Kobciye Phase 1–4 — Final Real-Browser Test Checklist

**Date:** 2026-07-25  
**Archive:** `kobciye_phase1_4_fully_corrected_audited_20260725.zip`

## A. Database — hal mar oo keliya

1. Supabase SQL Editor ka orod `KOBCIYE_PHASE1_4_PREFLIGHT_20260725.sql`.
2. Saddexda `bad_rows` waa inay dhammaantood noqdaan `0`; detail queries-kuna waa inay keenaan `0 rows`.
3. Kadib orod `20260725000001_phase1_4_runtime_integrity.sql`.
4. Waa inuu soo saaraa `Success`.
5. Ha isticmaalin `supabase db reset`, hana tirtirin rows si indho-la'aan ah.
6. Database-ka hadda jira, migration-kan cusub ayaa daboolaya oo ka sarreeya guard-kii `20260724000003`; ha ku celin migration-kii hore haddii aad hore u orodsiisay.

## B. App-ka orodsiintiisa

Gudaha folder-ka `mobile`:

```powershell
npm install
npx expo start -c
```

Hubi `mobile/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

## C. Super Admin

1. Gal Super Admin.
2. Ka hor doorashada dugsi, Classes/Students/Lessons/Messages waa inaanay dirin school query.
3. Riix `Dooro Dugsi`; jaamacaddu yaanay kasoo muuqan selector-ka School Mode.
4. Dooro School A.
5. Fur Fasallada — qaladka UUID `*` waa inuusan jirin.
6. Fur Ardayda, Macallimiinta, Lessons iyo Messages; dhammaantood School A ha raacaan.
7. Samee arday leh fasal iyo sannad-dugsiyeed.
8. Xaqiiji success message-ka.
9. Xaqiiji ardayga:
   - `Ardayda`;
   - `Fasallada → fasalka → Ardayda`;
   - active count-ka fasalka.
10. Refresh samee; xogtu ha sii jirto.
11. `Beddel dugsi` → School B.
12. School A classes, students, lessons, recipients iyo conversations yaanay School B ku sii muuqan.
13. Dugsi cusub iyo casuumaad School Admin tijaabi.

## D. School Admin

Sidan u kala hor mari:

1. Academic year.
2. Term.
3. School level/section.
4. Class.
5. Class stream.
6. Subject fasalkaas ku xiran.
7. Teacher.
8. Teacher assignment sax ah: teacher + subject + class + year + term/stream.
9. Isku day subject/class, stream/class ama term/year aan is lahayn — waa in la diido oo error cad la tuso.
10. `Ardayda → Ku dar Arday`:
    - class la'aan → waa in la diido;
    - academic year la'aan → waa in la diido;
    - xog sax ah → waa in la kaydiyo.
11. Edit ardayga isla fasalka — admission duplicate yaanu samayn.
12. U wareeji fasal kale — enrollment-kii hore `transferred` ha noqdo, hal active enrollment ha haro.
13. Admissions:
    - draft/pending;
    - enrolled admission;
    - guardian la'aan;
    - guardian cusub;
    - guardian hore u jiray.
14. Retry guardian-ka — parent/link duplicate yaanu samayn.
15. Refresh iyo sign out/sign in kadib xogtu ha sii jirto.

## E. Teacher

1. Macallinku ha arko assignment pairs-kiisa oo keliya.
2. Assignment la'aan: demo class/subject yaanu kasoo muuqan, Save-na ha xirmo.
3. Assignment leh: lesson plan ha ku samayn karo pair sax ah oo keliya.
4. School A teacher yaanu arkin School B lessons/messages.
5. Xaadiris, exams, results, fees, discipline iyo reports Live navigation-ka yaanay kasoo muuqan.

## F. Parent

1. Wuxuu arkaa carruurta isaga lagu xidhay oo keliya.
2. Arday kale yaanu muuqan.
3. Phase 5 demo attendance/fees/results yaanay Live dashboard-ka kasoo muuqan.

## G. Student

1. Wuxuu arkaa diiwaankiisa oo keliya.
2. Arday kale ama admin actions yaanay muuqan.
3. Demo attendance/fees/results yaanay Live dashboard-ka kasoo muuqan.

## H. University Admin

1. University shell-ka ha furmo; School Mode erayada/menu-yadu yaanay muuqan.
2. Faculties, Departments, Programmes, Academic Years, Semesters, Courses, Lecturers iyo Students tijaabi.
3. Dashboard count error-ku yaanu isu beddelin `0`; error iyo retry cad ha muuqdaan.
4. Results iyo Transcripts yaanay Phase 1–4 Live navigation-ka kasoo muuqan.

## I. Guud ahaan

- Browser title: `Kobciye School Management`.
- Sign Out: landing page ha ku celiyo.
- Refresh: session iyo xogtu si sax ah ha u soo noqdaan.
- School A account yaanu arkin School B data.
- Save buttons: loading, duplicate-click prevention, visible error, visible success.
- Gabiley Ice ama non-Kobciye runtime file yaanu jirin.
- Phase 5 routes/tabs yaanay Live Mode-ka kasoo muuqan.

**Production-ready ha loo aqoonsan ilaa dhammaan checklist-kan lagu PASS-gareeyo real Supabase browser session.**
