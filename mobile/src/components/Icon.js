import React from 'react';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

/* ============================================================
   Kobciye Mobile — Icon set
   These are the EXACT same line icons the web app uses (copied
   from dashboard/index.html), re-drawn with react-native-svg.
   Stroke-based, 24×24, round caps — no emoji.
   ============================================================ */

const ICONS = {
  dashboard: (
    <>
      <Rect x="3" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  advisor: (
    <>
      <Path d="M12 3a4 4 0 0 1 4 4c1.5.7 2.5 2.2 2.5 4a4.5 4.5 0 0 1-1 2.8A4 4 0 0 1 14 20H10a4 4 0 0 1-3.5-6.2A4.5 4.5 0 0 1 5.5 11c0-1.8 1-3.3 2.5-4a4 4 0 0 1 4-4Z" />
      <Path d="M9 21h6M12 14v3" />
    </>
  ),
  students: (
    <>
      <Circle cx="9" cy="8" r="3.2" />
      <Path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <Path d="M16 5.2a3 3 0 0 1 0 5.6M18 19a5.4 5.4 0 0 0-2.6-4.6" />
    </>
  ),
  teachers: (
    <>
      <Path d="M12 3 2.5 8 12 13l9.5-5L12 3Z" />
      <Path d="M6 10v5c0 1.6 2.7 3 6 3s6-1.4 6-3v-5" />
      <Path d="M21.5 8v5" />
    </>
  ),
  classes: (
    <>
      <Rect x="3" y="4" width="18" height="13" rx="2" />
      <Path d="M3 17l4 4M21 17l-4 4M8 9h8M8 12.5h5" />
    </>
  ),
  attendance: (
    <>
      <Rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
      <Path d="M3.5 9h17M8 3v3M16 3v3" />
      <Path d="m9 14 1.8 1.8L14.5 12" />
    </>
  ),
  finance: (
    <>
      <Rect x="3" y="6" width="18" height="13" rx="2.5" />
      <Path d="M3 10h18" />
      <Circle cx="16.5" cy="14.5" r="1.3" />
    </>
  ),
  billing: (
    <>
      <Rect x="3" y="4" width="18" height="16" rx="2.5" />
      <Path d="M3 9h18M8 14h2M14 14h2M8 17h5" />
    </>
  ),
  exams: (
    <>
      <Path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <Path d="M14 3v5h5M8.5 13h7M8.5 17h5" />
    </>
  ),
  lessons: (
    <>
      <Path d="M4 5a2 2 0 0 1 2-2h11v16H6a2 2 0 0 0-2 2V5Z" />
      <Path d="M9 7h5M9 10h5" />
    </>
  ),
  incidents: (
    <>
      <Path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <Path d="M12 9v4M12 17h.01" />
    </>
  ),
  reports: <Path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  messages: (
    <>
      <Path d="M20 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-4.4A8 8 0 1 1 20 11.5Z" />
      <Path d="M9 11h6M9 14h4" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V19a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 13H4.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 6.3 6.3l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V2.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  more: <Path d="M5 12h.01M12 12h.01M19 12h.01" />,
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m20 20-3-3" />
    </>
  ),
  bell: (
    <>
      <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <Path d="M10 19a2 2 0 0 0 4 0" />
    </>
  ),
  profile: (
    <>
      <Circle cx="12" cy="8.5" r="3.5" />
      <Path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  plus: <Path d="M12 5v14M5 12h14" />,
  back: <Path d="m15 6-6 6 6 6" />,
  chevronRight: <Path d="m9 6 6 6-6 6" />,
  close: <Path d="M6 6l12 12M18 6 6 18" />,
  phone: <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 17l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  download: <Path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />,
  send: <Path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  check: <Path d="m5 12 4 4 10-10" />,
  moon: <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  key: (
    <>
      <Circle cx="8" cy="15" r="4" />
      <Path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" />
    </>
  ),
  lock: (
    <>
      <Rect x="4.5" y="10.5" width="15" height="10.5" rx="2.4" />
      <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      <Path d="M12 14.5v2.4" />
    </>
  ),
  eye: (
    <>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <Path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a15.6 15.6 0 0 1-3.3 3.9M6.2 7.1A15.5 15.5 0 0 0 2.5 12S6 19 12 19a9 9 0 0 0 4-.9" />
      <Path d="M10 10.2a3 3 0 0 0 4 4M3 3l18 18" />
    </>
  ),
  arrowLeft: <Path d="M19 12H5M12 19l-7-7 7-7" />,
  heart: <Path d="M12 20s-7-4.5-7-9.5A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.5C19 15.5 12 20 12 20Z" />,
  alert: (
    <>
      <Path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <Path d="M12 9v4M12 17h.01" />
    </>
  ),
  pill: (
    <>
      <Rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <Path d="M8.5 8.5l7 7" />
    </>
  ),
  mic: (
    <>
      <Rect x="9" y="2.5" width="6" height="11" rx="3" />
      <Path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
    </>
  ),
  play: <Path d="M7 4.5l12 7.5-12 7.5V4.5Z" />,
  notice: (
    <>
      <Path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z" />
      <Path d="M15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <Path d="m9 12 2 2 4-4" />
    </>
  ),
  camera: (
    <>
      <Path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
      <Circle cx="12" cy="12.5" r="3" />
    </>
  ),
  edit: <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />,
  trash: <Path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />,
  mail: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Path d="m3 7 9 6 9-6" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11Z" />
      <Circle cx="12" cy="10" r="2.5" />
    </>
  ),
  cake: (
    <>
      <Path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M4 16c2 0 2-1.5 4-1.5S10 16 12 16s2-1.5 4-1.5 2 1.5 4 1.5" />
      <Path d="M12 8V5M12 5l-1-1 1-1 1 1-1 1Z" />
    </>
  ),
  building: (
    <>
      <Path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 21V9h3a1 1 0 0 1 1 1v11" />
      <Path d="M8 7h2M8 11h2M8 15h2" />
    </>
  ),
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  note: (
    <>
      <Path d="M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <Path d="M15 3v4h4M8 12h8M8 16h5" />
    </>
  ),
};

export default function Icon({ name, size = 22, color = '#0F1B2D', strokeWidth = 1.7, fill = 'none' }) {
  const glyph = ICONS[name];
  if (!glyph) return null;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {glyph}
    </Svg>
  );
}
