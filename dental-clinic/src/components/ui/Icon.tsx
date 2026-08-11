const PATHS: Record<string, string> = {
  dashboard: '<rect x="3" y="3" width="7.5" height="8.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.8"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.8"/><rect x="3" y="15" width="7.5" height="6" rx="1.8"/>',
  patients: '<path d="M16 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.7v1.8"/><circle cx="9.5" cy="7.5" r="3.7"/><path d="M21 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6M15.5 4a3.7 3.7 0 0 1 0 7.1"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M16 2.5v4M8 2.5v4M3 9.8h18"/>',
  tooth: '<path d="M12 3.2c-1.9 0-2.5.9-4 .9C6 4.1 4.5 5.7 4.5 8.2c0 2.8 1.1 4.3 1.7 6.5.5 1.9.6 5.2 2.1 5.2 1.6 0 1.2-4.1 3.7-4.1s2.1 4.1 3.7 4.1c1.5 0 1.6-3.3 2.1-5.2.6-2.2 1.7-3.7 1.7-6.5 0-2.5-1.5-4.1-3.5-4.1-1.5 0-2.1-.9-4-.9Z"/>',
  braces: '<path d="M3 9h18v6H3z"/><path d="M7 9v6M12 9v6M17 9v6"/>',
  payment: '<rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M2.5 9.8h19M6.2 15h3.6"/>',
  balance: '<path d="M12 3v18"/><path d="M5 7h14M7 7l-3 6a3 3 0 0 0 6 0ZM17 7l-3 6a3 3 0 0 0 6 0Z"/>',
  rx: '<path d="M5 20.5V4h4.2a3.2 3.2 0 0 1 0 6.4H5"/><path d="m9 10.4 8.4 10.1M17.4 10.4 9 20.5"/>',
  pharmacy: '<path d="M9.2 3v6.4L4.5 17.7A2 2 0 0 0 6.3 20.7h11.4a2 2 0 0 0 1.8-3L15 9.5V3"/><path d="M8 3h8M7.2 14h9.6"/>',
  inventory: '<path d="m3.2 7.8 8.8-4.6 8.8 4.6v8.4L12 20.8l-8.8-4.6Z"/><path d="m3.2 7.8 8.8 4.7 8.8-4.7M12 12.5v8.3"/>',
  expense: '<path d="M12 2.5v19"/><path d="M16.6 6H9.9a3.3 3.3 0 0 0 0 6.6h4.4a3.3 3.3 0 0 1 0 6.6H6.8"/>',
  reports: '<path d="M3.5 3v17.5H21"/><path d="m7 15.5 3.8-4.6 2.9 2.8 4.8-6.4"/>',
  staff: '<path d="M15.5 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.7v1.8"/><circle cx="9.2" cy="7.5" r="3.7"/><path d="M19 8.2v5.4M21.7 10.9h-5.4"/>',
  audit: '<path d="M14 2.5H7.2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V7.2Z"/><path d="M14 2.5v5.7h4.8M9 12.5h6M9 16h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H2.8a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V2.8a2 2 0 1 1 4 0V3a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.5 1Z"/>',
  queue: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  check: '<path d="M19.5 6.5 9.2 16.8 4.5 12.1"/>',
  alert: '<path d="M10.4 4 2.9 17.3a1.9 1.9 0 0 0 1.6 2.8h15a1.9 1.9 0 0 0 1.6-2.8L13.6 4a1.9 1.9 0 0 0-3.2 0Z"/><path d="M12 9.3v4M12 16.6h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3 1.8"/>',
  print: '<path d="M6.5 9.2V2.8h11v6.4M6.5 17.8H4.6a2 2 0 0 1-2-2v-4.6h18.8v4.6a2 2 0 0 1-2 2h-1.9"/><path d="M6.5 14h11v7.2h-11z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  chevronRight: '<path d="m9.5 18 6-6-6-6"/>',
  moon: '<path d="M20.5 13.2A8.6 8.6 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.6 12h2M19.4 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  upload: '<path d="M20.8 15.2v3.6a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2v-3.6"/><path d="m7.4 7.8 4.6-4.6 4.6 4.6M12 3.2V15"/>',
  document: '<path d="M14 2.5H7.2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V7.2Z"/><path d="M14 2.5v5.7h4.8"/>',
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: PATHS[name] ?? PATHS.dashboard }}
    />
  );
}
