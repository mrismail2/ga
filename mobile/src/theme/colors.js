/* ============================================================
   Kobciye Mobile — Design tokens
   Ported from the web app's css/variables.css so the native app
   shares the exact brand identity:
   navy #0A2E6B · gold #CFAD5E · growth green #16A34A
   ============================================================ */

export const light = {
  navy: '#0A2E6B',
  navy600: '#13458F',
  navy300: '#5B7FC4',
  blue: '#2F6BF0',
  blueSoft: '#EAF1FE',
  gold: '#CFAD5E',
  gold700: '#9A7A2E',
  goldSoft: '#FBF1D9',
  green: '#16A34A',
  greenSoft: '#E4F6EC',
  rose: '#E5484D',
  roseSoft: '#FCEBEC',

  bg: '#F4F7FC',
  surface: '#FFFFFF',
  ink: '#0F1B2D',
  ink2: '#3A4A60',
  muted: '#7C8AA0',
  muted2: '#9AA7BC',
  line: '#EBEFF6',
  line2: '#E2E8F2',
};

/* dark palette removed — the app is light-only */

export const radius = { lg: 22, md: 16, sm: 12 };

export const spacing = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 };

export const shadow = {
  card: {
    shadowColor: '#142850',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  sm: {
    shadowColor: '#142850',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

// avatar palette (matches the web app's AV[] array)
export const avatarColors = [
  '#5B5BD6', '#16A34A', '#CFAD5E', '#2F6BF0',
  '#E5484D', '#0891B2', '#7C3AED', '#B45309',
];
