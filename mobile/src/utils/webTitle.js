/* ============================================================
   Kobciye — browser tab title

   A real browser test showed the tab reading "undefined" instead of the
   app name. app.json's expo.web.name is the templating-time source, but
   nothing guaranteed it actually reached document.title at runtime (a
   stale web export, a missing template substitution, or any Expo web
   config drift can all produce exactly "undefined"). This sets it
   explicitly and unconditionally on web, so the tab title can never regress
   to "undefined" again regardless of build tooling.
   ============================================================ */
import { Platform } from 'react-native';

export const APP_TITLE = 'Kobciye School Management';

export function setWebTitle(title = APP_TITLE) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  try { document.title = title; } catch (e) { /* non-fatal — cosmetic only */ }
}
