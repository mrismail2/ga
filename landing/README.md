# Kobciye Landing Page

**Kobciye** — Cloud-Based School Management System

## Project Overview

Modern landing page for Kobciye, a comprehensive school management platform designed for East African educational institutions. The site showcases key features, pricing, and contact information in both English and Somali.

## Files

- **index.html** — the standalone marketing landing (Design Component runtime via `support.js`)
- **config.js** — public landing config (WhatsApp number + real app login URL)
- **support.js** — DC runtime for `index.html`
- **assets/kobciye-logo.png** — Logo for light backgrounds (navbar)
- **assets/kobciye-logo-white.png** — Logo for dark backgrounds (footer, mockups)

## Landing source of truth & the two implementations

There are two landing implementations that MUST share the same business behaviour:

1. **`landing/index.html`** — the standalone marketing site. **This is the
   canonical landing** (design + copy). Configure it via `landing/config.js`.
2. **`mobile/src/screens/landing/KobciyeLanding.js`** — a React/React-Native
   mirror of `index.html`, rendered inside the Expo app on web. It is kept in
   sync by hand with `index.html` (a previous auto-conversion step is no longer
   part of the repo). When you change one, mirror the change in the other and
   run `cd mobile && npm run test:onboarding`, which inspects **both** files.

### Public onboarding rules (enforced by tests)

- **No public school self-registration.** A public visitor can NEVER create a
  Kobciye account, school, role, invitation, or Supabase/AsyncStorage/localStorage
  record from the landing.
- **"Diiwaan geli Dugsigaaga" is a WhatsApp ENQUIRY flow only.** It opens an
  information + enquiry form; on submit it builds a prefilled message and opens
  the Kobciye owner's WhatsApp (`wa.me`). The visitor manually taps **Send**.
- **Real school registration happens only in the authenticated Super Admin
  Dashboard** (Create School & Send Invite → email invite → the school admin sets
  their own password). See `../PHASE_3_SCHOOL_ONBOARDING.md`.
- **"Login" routes only to the real app login** (email + password). There is no
  landing-page role picker, no password field, and no fake role-based preview.

### Configure the public WhatsApp number (public, not a secret)

- **Standalone (`index.html`)**: edit `landing/config.js` →
  `window.KOBCIYE_LANDING_WHATSAPP_NUMBER = '252XXXXXXXXX'` (DIGITS ONLY —
  country code + number, no `+`, spaces or dashes). Also set
  `window.KOBCIYE_APP_LOGIN_URL` to your deployed app login URL.
- **Mobile (`KobciyeLanding.js`)**: set `EXPO_PUBLIC_LANDING_WHATSAPP_NUMBER`
  in `mobile/.env` (see `mobile/.env.example`), same digits-only format.
- Both default to the existing public business number if unset.

## Design System

- **Color Palette**
  - Dark Navy: `#0F1B2D`
  - Accent Gold: `#CFAD5E`
  - Green (CTA): `#16A34A`
  - Slate Gray: `#3A4A60`, `#7C8AA0`

- **Typography**
  - Headings: Bold, letter-spacing -0.4px
  - Body: 14-16px, line-height 1.6
  - Accent: Gold highlight on key terms

## Sections

1. **Hero** — Value proposition with CTA
2. **Features** — 4 key nidaamyada (systems)
3. **Imtixaannada** — Exam management section
4. **Pricing** — 3 subscription tiers
5. **Contact** — Links to WhatsApp, phone, address
6. **Footer** — Logo, links, copyright

## Creator

**Fahiyeyaha (Lead): Ismail Abdirahmaan Ahmed**

## Technical

Built as a Design Component (DC) for streaming, responsive design, and live editing. Supports both light and dark logo variants for flexible placement.
