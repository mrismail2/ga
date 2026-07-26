# Kobciye Phase 1–4 — Super Admin Dashboard Hotfix

**Date:** 2026-07-25  
**Base:** `kobciye_phase1_4_fully_corrected_audited_20260725.zip`

## Confirmed browser failure

Chrome console reported:

```text
Uncaught TypeError: Cannot read properties of null (reading 'id')
at SchoolHero.js:117
```

## Root cause

The Super Admin dashboard passes a forced platform banner to `SchoolHero`. Before a school is selected, `SchoolContext.active` is intentionally `null`. Although branch switching is unavailable for this banner, the invisible branch-switcher modal was still rendered and its list compared every school using:

```js
s.id === active.id
```

That null dereference crashed the React tree and produced the white dashboard.

## Correction

`mobile/src/components/SchoolHero.js` now:

- renders the branch-switcher modal only when `isSwitchable` is true;
- uses the defensive comparison `s.id === active?.id`;
- preserves the Super Admin platform banner and the separate real school-selection workflow.

No database or migration change was required.

## Verification

Passed:

- `test:super-admin-dashboard-hotfix`
- `test:super-admin-school-context`
- `test:phase1-4-full-audit`

The warnings about touch history, `resizeMode`, `useNativeDriver`, and shadow props are non-fatal development warnings and were not the cause of the blank dashboard.
