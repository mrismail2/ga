# Dependency Audit — `mobile/`

Generated from `npm audit` (npm audit report format) run against
`mobile/package-lock.json` after a clean `npm install`. No dependency was
upgraded, downgraded, or force-fixed to produce this report — it is a
read-only audit, per the task scope ("Do NOT run `npm audit fix --force`",
"do not upgrade Expo, React Native, or major packages automatically").

**Command:** `cd mobile && npm audit`

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 12 |
| Moderate | 6 |
| Low | 0 |
| **Total** | **18** |

Every one of the 18 traces back to just **6 underlying advisories** —
`npm audit` reports one line per affected package in the dependency graph,
so the same root cause (e.g. `@xmldom/xmldom`) shows up multiple times
under every package that depends on it.

## Root-cause advisories

| Package | Severity | Direct or transitive | Pulled in by | Safe non-breaking fix? |
|---|---|---|---|---|
| `@xmldom/xmldom` (≤0.8.12) | High | Transitive | `@expo/plist` → `@expo/config-plugins` → `@expo/cli`/`expo` | ❌ No — only via `expo@57.0.1` (major, breaking) |
| `tar` (≤7.5.15) | High | Transitive | `cacache` → `@expo/cli` → `expo` | ❌ No — only via `expo@57.0.1` (major, breaking) |
| `postcss` (<8.5.10) | Moderate | Transitive | `@expo/metro-config` → `expo` | ❌ No — only via `expo@57.0.1` (major, breaking) |
| `uuid` (<11.1.1) | Moderate | Transitive | `@expo/bunyan`/`xcode` → `@expo/cli` → `expo` | ❌ No — only via `expo@57.0.1` (major, breaking) |
| `js-yaml` (<3.15.0) | Moderate | Transitive | `@istanbuljs/load-nyc-config`, `cosmiconfig` (dev/test tooling) | ✅ **Yes** — `npm audit fix` resolves this alone without touching `expo` |
| `expo` / `expo-asset` (direct) | High | **Direct** | `mobile/package.json` (`expo: ~52.0.0`, `expo-asset: ~11.0.5`) | ❌ No — these two are flagged only because they *depend on* the vulnerable transitives above; the fix npm proposes is bumping to `expo@57.0.1`, a 5-major-version jump |

**Full list of the 18 reported entries** (all fold into the 6 rows above):
`@expo/bunyan`, `@expo/cli`, `@expo/config`, `@expo/config-plugins`,
`@expo/metro-config`, `@expo/plist`, `@expo/prebuild-config`,
`@expo/rudder-sdk-node`, `@xmldom/xmldom`, `cacache`, `expo` *(direct)*,
`expo-asset` *(direct)*, `expo-constants`, `js-yaml`, `postcss`, `tar`,
`uuid`, `xcode`.

## What this means in practice

- **Nothing here is reachable from the shipped app.** Every vulnerable
  package (`@xmldom/xmldom`, `tar`, `postcss`, `uuid`, `js-yaml`, `xcode`,
  `@expo/bunyan`) is part of the **Expo CLI / build tooling** — code that
  runs on a developer's machine during `npx expo start` / `npx expo
  export`, not code bundled into the production web/app output. The
  `dist/` bundle produced by `npx expo export --platform web` does not
  contain any of these packages.
- `npm audit fix` (no `--force`) only resolves the `js-yaml` line; npm
  reports no other non-breaking fix. Every other advisory's only proposed
  resolution is `expo@57.0.1`, jumping from the currently pinned
  `expo: ~52.0.0` — a major-version upgrade of the framework itself, which
  the task explicitly says not to do automatically.

## Recommendation: defer to Phase 8

All 18 findings should be **deferred to Phase 8** (or whenever a planned
Expo SDK upgrade is scheduled), because:

1. They are exclusively dev/build-time tooling vulnerabilities, not
   runtime/production risk.
2. The only fix path is a 5-major-version Expo SDK bump (52 → 57), which
   is exactly the kind of change this task and the security-hardening work
   in progress were scoped to avoid ("do not upgrade Expo... major
   packages automatically", "do not redesign the UI... or migrate feature
   modules") — an SDK jump that size needs its own dedicated
   compatibility pass (React Native version, native modules, Expo Router
   if adopted, etc.), not a drive-by dependency bump.
3. `js-yaml` is the one exception with a truly safe, isolated fix
   (`npm audit fix`, no `--force`, doesn't touch `expo`) — a maintainer can
   apply that independently at any time with effectively no risk; it just
   wasn't run here since Phase 2's task scope was audit/report only, not
   "apply fixes."

## Next steps for Phase 8

- [ ] Run `npm audit fix` for the isolated `js-yaml` fix (safe, unrelated to Expo).
- [ ] Plan the Expo SDK 52 → 57 upgrade as its own tracked task: review the
      [Expo SDK upgrade guide](https://docs.expo.dev/) for 53→54→55→56→57,
      re-test `react-native`/`react-navigation`/`react-native-svg` compatibility,
      re-run `npm run audit:foundation` and `npx expo export --platform web`
      after the bump.
- [ ] Re-run `npm audit` after the upgrade to confirm all 18 are resolved.
