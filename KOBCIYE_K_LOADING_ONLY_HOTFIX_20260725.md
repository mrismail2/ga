# Kobciye — K Loading Logo Only Hotfix

**Date:** 2026-07-25  
**Base archive:** `kobciye_phase1_4_superadmin_dashboard_hotfix_20260725.zip`  
**Output archive:** `kobciye_phase1_4_k_loading_only_hotfix_20260725.zip`

## Requested change

Only the latest Kobciye **K mark** is now used for full-screen loading.

## Changes

- Preserved the approved startup `LoadingScreen` with the white K mark.
- Changed the Expo/native splash to use `kobciye-mark-white.png`.
- Removed the obsolete full-wordmark `assets/splash.png`.
- Changed session/profile/shell full-screen loading states from bouncing dots to the same K mark.
- Kept small inline loading dots only inside buttons and compact in-screen actions; these are not loading logos.
- No dashboard, landing-page, authentication-form, database, navigation, or Phase 1–4 workflow was redesigned.

## Files changed

- `mobile/app.json`
- `mobile/src/components/LoadingDots.js`
- `mobile/package.json`
- `mobile/scripts/loading-logo-k-only.test.js` (new)
- `mobile/assets/splash.png` (removed)

## Verification

- K-only loading test: PASS
- Super Admin dashboard hotfix regression: PASS
- Phase 4 correction regression: PASS
- ZIP integrity: PASS
- Database migration required: NO
- Remote Supabase modified: NO
- Phase 5 started: NO
