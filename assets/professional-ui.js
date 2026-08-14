(() => {
  const icons = {
    overview: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    command: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
    dispatch: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92z"/>',
    operations: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    officers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    roster: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    cases: '<path d="M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2"/>',
    arrests: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    citizens: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5.5 16c.7-2 4.3-2 5 0M13 9h5M13 13h5"/>',
    evidence: '<path d="M4 7h16v14H4z"/><path d="M7 3h10l2 4H5zM9 11h6"/>',
    documents: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    custody: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    prison: '<path d="M4 21V5l8-3 8 3v16M8 7v2M12 7v2M16 7v2M8 12v2M12 12v2M16 12v2M9 21v-4h6v4"/>',
    patrol: '<path d="M5 17h14l2-5-2-5H5l-2 5z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M7 7l2-3h6l2 3M3 12h18"/>',
    traffic: '<path d="M5 17h14l2-5-2-5H5l-2 5z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
    intelligence: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    complaints: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.5-5A8 8 0 1 1 21 15z"/><path d="M8 10h8M8 14h5"/>',
    tasks: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 2 2 4-4M8 15h8"/>',
    fieldreports: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>',
    myreports: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    reports: '<path d="M4 19V9M10 19V5M16 19v-7M22 19V3"/>',
    finance: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1a1.7 1.7 0 0 0 1.1 1.5 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.36.34.7.6 1 .28.31.67.5 1.1.5h.1v4h-.1c-.43 0-.82.19-1.1.5-.26.3-.47.64-.6 1z"/>'
  };

  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  function applyNavIcons() {
    document.querySelectorAll('.sidebar-link[data-page] .nav-icon').forEach((slot) => {
      const page = slot.closest('.sidebar-link')?.dataset.page;
      if (page && icons[page]) slot.innerHTML = svg(icons[page]);
    });
  }

  const summaryIconBodies = [icons.reports, icons.cases, icons.officers, icons.tasks];
  function applySummaryIcons() {
    document.querySelectorAll('.summary-icon').forEach((slot, index) => {
      if (!slot.querySelector('svg')) slot.innerHTML = svg(summaryIconBodies[index % summaryIconBodies.length]);
    });
  }

  function applyTopbarIcons() {
    const search = document.querySelector('.dashboard-search > span');
    if (search) search.innerHTML = svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>');
    const theme = document.querySelector('#dashboardThemeToggle > span');
    if (theme) theme.innerHTML = svg('<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>');
    const notify = document.querySelector('#notificationButton > span');
    if (notify) notify.innerHTML = svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>');
  }

  function applyAll() {
    applyNavIcons();
    applySummaryIcons();
    applyTopbarIcons();
  }

  document.addEventListener('DOMContentLoaded', () => {
    applyAll();
    const target = document.getElementById('summaryGrid');
    if (target) new MutationObserver(applySummaryIcons).observe(target, { childList: true, subtree: true });
  });
})();
