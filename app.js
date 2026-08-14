(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const safeStorage = {
    get(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (_) { /* Storage may be disabled in local previews. */ } }
  };

  const appState = {
    theme: safeStorage.get('nabad-theme') || 'light',
    activePage: 'overview'
  };

  document.documentElement.dataset.theme = appState.theme;

  // Magacyada maalmaha iyo bilaha Soomaaliga
  const SO_DAYS   = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
  const SO_MONTHS = ['Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'May', 'Juun',
                     'Luulyo', 'Agoosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Diseembar'];

  const somaliDate = (date = new Date()) =>
    `${SO_DAYS[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')} ${SO_MONTHS[date.getMonth()]} ${date.getFullYear()}`;

  const setTheme = (theme) => {
    appState.theme = theme;
    document.documentElement.dataset.theme = theme;
    safeStorage.set('nabad-theme', theme);
    $$('.theme-choice button').forEach((button) => {
      button.classList.toggle('active', button.dataset.themeChoice === theme);
    });
    drawAllCharts();
  };

  const toggleTheme = () => setTheme(appState.theme === 'light' ? 'dark' : 'light');
  $('#landingThemeToggle')?.addEventListener('click', toggleTheme);
  $('#dashboardThemeToggle')?.addEventListener('click', toggleTheme);
  $$('[data-theme-choice]').forEach((button) => button.addEventListener('click', () => setTheme(button.dataset.themeChoice)));

  window.addEventListener('load', () => {
    setTimeout(() => $('#siteLoader')?.classList.add('hidden'), 420);
  });

  // Landing navigation
  const navToggle = $('#navToggle');
  const navMenu = $('#navMenu');
  navToggle?.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  $$('#navMenu a').forEach((link) => link.addEventListener('click', () => navMenu?.classList.remove('open')));

  const publicNav = $('#publicNav');
  const backToTop = $('#backToTop');
  window.addEventListener('scroll', () => {
    if (publicNav) publicNav.classList.toggle('scrolled', window.scrollY > 80);
    if (backToTop) backToTop.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
  backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12 })
    : null;

  $$('.reveal').forEach((element) => {
    if (revealObserver) revealObserver.observe(element);
    else element.classList.add('visible');
  });

  const animateCounter = (element) => {
    const target = Number(element.dataset.count || 0);
    let start = 0;
    const duration = 1300;
    const startedAt = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.floor(target * eased);
      element.textContent = target === 96 ? `${start}%` : start.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if ('IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach((counter) => counterObserver.observe(counter));
  }

  $('#publicContactForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form    = event.currentTarget;
    const message = $('#publicFormMessage');
    const button  = form.querySelector('button[type="submit"]');

    button.disabled = true;
    message.style.color = '';
    message.textContent = 'Waa la dirayaa...';

    try {
      const res = await API.submitContact(Object.fromEntries(new FormData(form).entries()));
      message.textContent = res.message;
      form.reset();
    } catch (error) {
      message.style.color = 'var(--red-600)';
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  // Dashboard navigation
  const pageTitles = {
    overview: 'Dashboard-ka Taliyaha',
    command: 'Command Center',
    dispatch: 'Wicitaannada & CAD',
    operations: 'Maamulka Hawlgallada',
    officers: 'Maamulka Saraakiisha',
    roster: 'Jadwalka Shaqada',
    profile: 'Profile-kayga',
    cases: 'Maamulka Kiisaska',
    arrests: 'Xarig & Warrants',
    citizens: 'Diiwaanka Muwaadiniinta',
    evidence: 'Diiwaanka Caddeymaha',
    documents: 'Dukumentiyada La Xakameeyo',
    custody: 'Custody & Booking',
    prison: 'Maamulka Maxaabiista',
    patrol: 'Patrol & Dispatch',
    traffic: 'Traffic & Gaadiidka',
    intelligence: 'Sirdoonka',
    complaints: 'Cabashooyinka Bulshada',
    tasks: 'Hawlaha & Ogeysiisyada',
    fieldreports: 'Warbixinnada Ciidanka',
    myreports: 'Warbixinnadayda',
    reports: 'Warbixinnada Taliska',
    finance: 'Miisaaniyadda',
    users: 'Users & Permissions',
    settings: 'Settings'
  };

  // Rukhsadaha user-ka hadda galay (waxaa laga buuxiyaa session-ka).
  let currentUser = null;
  const allowedPages = () => currentUser?.pages || Object.keys(pageTitles);

  const navigateTo = (page, updateHash = true) => {
    if (!pageTitles[page]) page = 'overview';
    // Ha u oggolaan bog uusan rolku rukhsad u lahayn.
    if (currentUser && !allowedPages().includes(page)) page = 'overview';
    appState.activePage = page;
    $$('.dashboard-page').forEach((section) => section.classList.toggle('active', section.dataset.pageContent === page));
    $$('.sidebar-link').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
    if ($('#pageTitle')) $('#pageTitle').textContent = pageTitles[page];
    if ($('#breadcrumb')) $('#breadcrumb').textContent = `CIIDANKA BOOLISKA GOBOLKA GABILEY / ${pageTitles[page]}`;
    if (updateHash) history.replaceState(null, '', `#${page}`);
    $('#sidebar')?.classList.remove('mobile-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    requestAnimationFrame(drawAllCharts);
  };

  $$('.sidebar-link').forEach((button) => button.addEventListener('click', () => navigateTo(button.dataset.page)));
  $$('[data-navigate]').forEach((button) => button.addEventListener('click', () => navigateTo(button.dataset.navigate)));

  const initialHash = location.hash.replace('#', '');
  if ($('.dashboard-body')) navigateTo(pageTitles[initialHash] ? initialHash : 'overview', false);

  $('#sidebarCollapse')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('collapsed'));
  $('#mobileSidebarToggle')?.addEventListener('click', () => $('#sidebar')?.classList.toggle('mobile-open'));
  document.addEventListener('click', (event) => {
    const sidebar = $('#sidebar');
    if (!sidebar || window.innerWidth > 1080 || !sidebar.classList.contains('mobile-open')) return;
    if (!sidebar.contains(event.target) && !$('#mobileSidebarToggle')?.contains(event.target)) sidebar.classList.remove('mobile-open');
  });

  // Notifications
  $('#notificationButton')?.addEventListener('click', (event) => {
    event.stopPropagation();
    $('#notificationPanel')?.classList.toggle('open');
  });
  $('#notificationPanel')?.addEventListener('click', (event) => event.stopPropagation());
  document.addEventListener('click', () => $('#notificationPanel')?.classList.remove('open'));
  $('#markAllRead')?.addEventListener('click', () => {
    $$('.notification-item').forEach((item) => item.classList.remove('unread'));
    const badge = $('#notificationButton i');
    if (badge) badge.style.display = 'none';
    showToast('Ogeysiisyada', 'Dhammaan ogeysiisyada waa la akhriyey.');
  });

  // Live clock
  const updateClock = () => {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const date = `${SO_DAYS[now.getDay()]}, ${String(now.getDate()).padStart(2, '0')} ${SO_MONTHS[now.getMonth()]}`;
    if ($('#liveTime')) $('#liveTime').textContent = time;
    if ($('#liveDate')) $('#liveDate').textContent = date;
  };
  updateClock();
  setInterval(updateClock, 30000);

  // Data loaded from the PHP backend
  let officers = [];
  let operations = [];
  let citizens = [];
  let prisoners = [];
  let users = [];
  let permissionCatalog = null;
  let invitations = [];
  let financeMonthlyData = Array(12).fill(0);

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const initials = (name) => String(name || '')
    .trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase();

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${String(date.getDate()).padStart(2, '0')} ${SO_MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()}`;
  };

  const timeAgo = (value) => {
    if (!value) return '—';
    const diff = Math.floor((Date.now() - new Date(value).getTime()) / 60000);
    if (Number.isNaN(diff)) return value;
    if (diff < 1) return 'Hadda';
    if (diff < 60) return `${diff} daqiiqo`;
    if (diff < 1440) return `${Math.floor(diff / 60)} saac`;
    return `${Math.floor(diff / 1440)} maalmood`;
  };

  const riskClass = (level) => { const value = String(level || '').toLowerCase(); return ['sare','high','critical','high risk','self-harm risk','medical risk'].includes(value) ? 'high' : ['dhexe','medium','vulnerable','standard'].includes(value) ? 'medium' : 'missing'; };


  const statusClass = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['active', 'firfircoon', 'verified', 'clear', 'enabled', 'la xalliyey', 'court'].some((x) => normalized.includes(x))) return 'resolved';
    if (['high', 'sare', 'flagged', 'critical', 'maintenance'].some((x) => normalized.includes(x))) return 'danger';
    if (['pending', 'review', 'training', 'leave', 'processing', 'service', 'qorshaysan', 'release'].some((x) => normalized.includes(x))) return 'pending';
    return 'active';
  };

  const officerRecord = (id) => officers.find((officer) => Number(officer.id) === Number(id));
  const officerName = (id) => officerRecord(id)?.full_name || '—';
  const avatarMarkup = (row, extraClass = '') => {
    const name = row?.full_name || 'Profile';
    const content = row?.photo_url
      ? `<img src="${escapeHtml(row.photo_url)}" alt="Sawirka ${escapeHtml(name)}">`
      : escapeHtml(initials(name));
    return `<span class="person-avatar ${extraClass}">${content}</span>`;
  };
  const setAvatarElement = (element, row) => {
    if (!element) return;
    const name = row?.full_name || 'Profile';
    element.innerHTML = row?.photo_url
      ? `<img src="${escapeHtml(row.photo_url)}" alt="Sawirka ${escapeHtml(name)}">`
      : `<span>${escapeHtml(initials(name))}</span>`;
  };

  const renderOfficers = (items = officers) => {
    const body = $('#officersTableBody');
    if (!body) return;
    body.innerHTML = items.map((row) => `
      <tr>
        <td><div class="person-cell">${avatarMarkup(row)}<div><strong>${escapeHtml(row.full_name)}</strong><small>${escapeHtml(row.email || row.phone || '')}</small></div></div></td>
        <td><strong>${escapeHtml(row.badge_id)}</strong></td><td>${escapeHtml(row.rank)}</td><td>${escapeHtml(row.department || '—')}</td><td>Shift ${escapeHtml(row.shift)}</td>
        <td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td><button class="profile-action" type="button" data-profile-kind="officer" data-profile-id="${escapeHtml(row.id)}">Profile</button></td>
      </tr>`).join('');
    setText('#officerTotalCount', officers.length);
    setText('#officerActiveCount', officers.filter((row) => row.status === 'Active').length);
    setText('#officerLeaveCount', officers.filter((row) => row.status === 'Leave').length);
    setText('#officerTrainingCount', officers.filter((row) => row.status === 'Training').length);
    setText('#officerPaginationText', `Muujinaya ${items.length} ee ${officers.length} sarkaal`);
  };

  const renderOperations = (items = operations) => {
    const body = $('#operationsTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `
      <tr><td><span class="table-main">${escapeHtml(row.name)}</span><small>${escapeHtml(row.op_code || `OP-${row.id}`)}</small></td><td>${escapeHtml(row.commander_name || '—')}</td><td>${escapeHtml(row.location || '—')}</td><td>${escapeHtml(row.personnel_count)} officers</td><td>${formatDate(row.start_date)}</td><td><span class="risk-tag ${riskClass(row.risk_level)}">${escapeHtml(row.risk_level)}</span></td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(7);
    setText('#operationActiveCount', operations.filter((row)=>row.status==='Firfircoon').length);
    setBadge('#operationsNavBadge', operations.filter((row)=>row.status==='Firfircoon').length);
    setText('#operationHighCount', `${operations.filter((row)=>row.status==='Firfircoon' && row.risk_level==='Sare').length} mudnaan sare`);
    setText('#operationPlannedCount', operations.filter((row)=>row.status==='Qorshaysan').length);
    setText('#operationClosedCount', operations.filter((row)=>row.status==='La xiray').length);
    setText('#operationPersonnelCount', operations.filter((row)=>row.status!=='La xiray').reduce((sum,row)=>sum+Number(row.personnel_count||0),0));
  };


  const caseContainers = { new: 'caseNew', investigating: 'caseInvestigating', court: 'caseCourt', closed: 'caseClosed' };

  const renderCases = (items = []) => {
    Object.entries(caseContainers).forEach(([status, containerId]) => {
      const container = $(`#${containerId}`);
      if (!container) return;
      const rows = items.filter((row) => row.status === status);
      container.innerHTML = rows.length ? rows.map((row) => `
        <article class="case-card"><div class="case-card-top"><span class="case-id">${escapeHtml(row.case_number)}</span><span class="case-priority ${escapeHtml(row.priority)}"></span></div><h4>${escapeHtml(row.title)}</h4><p>${escapeHtml(row.location || '—')}</p><div class="case-card-footer"><span>${timeAgo(row.opened_at)}</span>${avatarMarkup(officerRecord(row.investigator_id), 'compact-avatar')}</div></article>`).join('') : '<p class="panel-empty">Kiis ma jiro.</p>';
      const counter = container.closest('.kanban-column')?.querySelector('.kanban-head strong');
      if (counter) counter.textContent = rows.length;
    });
    setText('#caseOpenCount', items.filter((row) => row.status !== 'closed').length);
    setText('#caseHighPriorityCount', `${items.filter((row) => row.priority === 'high' && row.status !== 'closed').length} high priority`);
    setText('#caseInvestigatingCount', items.filter((row) => row.status === 'investigating').length);
    setText('#caseCourtCount', items.filter((row) => row.status === 'court').length);
    setText('#caseClosedCount', items.filter((row) => row.status === 'closed').length);
    setBadge('#caseNavBadge', items.filter((row) => row.status !== 'closed').length);
  };

  const renderCasePersons = (items = []) => {
    const body = $('#casePersonsTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.case_number)}</strong><small>${escapeHtml(row.case_title || '')}</small></td><td>${escapeHtml(row.display_name || row.person_name)}</td><td>${escapeHtml(row.national_id || '—')}</td><td><span class="unit-label">${escapeHtml(row.role)}</span></td><td>${escapeHtml(row.statement_status)}</td><td>${Number(row.is_vulnerable) ? 'Haa' : 'Maya'}</td><td>${escapeHtml(row.notes || '—')}</td></tr>`).join('') : emptyRow(7, 'Qof wali kiis laguma xidhin.');
  };

  const renderCitizens = (items = citizens) => {
    const body = $('#citizensTableBody');
    if (!body) return;
    body.innerHTML = items.map((row) => `
      <tr><td><div class="person-cell">${avatarMarkup(row)}<div><strong>${escapeHtml(row.full_name)}</strong><small>Citizen profile</small></div></div></td><td><strong>${escapeHtml(row.national_id)}</strong></td><td>${escapeHtml(row.gender || '—')}</td><td>${escapeHtml(row.district || '—')}</td><td>${escapeHtml(row.case_link || '—')}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td><button class="profile-action" type="button" data-profile-kind="citizen" data-profile-id="${escapeHtml(row.id)}">Profile</button></td></tr>`).join('');
  };

  const renderEvidence = (items) => {
    const grid = $('#evidenceGrid');
    if (!grid) return;
    grid.innerHTML = items.map((row) => `
      <article class="evidence-card"><div class="evidence-card-head"><span class="evidence-type">${escapeHtml(initials(row.name))}</span><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.evidence_number)}</p><div class="evidence-meta"><div><span>Case</span><strong>${escapeHtml(row.case_id ? `#${row.case_id}` : '—')}</strong></div><div><span>Nooca</span><strong>${escapeHtml(row.type)}</strong></div></div><div class="custody-line">Goobta: <strong>${escapeHtml(row.location || '—')}</strong></div><button class="btn btn-outline btn-small evidence-chain-button" type="button" data-evidence-chain="${escapeHtml(row.id)}">Chain of Custody</button></article>`).join('');
  };

  const renderPrisoners = (items = prisoners) => {
    const body = $('#prisonTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `
      <tr><td><div class="person-cell">${avatarMarkup(row)}<div><strong>${escapeHtml(row.full_name)}</strong><small>Detention profile</small></div></div></td><td><strong>${escapeHtml(row.prison_id)}</strong></td><td>${escapeHtml(row.cell || '—')}</td><td>${escapeHtml(row.crime || '—')}</td><td>${formatDate(row.entry_date)}</td><td>${escapeHtml(row.release_date || '—')}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td><button class="profile-action" type="button" data-profile-kind="prisoner" data-profile-id="${escapeHtml(row.id)}">Profile</button></td></tr>`).join('') : emptyRow(8);
    const detained = items.filter((row) => !['Released','Transferred'].includes(row.status)).length;
    const capacity = 200;
    setText('#prisonCapacityPct', Math.min(100, Math.round(detained / capacity * 100)));
    setText('#prisonCapacityText', `${detained} / ${capacity}`);
    setText('#prisonCapacityFree', `${Math.max(0, capacity - detained)} boos ayaa bannaan.`);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    setText('#prisonNewCount', items.filter((row) => row.entry_date && new Date(row.entry_date).getTime() >= sevenDaysAgo).length);
    const inThirtyDays = Date.now() + 30 * 86400000;
    setText('#prisonReleaseSoonCount', items.filter((row) => row.release_date && new Date(row.release_date).getTime() <= inThirtyDays && new Date(row.release_date).getTime() >= Date.now()).length);
  };

  const renderPatrols = (items = []) => {
    const list = $('#patrolList');
    if (!list) return;
    list.innerHTML = items.length ? items.map((row) => `
      <div class="patrol-unit"><span class="patrol-unit-icon">${escapeHtml(row.unit_code)}</span><div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.personnel || '')} · ${escapeHtml(row.zone || '')}</small></div><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></div>`).join('') : '<p class="panel-empty">Cutub patrol ah lama helin.</p>';
    setText('#patrolLiveCount', `${items.filter((row) => !['Off duty','Standby'].includes(row.status)).length} live`);
  };

  const renderFleet = (items = []) => {
    const body = $('#fleetTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `
      <tr><td><span class="table-main">${escapeHtml(row.vehicle_name)}</span><small>Police Fleet</small></td><td><strong>${escapeHtml(row.plate_number)}</strong></td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.driver || '—')}</td><td>${escapeHtml(row.fuel_level || '—')}</td><td>${formatDate(row.next_service)}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(7);
    const total = items.length;
    const active = items.filter((row) => row.status === 'Active').length;
    const maintenance = items.filter((row) => row.status === 'Maintenance').length;
    const serviceSoon = items.filter((row) => row.status === 'Service Soon').length;
    const decommissioned = items.filter((row) => row.status === 'Decommissioned').length;
    const pct = total ? Math.round(active / total * 100) : 0;
    setText('#fleetTotalCount', total); setText('#fleetActiveCount', active); setText('#fleetMaintenanceCount', maintenance); setText('#fleetServiceSoonCount', serviceSoon);
    setText('#fleetReadinessPct', `${pct}%`); setText('#fleetServiceDueText', `${serviceSoon} service due`); setText('#fleetDecommissionedText', `${decommissioned} decommissioned`);
    const values = [['#fleetActiveProgress',active],['#fleetMaintenanceProgress',maintenance],['#fleetServiceProgress',serviceSoon]];
    values.forEach(([selector,value]) => { const el=$(selector); if(el) el.value=total ? Math.round(value/total*100) : 0; });
  };

  const renderIntel = (items = []) => {
    const list = $('#intelList');
    if (!list) return;
    list.innerHTML = items.length ? items.map((row) => `
      <div class="intel-item"><span class="intel-class">${escapeHtml(row.classification)}</span><div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.source || '')}</small></div><span>${timeAgo(row.created_at)}</span></div>`).join('') : '<p class="panel-empty">Warbixin sirdoon lama helin.</p>';
    const levels=['Critical','High','Medium','Low'];
    const summary=$('#intelligenceSummary');
    if(summary) summary.innerHTML=levels.map((level)=>`<article><span>${level}</span><strong>${items.filter((row)=>row.threat_level===level).length}</strong><small>reports</small></article>`).join('');
    const highest=levels.find((level)=>items.some((row)=>row.threat_level===level));
    setText('#intelOverallStatus', highest ? `${highest} present` : 'No current data');
  };

  const renderComplaints = (items) => {
    setBadge('#complaintsNavBadge', (items || []).filter((row) => !['La xalliyey','Resolved','Closed'].includes(row.status)).length);
    const body = $('#complaintsTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `
      <tr><td><strong>${escapeHtml(row.complaint_number)}</strong></td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(Number(row.is_anonymous) ? 'Anonymous' : (row.complainant || '—'))}</td><td>${escapeHtml(row.assigned_to || '—')}</td><td>${formatDate(row.filed_date)}</td><td><span class="risk-tag ${riskClass(row.priority)}">${escapeHtml(row.priority)}</span></td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(7);
    const resolved=items.filter((row)=>row.status==='La xalliyey').length;
    setText('#complaintNewCount',items.filter((row)=>row.status==='Cusub').length);
    setText('#complaintHighCount',`${items.filter((row)=>row.priority==='Sare').length} mudnaan sare`);
    setText('#complaintInvestigationCount',items.filter((row)=>['Baaritaan','Review'].includes(row.status)).length);
    setText('#complaintResolvedPct',`${items.length ? Math.round(resolved/items.length*100):0}%`);
    setText('#complaintAnonymousCount',items.filter((row)=>Number(row.is_anonymous)).length);
  };

  const renderUsers = (items = users) => {
    const body = $('#usersTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => {
      const inviteState = row.invitation_status || (row.status === 'invited' ? 'pending' : '—');
      const sendState = row.invitation_send_status || inviteState;
      const inviteText = inviteState === 'accepted' ? 'Accepted' : (sendState === 'sent' ? 'Email sent' : (sendState === 'not_configured' ? 'Link only' : (sendState === 'failed' ? 'Email failed' : escapeHtml(inviteState))));
      const canInviteAgain = row.invitation_id && ['invited','inactive'].includes(row.status) && row.invitation_status !== 'accepted';
      const resend = canInviteAgain ? `<button class="btn btn-outline btn-small" type="button" data-resend-invite="${escapeHtml(row.invitation_id)}">Dib u dir</button>` : '';
      const revoke = row.invitation_id && row.status === 'invited' && row.invitation_status === 'pending' ? `<button class="btn btn-outline btn-small" type="button" data-revoke-invite="${escapeHtml(row.invitation_id)}">Jooji</button>` : '';
      const permissionButton = Number(row.id) === Number(currentUser?.id) ? '' : `<button class="btn btn-outline btn-small" type="button" data-edit-permissions="${escapeHtml(row.id)}">Rukhsado</button>`;
      return `<tr>
        <td><div class="person-cell">${avatarMarkup(row)}<div><strong>${escapeHtml(row.full_name)}</strong><small>${escapeHtml(row.security_clearance || 'Official')} clearance</small></div></div></td>
        <td>${escapeHtml(row.email)}</td>
        <td><span class="unit-label">${escapeHtml(row.role)}</span></td>
        <td><span class="status-pill ${Number(row.custom_permissions) ? 'verified' : 'pending'}">${Number(row.custom_permissions) ? 'Gaar ah' : 'Role default'}</span></td>
        <td><span class="invite-status ${escapeHtml(sendState)}">${inviteText}</span></td>
        <td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td><div class="permission-actions">${permissionButton}${resend}${revoke}<button class="profile-action" type="button" data-profile-kind="user" data-profile-id="${escapeHtml(row.id)}">Profile</button></div></td>
      </tr>`;
    }).join('') : emptyRow(7);
    const roles = [
      ['Commander','CM','blue','Maamul iyo ansixin heer talis.'],
      ['Investigator','IN','amber','Kiisas, caddeymo iyo baaritaan.'],
      ['Evidence Officer','EO','amber','Chain of custody iyo kaydinta caddeynta.'],
      ['Officer','OF','green','Hawl maalmeed, patrol iyo warbixin.']
    ];
    const grid = $('#roleGrid');
    if (grid) grid.innerHTML = roles.map(([role, code, tone, description]) => `<article><div class="role-icon ${tone}">${code}</div><h3>${role}</h3><p>${description}</p><strong>${items.filter((row) => row.role === role).length} users</strong></article>`).join('');
  };

  const renderPermissionCheckboxes = (container, values, selected = [], name = 'permission') => {
    if (!container) return;
    const selectedSet = new Set(selected || []);
    container.innerHTML = (values || []).map((item) => `<label class="permission-check"><input type="checkbox" name="${name}" value="${escapeHtml(item.key)}" ${selectedSet.has(item.key) ? 'checked' : ''}><span>${escapeHtml(item.label)}</span></label>`).join('');
  };

  const roleRecommendedAccess = (roleId) => {
    const recommended = {
      '3': {
        pages: ['overview','cases','arrests','citizens','evidence','documents','custody','intelligence','tasks','fieldreports','myreports','profile'],
        capabilities: ['reports.submit','cases.manage','arrests.manage','evidence.manage','citizens.manage','tasks.update','documents.manage'], scope: 'assigned'
      },
      '4': {
        pages: ['overview','dispatch','roster','patrol','tasks','myreports','profile'],
        capabilities: ['reports.submit','roster.update_own','tasks.update'], scope: 'own'
      },
      '5': {
        pages: ['overview','evidence','documents','cases','custody','tasks','myreports','profile'],
        capabilities: ['reports.submit','evidence.manage','tasks.update','documents.manage'], scope: 'assigned'
      }
    };
    return recommended[String(roleId)] || recommended['4'];
  };

  const ensurePermissionCatalog = async () => {
    if (permissionCatalog) return permissionCatalog;
    const res = await API.userPermissions.catalog();
    permissionCatalog = res.catalog;
    return permissionCatalog;
  };

  const applyInviteRoleDefaults = async () => {
    const form = $('#inviteUserForm');
    if (!form) return;
    const catalog = await ensurePermissionCatalog();
    const defaults = roleRecommendedAccess(form.elements.role_id.value);
    renderPermissionCheckboxes($('#invitePagePermissions'), catalog.pages, defaults.pages, 'page_permission');
    renderPermissionCheckboxes($('#inviteCapabilityPermissions'), catalog.capabilities, defaults.capabilities, 'cap_permission');
    form.elements.scope.value = defaults.scope;
  };

  const renderMailStatus = (mail) => {
    const box = $('#mailStatusNotice');
    if (!box) return;
    box.classList.toggle('is-ready', Boolean(mail?.configured));
    box.classList.toggle('is-warning', !mail?.configured);
    const text = box.querySelector('span');
    if (text) text.textContent = mail?.configured
      ? 'SMTP waa diyaar — invitation email si toos ah ayaa loo diri karaa.'
      : 'SMTP weli lama dejin — account/rukhsado way shaqaynayaan, invitation link-na waa la koobi-gareyn karaa.';
  };

  const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  const renderFinanceSummary = (summary = {}) => {
    setText('#financeAnnualBudget', money(summary.annual_budget));
    setText('#financeSpent', `La isticmaalay ${money(summary.spent)}`);
    setText('#financeRemaining', `Haray ${money(summary.remaining)}`);
    const progress = $('#financeProgress');
    if (progress) progress.value = Math.max(0, Math.min(100, Number(summary.used_pct || 0)));
    const total = Number(summary.spent || 0);
    const categoryKpis = $('#financeCategoryKpis');
    if (categoryKpis) categoryKpis.innerHTML = (summary.by_category || []).length ? summary.by_category.map((row) => `<article><span>${escapeHtml(row.category)}</span><strong>${money(row.total)}</strong><small>${total ? Math.round(Number(row.total) / total * 100) : 0}% kharashka</small></article>`).join('') : '<p class="panel-empty">Kharash wali lama diiwaangelin.</p>';
    const departments = $('#financeDepartmentSpend');
    const maxDepartment = Math.max(1, ...(summary.by_department || []).map((row) => Number(row.total || 0)));
    if (departments) departments.innerHTML = (summary.by_department || []).length ? summary.by_department.map((row) => `<div><p><span>${escapeHtml(row.department || 'Aan la magacaabin')}</span><strong>${money(row.total)}</strong></p><progress value="${Math.round(Number(row.total || 0) / maxDepartment * 100)}" max="100"></progress></div>`).join('') : '<p class="panel-empty">Waax kharash leh lama helin.</p>';
    financeMonthlyData = Array(12).fill(0);
    (summary.monthly || []).forEach((row) => { const month = Number(row.month); if (month >= 1 && month <= 12) financeMonthlyData[month - 1] = Number(row.total || 0) / 1000; });
    drawAllCharts();
  };

  const renderReports = (items = []) => {
    const body = $('#reportsTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.title)}</strong></td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.period || '—')}</td><td>${escapeHtml(row.generated_by || 'System')}</td><td>${formatDate(row.generated_at)}</td><td><span class="status-pill pending">${escapeHtml(row.format || 'Record')}</span></td></tr>`).join('') : emptyRow(6, 'Weli warbixin lama samayn.');
  };

  const renderIncidents = (items) => {
    setBadge('#commandNavBadge', (items || []).filter((row) => !['resolved','closed'].includes(row.status)).length);
    const body = $('#incidentsTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `
      <tr><td><strong>#${escapeHtml(row.incident_number)}</strong></td><td><span class="table-main">${escapeHtml(row.type)}</span><small>Priority ${escapeHtml(row.priority.replace('P', ''))}</small></td><td>${escapeHtml(row.location || '—')}</td><td><span class="unit-label">${escapeHtml(row.assigned_unit || '—')}</span></td><td>${timeAgo(row.reported_at)}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(6);
    setText('#commandCriticalCount', items.filter((row)=>row.priority==='P1' && !['resolved','closed','cancelled'].includes(row.status)).length);
    setText('#commandRespondingCount', items.filter((row)=>['dispatched','responding'].includes(row.status)).length);
    setText('#commandOnSceneCount', items.filter((row)=>row.status==='at_scene').length);
    setText('#commandResolvedCount', items.filter((row)=>['resolved','closed'].includes(row.status)).length);
  };


  const emptyRow = (cols, message = 'Xog lama helin.') => `<tr><td colspan="${cols}"><p class="panel-empty">${escapeHtml(message)}</p></td></tr>`;

  const renderDispatch = (items = []) => {
    const body = $('#dispatchTableBody');
    if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `
      <tr><td><strong>${escapeHtml(row.call_number)}</strong><small>${escapeHtml(row.incident_number || '')}</small></td>
      <td><span class="priority-number ${String(row.priority).toLowerCase()}">${escapeHtml(row.priority)}</span></td>
      <td>${escapeHtml(row.call_type)}</td><td>${escapeHtml(row.caller_name || 'Anonymous')}</td><td>${escapeHtml(row.location)}</td>
      <td><span class="unit-label">${escapeHtml(row.unit_code || 'Unassigned')}</span></td>
      <td>${currentUser?.capabilities?.includes('dispatch.manage') ? `<select class="inline-status-select" data-dispatch-status="${escapeHtml(row.id)}"><option ${row.status === 'Validated' ? 'selected' : ''}>Validated</option><option ${row.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option><option ${row.status === 'Responding' ? 'selected' : ''}>Responding</option><option ${row.status === 'At Scene' ? 'selected' : ''}>At Scene</option><option ${row.status === 'Resolved' ? 'selected' : ''}>Resolved</option><option ${row.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option></select>` : `<span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span>`}</td>
      <td>${timeAgo(row.received_at)}</td></tr>`).join('') : emptyRow(8, 'Wicitaan furan ma jiro.');
    setText('#dispatchP1Count', items.filter((r) => r.priority === 'P1' && !['Resolved','Cancelled'].includes(r.status)).length);
    setText('#dispatchAssignedCount', items.filter((r) => r.status === 'Dispatched').length);
    setText('#dispatchOnSceneCount', items.filter((r) => r.status === 'At Scene').length);
    setText('#dispatchClosedCount', items.filter((r) => ['Resolved','Cancelled'].includes(r.status)).length);
    setText('#commandDispatchBadge', `${items.filter((r) => !['Resolved','Cancelled'].includes(r.status)).length} cusub`);
    const commandList = $('#commandDispatchList');
    if (commandList) commandList.innerHTML = items.length ? items.slice(0, 6).map((row) => `<article><span class="priority-number ${String(row.priority).toLowerCase()}">${escapeHtml(row.priority)}</span><div><strong>${escapeHtml(row.call_number)} · ${escapeHtml(row.call_type)}</strong><small>${escapeHtml(row.location)} · ${timeAgo(row.received_at)}</small></div><button type="button" data-navigate="dispatch">Fur CAD</button></article>`).join('') : '<p class="panel-empty">Wicitaan furan ma jiro.</p>';
    commandList?.querySelectorAll('[data-navigate]').forEach((button) => button.addEventListener('click', () => navigateTo(button.dataset.navigate)));
  };

  const renderRoster = (items = []) => {
    const body = $('#rosterTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><div class="person-cell"><span class="person-avatar">${escapeHtml(initials(row.full_name))}</span><div><strong>${escapeHtml(row.full_name)}</strong><small>${escapeHtml(row.badge_id || '')}</small></div></div></td><td>${formatDate(row.duty_date)}</td><td>Shift ${escapeHtml(row.shift)}</td><td>${escapeHtml(row.assignment)}</td><td>${escapeHtml(row.zone || row.unit_code || '—')}</td><td>${escapeHtml(row.start_time || '—')}</td><td>${escapeHtml(row.end_time || '—')}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(8);
  };

  const renderArrests = (items = []) => {
    const body = $('#arrestsTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.arrest_number)}</strong><small>${escapeHtml(row.case_number || '')}</small></td><td>${escapeHtml(row.person_name)}</td><td>${escapeHtml(row.legal_basis)}</td><td>${formatDate(row.arrested_at)}</td><td>${escapeHtml(row.officer_name || '—')}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(6);
  };

  const renderWarrants = (items = []) => {
    const body = $('#warrantsTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.warrant_number)}</strong><small>${escapeHtml(row.case_number || '')}</small></td><td>${escapeHtml(row.warrant_type)}</td><td>${escapeHtml(row.person_name)}</td><td>${escapeHtml(row.issuing_authority)}</td><td>${formatDate(row.expiry_date)}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(6);
  };

  const renderCustody = (items = []) => {
    const body = $('#custodyTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.booking_number)}</strong><small>${escapeHtml(row.arrest_number || '')}</small></td><td>${escapeHtml(row.full_name)}</td><td>${escapeHtml(row.cell || '—')}</td><td>${formatDate(row.booked_at)}</td><td><span class="risk-tag ${riskClass(row.risk_level)}">${escapeHtml(row.risk_level)}</span></td><td>${formatDate(row.review_due_at)}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td></tr>`).join('') : emptyRow(7);
  };

  const renderCustodyChecks = (items = []) => {
    const body = $('#custodyChecksTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.booking_number)}</strong><small>${escapeHtml(row.full_name || '')}</small></td><td>${formatDate(row.checked_at)}</td><td>${escapeHtml(row.check_type)}</td><td>${escapeHtml(row.checked_by_name || '—')}</td><td>${escapeHtml(row.observation)}</td></tr>`).join('') : emptyRow(5);
    setText('#prisonCheckCount', items.length);
  };

  const taskIsOverdue = (row) => row.due_at && new Date(row.due_at) < new Date() && !['Completed','Cancelled'].includes(row.status);
  const renderTasks = (items = []) => {
    const body = $('#tasksTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><span class="table-main">${escapeHtml(row.title)}</span><small>${escapeHtml(row.task_number)}</small></td><td>${escapeHtml(row.entity_type || 'General')}</td><td>${escapeHtml(row.assignee_name || row.assigned_role || 'Unassigned')}</td><td><span class="risk-tag ${riskClass(row.priority)}">${escapeHtml(row.priority)}</span></td><td>${formatDate(row.due_at)}${taskIsOverdue(row) ? '<small class="overdue-label">Overdue</small>' : ''}</td><td><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td><td>${row.status !== 'Completed' && (currentUser?.capabilities?.includes('tasks.update') || currentUser?.capabilities?.includes('tasks.manage')) ? `<button class="btn btn-outline btn-small" data-complete-task="${escapeHtml(row.id)}">Dhammaystir</button>` : '—'}</td></tr>`).join('') : emptyRow(7);
    const overdue = items.filter(taskIsOverdue).length;
    setText('#overdueTasksBadge', `${overdue} overdue`);
    const openItems=items.filter((row)=>!['Completed','Cancelled'].includes(row.status));
    const notificationList=$('#notificationList');
    if(notificationList) notificationList.innerHTML=openItems.length ? openItems.slice(0,5).map((row)=>`<div class="notification-item ${taskIsOverdue(row)?'unread':''}"><span class="notification-type ${row.priority==='Critical'?'critical':'info'}">${row.priority==='Critical'?'!':'i'}</span><p><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.task_number)} · ${row.due_at ? formatDate(row.due_at) : 'Deadline ma leh'}</small></p></div>`).join('') : '<p class="panel-empty">Hawl sugaysa ma jirto.</p>';
    const badge=$('#notificationButton i'); if(badge) badge.textContent=openItems.length;
    $('#notificationButton')?.classList.toggle('has-alert',openItems.length>0);
  };


  const renderDocuments = (items = []) => {
    const body = $('#documentsTableBody'); if (!body) return;
    body.innerHTML = items.length ? items.map((row) => `<tr><td><strong>${escapeHtml(row.document_number)}</strong><small>${escapeHtml(row.file_name)}</small></td><td>${escapeHtml(row.title)}</td><td>${escapeHtml(row.entity_type)} #${escapeHtml(row.entity_id)}</td><td><span class="classification-badge ${String(row.classification).toLowerCase()}">${escapeHtml(row.classification)}</span></td><td>${escapeHtml(row.uploaded_by_name || '—')}</td><td>${formatDate(row.created_at)}</td><td><a class="btn btn-outline btn-small" href="api/documents.php?id=${encodeURIComponent(row.id)}&download=1" target="_blank" rel="noopener">Soo dejiso</a></td></tr>`).join('') : emptyRow(7, 'Dukumenti lama helin.');
  };

  const renderEvidenceChain = (items = []) => {
    const box = $('#evidenceChainHistory'); if (!box) return;
    box.innerHTML = items.length ? items.map((row) => `<article class="chain-item"><span>${escapeHtml(row.movement_type)}</span><div><strong>${escapeHtml(row.to_location || row.from_location || 'Goob lama sheegin')}</strong><small>${escapeHtml(row.released_by_name || 'System')} → ${escapeHtml(row.received_by_name || 'Custody')} · ${formatDate(row.occurred_at)}</small><p>${escapeHtml(row.purpose || row.condition_note || '')}</p></div></article>`).join('') : '<p class="panel-empty">Weli dhaqdhaqaaq chain-of-custody ah lama diiwaangelin.</p>';
  };

  const setText = (selector, value) => {
    const element = $(selector);
    if (element && value !== undefined && value !== null) element.textContent = value;
  };

  // Sidebar counters. A count of zero hides the badge rather than displaying a
  // "0" pill, so the navigation only draws attention to real outstanding work.
  const setBadge = (selector, count) => {
    const element = $(selector);
    if (!element) return;
    const value = Number(count) || 0;
    element.textContent = value > 0 ? String(value) : '';
    element.hidden = value === 0;
  };

  // ---------------------------------------------------------
  // Warbixinnada ciidanka
  // ---------------------------------------------------------
  const reportStatusClass = (status) => ({
    'Gudbiyey': 'submitted',
    'Dib u eegis': 'reviewing',
    'La ansixiyey': 'approved',
    'La diiday': 'rejected',
  })[status] || 'submitted';

  const renderFieldReports = (rows, canReview) => {
    const body = $('#fieldReportsTableBody');
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8"><p class="panel-empty">Warbixin lama helin.</p></td></tr>';
      return;
    }
    body.innerHTML = rows.map((row) => `
      <tr>
        <td><span class="table-main">${escapeHtml(row.title)}</span><small>${escapeHtml(row.report_number)}</small></td>
        <td>${escapeHtml(row.type)}</td>
        <td><div class="person-cell"><span class="person-avatar">${escapeHtml(initials(row.submitter_name))}</span><div><strong>${escapeHtml(row.submitter_name || '—')}</strong><small>${escapeHtml(row.badge_id || '')}</small></div></div></td>
        <td>${escapeHtml(row.location || '—')}</td>
        <td><span class="risk-tag ${riskClass(row.priority)}">${escapeHtml(row.priority)}</span></td>
        <td>${timeAgo(row.created_at)}</td>
        <td><span class="status-pill ${reportStatusClass(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>${canReview ? `<button class="btn btn-outline btn-small" data-review-report="${row.id}">Eeg</button>` : ''}</td>
      </tr>`).join('');
  };

  const renderMyReports = (rows) => {
    const list = $('#myReportsList');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<article class="dashboard-card"><p class="panel-empty">Weli warbixin ma aadan gudbin. Guji “Soo Gudbi Warbixin”.</p></article>';
      return;
    }
    list.innerHTML = rows.map((row) => `
      <article class="report-item">
        <span class="report-item-icon">${escapeHtml(row.type.slice(0, 2).toUpperCase())}</span>
        <div class="report-item-body">
          <h4>${escapeHtml(row.title)}</h4>
          <p>${escapeHtml((row.content || '').slice(0, 190))}${(row.content || '').length > 190 ? '…' : ''}</p>
          <div class="report-item-meta">
            <span>${escapeHtml(row.report_number)}</span>
            <span>${escapeHtml(row.type)}</span>
            <span>${escapeHtml(row.location || '—')}</span>
            <span>${timeAgo(row.created_at)}</span>
          </div>
          ${row.review_note ? `<div class="review-note ${row.status === 'La diiday' ? 'rejected' : ''}"><strong>Faallada taliyaha${row.reviewer_name ? ` — ${escapeHtml(row.reviewer_name)}` : ''}</strong>${escapeHtml(row.review_note)}</div>` : ''}
        </div>
        <div class="report-item-side">
          <span class="status-pill ${reportStatusClass(row.status)}">${escapeHtml(row.status)}</span>
          <span class="risk-tag ${riskClass(row.priority)}">${escapeHtml(row.priority)}</span>
        </div>
      </article>`).join('');
  };

  const statTiles = (tiles) => tiles.map((tile) => `
    <article><span>${escapeHtml(tile.label)}</span><strong>${escapeHtml(tile.value)}</strong><small>${escapeHtml(tile.note)}</small></article>`).join('');

  const loadFieldReports = async (status = '') => {
    if (!currentUser) return;
    try {
      const res = await API.request('field_reports.php', { params: { limit: 100, status } });
      renderFieldReports(res.data, res.can_review);
      const counts = res.data.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
      const pending = (counts['Gudbiyey'] || 0) + (counts['Dib u eegis'] || 0);
      const stats = $('#fieldReportStats');
      if (stats) {
        stats.innerHTML = statTiles([
          { label: 'Wadarta', value: res.total, note: 'Warbixinno' },
          { label: 'Sugaya ansixin', value: pending, note: 'Taliyaha jooga' },
          { label: 'La ansixiyey', value: counts['La ansixiyey'] || 0, note: 'La aqbalay' },
          { label: 'La diiday', value: counts['La diiday'] || 0, note: 'Dib loo celiyey' },
        ]);
      }
      const badge = $('#pendingReportsBadge');
      if (badge) { badge.textContent = pending || ''; badge.style.display = pending ? '' : 'none'; }
    } catch (error) {
      console.warn('field reports:', error.message);
    }
  };

  const loadMyReports = async () => {
    if (!currentUser) return;
    try {
      const res = await API.request('field_reports.php', { params: { limit: 100, mine: 1 } });
      renderMyReports(res.data);
      const counts = res.data.reduce((acc, row) => { acc[row.status] = (acc[row.status] || 0) + 1; return acc; }, {});
      const stats = $('#myReportStats');
      if (stats) {
        stats.innerHTML = statTiles([
          { label: 'Warbixinnadayda', value: res.total, note: 'La gudbiyey' },
          { label: 'Sugaya', value: (counts['Gudbiyey'] || 0) + (counts['Dib u eegis'] || 0), note: 'Dib u eegis' },
          { label: 'La ansixiyey', value: counts['La ansixiyey'] || 0, note: 'La aqbalay' },
          { label: 'La diiday', value: counts['La diiday'] || 0, note: 'Dib loo celiyey' },
        ]);
      }
    } catch (error) {
      console.warn('my reports:', error.message);
    }
  };

  // ---------------------------------------------------------
  // Dashboard rol-ku-saleysan
  // ---------------------------------------------------------
  const toneFor = (tone) => ['blue', 'amber', 'red', 'green'].includes(tone) ? tone : 'blue';

  /**
   * Notifications are derived from the operational data the dashboard already
   * returned, so they carry no separate copy of the truth: P1/P2 calls and
   * incidents still open, reports waiting on command, and tasks past their
   * deadline. dashboard.php has already stripped any panel the signed-in user
   * has no permission to see, so nothing leaks through this list.
   */
  const renderNotifications = (payload) => {
    const list = $('#notificationList');
    const counter = $('#notificationButton i');
    if (!list) return;

    const panels = payload.panels || {};
    const items = [];

    (panels.active_incidents || []).forEach((row) => {
      const urgent = String(row.priority || '').toUpperCase() === 'P1';
      items.push({
        tone: urgent ? 'critical' : 'info',
        mark: urgent ? '!' : 'i',
        title: `Dhacdo furan · ${row.priority || ''}`.trim(),
        detail: [row.type, row.location, row.assigned_unit].filter(Boolean).join(' · '),
        at: row.reported_at,
      });
    });

    (panels.pending_reports || []).forEach((row) => {
      items.push({
        tone: 'info',
        mark: 'i',
        title: 'Warbixin sugaysa ansixin',
        detail: [row.report_number, row.title].filter(Boolean).join(' · '),
        at: row.created_at,
      });
    });

    (panels.my_reports || []).filter((row) => row.status === 'La ansixiyey').slice(0, 3).forEach((row) => {
      items.push({
        tone: 'success',
        mark: '✓',
        title: 'Warbixintaada waa la ansixiyey',
        detail: [row.report_number, row.title].filter(Boolean).join(' · '),
        at: row.created_at,
      });
    });

    list.innerHTML = items.length
      ? items.slice(0, 8).map((item) => `
        <div class="notification-item${item.tone === 'critical' ? ' unread' : ''}">
          <span class="notification-type ${item.tone}">${item.mark}</span>
          <p><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}${item.at ? ` · ${timeAgo(item.at)}` : ''}</small></p>
        </div>`).join('')
      : '<p class="panel-empty">Ogeysiis cusub ma jiro.</p>';

    if (counter) {
      counter.textContent = items.length ? String(Math.min(items.length, 99)) : '0';
      counter.hidden = items.length === 0;
    }
  };

  const renderRoleDashboard = (payload) => {
    renderNotifications(payload);

    // Salaan shakhsi ah oo waqtiga ku saleysan.
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Subax wanaagsan' : hour < 18 ? 'Galab wanaagsan' : 'Habeen wanaagsan';
    const firstName = (payload.user.full_name || '').split(' ')[0];
    setText('#welcomeGreeting', `${greet}, ${firstName}.`);
    setText('#welcomeDate', somaliDate().toUpperCase());
    setText('#welcomeSubtitle', payload.pages.includes('command')
      ? 'Hoos waxaa ku yaal xaaladda guud ee ciidanka iyo hawlgallada maanta.'
      : 'Hoos waxaa ku yaal shaqadaada iyo warbixinnadaada maanta.');

    // Cinwaanka bogga wuxuu la jaan qaadayaa rolka.
    pageTitles.overview = payload.pages.includes('command') ? 'Dashboard-ka Taliyaha' : 'Dashboard-kayga';
    if (appState.activePage === 'overview') {
      setText('#pageTitle', pageTitles.overview);
      setText('#breadcrumb', `CIIDANKA BOOLISKA GOBOLKA GABILEY / ${pageTitles.overview}`);
    }

    const grid = $('#summaryGrid');
    if (grid) {
      grid.innerHTML = payload.cards.map((card) => `
        <article class="summary-card">
          <div class="summary-icon ${toneFor(card.tone)}">${escapeHtml(card.icon)}</div>
          <div class="summary-body">
            <span>${escapeHtml(card.label)}</span>
            <strong>${escapeHtml(card.value)} ${card.unit ? `<small>${escapeHtml(card.unit)}</small>` : ''}</strong>
            <p>${escapeHtml(card.note)}</p>
          </div>
        </article>`).join('');
    }

    const actions = $('#welcomeActions');
    if (actions) {
      actions.innerHTML = payload.actions.map((action, index) => `
        <button class="btn ${index === payload.actions.length - 1 ? 'btn-primary' : 'btn-outline'}" data-open-modal="${escapeHtml(action.modal)}">${escapeHtml(action.label)}</button>`).join('');
      actions.querySelectorAll('[data-open-modal]').forEach((button) =>
        button.addEventListener('click', () => openModal(button.dataset.openModal)));
    }

    // Command-level charts/maps only for roles that own the command page.
    const commandBlock = $('#commandOverview');
    if (commandBlock) commandBlock.hidden = true; // Legacy static analytics are intentionally hidden; live cards/panels above are authoritative.

    const panels = $('#rolePanels');
    if (!panels) return;
    const p = payload.panels;
    const blocks = [];

    if (p.pending_reports) {
      blocks.push(`
        <article class="dashboard-card live-incidents-card">
          <div class="card-header"><div><span class="card-kicker">SUGAYA ANSIXIN</span><h3>Warbixinnada Ciidanka</h3></div><button class="text-link" data-navigate="fieldreports">Dhammaan →</button></div>
          <div class="role-panel-list">${p.pending_reports.length ? p.pending_reports.map((row) => `
            <div class="role-panel-row"><div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.report_number)} · ${escapeHtml(row.submitter_name || '')} · ${timeAgo(row.created_at)}</small></div><span class="status-pill ${reportStatusClass(row.status)}">${escapeHtml(row.status)}</span></div>`).join('')
            : '<p class="panel-empty">Warbixin sugaysa ma jirto.</p>'}</div>
        </article>`);
    }

    if (p.my_reports) {
      blocks.push(`
        <article class="dashboard-card units-card">
          <div class="card-header"><div><span class="card-kicker">WARBIXINNADAYDA</span><h3>Kuwii Ugu Dambeeyey</h3></div><button class="text-link" data-navigate="myreports">Dhammaan →</button></div>
          <div class="role-panel-list">${p.my_reports.length ? p.my_reports.map((row) => `
            <div class="role-panel-row"><div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.report_number)} · ${timeAgo(row.created_at)}</small></div><span class="status-pill ${reportStatusClass(row.status)}">${escapeHtml(row.status)}</span></div>`).join('')
            : '<p class="panel-empty">Weli warbixin ma aadan gudbin.</p>'}</div>
        </article>`);
    }

    if (p.my_cases) {
      blocks.push(`
        <article class="dashboard-card live-incidents-card">
          <div class="card-header"><div><span class="card-kicker">KIISASKAYGA</span><h3>Kiisas Ku Xilsaaran</h3></div><button class="text-link" data-navigate="cases">Dhammaan →</button></div>
          <div class="role-panel-list">${p.my_cases.length ? p.my_cases.map((row) => `
            <div class="role-panel-row"><div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.case_number)} · ${escapeHtml(row.location || '')} · ${escapeHtml(row.status)}</small></div><span class="risk-tag ${escapeHtml(row.priority) === 'high' ? 'high' : row.priority === 'medium' ? 'medium' : 'missing'}">${escapeHtml(row.priority)}</span></div>`).join('')
            : '<p class="panel-empty">Kiis kuuma xilsaarna.</p>'}</div>
        </article>`);
    }

    if (p.recent_evidence) {
      blocks.push(`
        <article class="dashboard-card live-incidents-card">
          <div class="card-header"><div><span class="card-kicker">CADDEYMAHA</span><h3>Kuwii Ugu Dambeeyey</h3></div><button class="text-link" data-navigate="evidence">Dhammaan →</button></div>
          <div class="role-panel-list">${p.recent_evidence.map((row) => `
            <div class="role-panel-row"><div><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.evidence_number)} · ${escapeHtml(row.location || '')}</small></div><span class="status-pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></div>`).join('')}</div>
        </article>`);
    }

    if (p.active_incidents) {
      blocks.push(`
        <article class="dashboard-card units-card">
          <div class="card-header"><div><span class="card-kicker">DHACDOOYIN FURAN</span><h3>Aagga Guud</h3></div></div>
          <div class="role-panel-list">${p.active_incidents.length ? p.active_incidents.map((row) => `
            <div class="role-panel-row"><div><strong>${escapeHtml(row.type)}</strong><small>#${escapeHtml(row.incident_number)} · ${escapeHtml(row.location || '')} · ${escapeHtml(row.assigned_unit || '')}</small></div><span class="risk-tag ${row.priority === 'P1' ? 'high' : row.priority === 'P2' ? 'medium' : 'missing'}">${escapeHtml(row.priority)}</span></div>`).join('')
            : '<p class="panel-empty">Dhacdo furan ma jirto.</p>'}</div>
        </article>`);
    }

    if (p.recent_activity) {
      blocks.push(`
        <article class="dashboard-card activity-card">
          <div class="card-header"><div><span class="card-kicker">AUDIT LOG</span><h3>Dhaqdhaqaaqii Ugu Dambeeyey</h3></div></div>
          <div class="activity-list">${p.recent_activity.map((row) => `
            <div><span class="activity-icon blue">${escapeHtml(row.entity_type.slice(0, 2).toUpperCase())}</span><p><strong>${escapeHtml(row.action)} — ${escapeHtml(row.entity_type)}</strong><small>${escapeHtml(row.details || '')} · ${timeAgo(row.created_at)}</small></p></div>`).join('')}</div>
        </article>`);
    }

    // A member of staff whose grants cover none of the dashboard widgets would
    // otherwise land on a blank page. Explain the state instead, and point at
    // the sections command has actually opened for them.
    if (!blocks.length) {
      const openPages = (payload.pages || []).filter((page) => !['overview', 'profile'].includes(page));
      const links = openPages
        .map((page) => `<button type="button" class="btn ghost" data-navigate="${escapeHtml(page)}">${escapeHtml(pageTitles[page] || page)}</button>`)
        .join('');
      blocks.push(`
        <article class="dashboard-card">
          <div class="dashboard-empty-state">
            <h3>Wax lagu soo bandhigo dashboard-ka weli ma jiraan</h3>
            <p>${openPages.length
              ? 'Marka xog la geliyo qaybaha kuu furan, koobitaankeeda halkan ayuu ka muuqan doonaa.'
              : 'Taliyuhu weli qaybo shaqo kuuma furin. La xidhiidh taliska si laguu siiyo rukhsadaha aad u baahan tahay.'}</p>
            ${links ? `<div class="dashboard-empty-actions">${links}</div>` : ''}
          </div>
        </article>`);
    }

    panels.className = blocks.length > 1 ? 'dashboard-grid grid-secondary' : 'dashboard-grid';
    panels.innerHTML = blocks.join('');
    panels.querySelectorAll('[data-navigate]').forEach((button) =>
      button.addEventListener('click', () => navigateTo(button.dataset.navigate)));
  };

  const isDashboard = Boolean($('.dashboard-body'));

  /** Ku qari sidebar-ka iyo bogagga aan rolku rukhsad u lahayn. */
  const applyPermissions = (user) => {
    const pages = user.pages || [];
    const caps = user.capabilities || [];
    $$('.sidebar-link').forEach((link) => { link.hidden = !pages.includes(link.dataset.page); });
    $$('.dashboard-page').forEach((section) => {
      if (!pages.includes(section.dataset.pageContent)) section.hidden = true;
    });

    // Qari ficillada aan Taliyuhu oggolaan. API-ga server-ka ayaa weli ah difaaca ugu dambeeya.
    const modalCapabilities = {
      officerModal: 'officers.manage', operationModal: 'operations.manage', caseModal: 'cases.manage',
      casePersonModal: 'cases.manage', evidenceModal: 'evidence.manage', prisonerModal: 'custody.manage',
      patrolModal: 'operations.manage', fleetModal: 'fleet.manage', intelligenceModal: 'intelligence.manage',
      complaintModal: 'complaints.manage', expenseModal: 'finance.manage', userModal: 'invitations.manage',
      callModal: 'dispatch.manage', rosterModal: 'roster.manage', warrantModal: 'warrants.manage',
      arrestModal: 'arrests.manage', bookingModal: 'custody.manage', custodyCheckModal: 'custody.check', taskModal: 'tasks.manage',
      evidenceMovementModal: 'evidence.manage', fieldReportModal: 'reports.submit'
    };
    $$('[data-open-modal]').forEach((button) => {
      const capability = modalCapabilities[button.dataset.openModal];
      if (capability && !caps.includes(capability)) button.hidden = true;
    });
    if ($('#documentUploadForm') && !caps.includes('documents.manage')) $('#documentUploadForm').hidden = true;

    // Qari cinwaanka kooxda haddii dhammaan xiriirradeeda la qariyey.
    $$('.nav-group-title').forEach((title) => {
      const group = [];
      let node = title.nextElementSibling;
      while (node && node.classList.contains('sidebar-link')) { group.push(node); node = node.nextElementSibling; }
      title.hidden = group.length > 0 && group.every((link) => link.hidden);
    });
  };

  const loadAll = async () => {
    if (!isDashboard || typeof API === 'undefined' || !currentUser) return;
    const pages = currentUser.pages;

    // Endpoint kasta waxaa la soo dejiyaa oo kaliya haddii rolku bogga arki karo.
    const tasks = [
      ['dashboard',    null,           () => API.dashboard(),                     (res) => renderRoleDashboard(res)],
      ['officers',     'officers',     () => API.officers.list({ limit: 100 }),   (res) => { officers = res.data; renderOfficers(); }],
      ['operations',   'operations',   () => API.operations.list({ limit: 100 }), (res) => { operations = res.data; renderOperations(); }],
      ['cases',        'cases',        () => API.cases.list({ limit: 100 }),      (res) => renderCases(res.data)],
      ['casePersons',  'cases',        () => API.request('cases.php', { params: { view: 'persons' } }), (res) => renderCasePersons(res.data)],
      ['incidents',    'command',      () => API.incidents.list({ limit: 50 }),   (res) => renderIncidents(res.data)],
      ['citizens',     'citizens',     () => API.citizens.list({ limit: 100 }),   (res) => { citizens = res.data; renderCitizens(); }],
      ['evidence',     'evidence',     () => API.evidence.list({ limit: 100 }),   (res) => renderEvidence(res.data)],
      ['documents',    'documents',    () => API.documents.list(),                 (res) => renderDocuments(res.data)],
      ['prisoners',    'prison',       () => API.prisoners.list({ limit: 100 }),  (res) => { prisoners = res.data; renderPrisoners(); }],
      ['patrol',       'patrol',       () => API.patrol.list({ limit: 50 }),      (res) => renderPatrols(res.data)],
      ['fleet',        'traffic',      () => API.fleet.list({ limit: 100 }),      (res) => renderFleet(res.data)],
      ['complaints',   'complaints',   () => API.complaints.list({ limit: 100 }), (res) => renderComplaints(res.data)],
      ['intelligence', 'intelligence', () => API.intelligence.list({ limit: 50 }),(res) => renderIntel(res.data)],
      ['users',        'users',        () => API.users.list(),                    (res) => { users = res.data; renderUsers(); }],
      ['invitations',  'users',        () => API.invitations.list(),                (res) => { invitations = res.data || []; renderMailStatus(res.mail || {}); }],
      ['finance',      'finance',      () => API.financeSummary(),                 (res) => renderFinanceSummary(res)],
      ['reports',      'reports',      () => API.reports.list({ limit: 100 }),     (res) => renderReports(res.data)],
      ['dispatch',     'dispatch',     () => API.dispatch.list(),                  (res) => renderDispatch(res.data)],
      ['roster',       'roster',       () => API.roster.list(),                    (res) => renderRoster(res.data)],
      ['tasks',        'tasks',        () => API.tasks.list(),                     (res) => renderTasks(res.data)],
    ].filter(([, page]) => page === null || pages.includes(page));

    const jobs = tasks.map(async ([name, , fetcher, render]) => {
      try {
        render(await fetcher());
      } catch (error) {
        console.warn(`Xogta "${name}" lama soo dejin karin:`, error.message);
      }
    });

    if (pages.includes('arrests')) jobs.push((async () => {
      try {
        const [arrestsRes, warrantsRes] = await Promise.all([API.arrests.list(), API.arrests.list({ view: 'warrants' })]);
        renderArrests(arrestsRes.data); renderWarrants(warrantsRes.data);
      } catch (error) { console.warn('arrests:', error.message); }
    })());
    if (pages.includes('custody')) jobs.push((async () => {
      try {
        const [bookingsRes, checksRes] = await Promise.all([API.custody.list(), API.custody.list({ view: 'checks' })]);
        renderCustody(bookingsRes.data); renderCustodyChecks(checksRes.data);
      } catch (error) { console.warn('custody:', error.message); }
    })());

    if (pages.includes('fieldreports')) jobs.push(loadFieldReports());
    if (pages.includes('myreports'))    jobs.push(loadMyReports());

    await Promise.all(jobs);
  };

  const updateCurrentUserProfile = (user) => {
    if (!user) return;
    $$('.commander-mini-profile strong, .topbar-profile strong').forEach((el) => { el.textContent = user.full_name; });
    $$('#sidebarRole, .topbar-profile-copy span').forEach((el) => { el.textContent = user.role; });
    $$('[data-current-user-avatar]').forEach((el) => setAvatarElement(el, user));
    setAvatarElement($('#currentProfileAvatar'), user);
    setText('#currentProfileName', user.full_name);
    setText('#currentProfileRole', user.role);
    setText('#currentProfileFullName', user.full_name);
    setText('#currentProfileEmail', user.email);
    setText('#currentProfileRoleValue', user.role);
    setText('#currentProfileClearance', user.security_clearance || 'Official');
  };

  if (isDashboard && typeof API !== 'undefined') {
    API.session()
      .then((res) => {
        if (!res.authenticated) {
          window.location.href = 'login.html';
          return;
        }
        currentUser = res.user;
        updateCurrentUserProfile(res.user);
        applyPermissions(res.user);
        // Dib u hubi bogga hadda furan — laga yaabee inuusan rukhsad u lahayn.
        navigateTo(allowedPages().includes(appState.activePage) ? appState.activePage : 'overview', false);
        loadAll();
        if (res.user.force_password_change) setTimeout(() => openModal('changePasswordModal'), 0);
      })
      .catch(() => { window.location.href = 'login.html'; });
  }

  let officerSearchTimer;
  $('#officerSearch')?.addEventListener('input', (event) => {
    const value = event.target.value.trim();
    clearTimeout(officerSearchTimer);
    officerSearchTimer = setTimeout(async () => {
      if (!value) return renderOfficers();
      try {
        const res = await API.officers.search(value);
        renderOfficers(res.data);
      } catch (error) {
        showToast('Raadinta', error.message);
      }
    }, 280);
  });

  $('#globalSearch')?.addEventListener('keydown', async (event) => {
    if (event.key !== 'Enter') return;
    const query = event.currentTarget.value.trim();
    if (!query) return;
    try {
      const res = await API.globalSearch(query);
      showToast('Raadinta nidaamka', `${res.total} natiijo ayaa laga helay "${query}".`);
    } catch (error) {
      showToast('Raadinta nidaamka', error.message);
    }
  });

  $('#logoutButton')?.addEventListener('click', async () => {
    try {
      await API.logout();
    } catch (_) { /* Session may already be gone. */ }
    window.location.href = 'login.html';
  });

  const profileSources = {
    officer: () => officers,
    citizen: () => citizens,
    prisoner: () => prisoners,
    user: () => users,
  };
  const profileTypeLabels = { officer: 'SARKAAL', citizen: 'MUWAADIN', prisoner: 'MAXBUUS', user: 'SYSTEM USER' };
  let activePersonProfile = null;

  const detailRowsFor = (kind, row) => {
    const rows = kind === 'officer' ? [
      ['Badge ID', row.badge_id], ['Darajada', row.rank], ['Waaxda', row.department],
      ['Shift', row.shift ? `Shift ${row.shift}` : '—'], ['Xaaladda', row.status], ['Telefoon', row.phone], ['Email', row.email]
    ] : kind === 'citizen' ? [
      ['National ID', row.national_id], ['Jinsiga', row.gender], ['Taariikhda dhalashada', formatDate(row.date_of_birth)],
      ['Degmada', row.district], ['Telefoon', row.phone], ['Nooca diiwaanka', row.record_type], ['Xaaladda', row.status]
    ] : kind === 'prisoner' ? [
      ['Prison ID', row.prison_id], ['Qolka', row.cell], ['Dambiga', row.crime], ['Gelitaanka', formatDate(row.entry_date)],
      ['Sii-daynta', row.release_date], ['Xaaladda', row.status]
    ] : [
      ['Email', row.email], ['Role', row.role], ['Xaaladda', row.status], ['2FA', Number(row.two_factor_enabled) ? 'Enabled' : 'Pending'],
      ['Last login', timeAgo(row.last_login)], ['Saldhigga', 'Saldhigga Booliska Gobolka Gabiley']
    ];
    return rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
  };

  const openPersonProfile = (kind, id) => {
    const row = profileSources[kind]?.().find((item) => Number(item.id) === Number(id));
    if (!row) return showToast('Profile', 'Diiwaanka lama helin.');
    activePersonProfile = { kind, id: Number(id), row };
    setText('#personProfileType', profileTypeLabels[kind] || 'PROFILE');
    setText('#personProfileName', row.full_name);
    setAvatarElement($('#personProfileAvatar'), row);
    $('#personProfileDetails').innerHTML = detailRowsFor(kind, row).map(([label, value]) =>
      `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd></div>`).join('');
    $('#personProfilePhotoInput').value = '';
    openModal('personProfileModal');
  };

  const applyUploadedPhoto = (kind, id, photoUrl) => {
    const row = profileSources[kind]?.().find((item) => Number(item.id) === Number(id));
    if (row) row.photo_url = photoUrl;
    if (kind === 'officer') renderOfficers();
    if (kind === 'citizen') renderCitizens();
    if (kind === 'prisoner') renderPrisoners();
    if (kind === 'user') renderUsers();
    if (kind === 'user' && currentUser && Number(currentUser.id) === Number(id)) {
      currentUser.photo_url = photoUrl;
      updateCurrentUserProfile(currentUser);
    }
  };

  document.addEventListener('click', (event) => {
    const profileButton = event.target.closest('[data-profile-kind][data-profile-id]');
    if (profileButton) openPersonProfile(profileButton.dataset.profileKind, profileButton.dataset.profileId);
  });

  $('#savePersonProfilePhoto')?.addEventListener('click', async (event) => {
    const file = $('#personProfilePhotoInput')?.files?.[0];
    if (!activePersonProfile || !file) return showToast('Profile', 'Fadlan dooro sawir.');
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const res = await API.uploadProfilePhoto(activePersonProfile.kind, activePersonProfile.id, file);
      applyUploadedPhoto(activePersonProfile.kind, activePersonProfile.id, res.photo_url);
      activePersonProfile.row.photo_url = res.photo_url;
      setAvatarElement($('#personProfileAvatar'), activePersonProfile.row);
      showToast('Profile', 'Sawirka profile-ka waa la kaydiyey.');
    } catch (error) { showToast('Profile', error.message); }
    finally { button.disabled = false; }
  });

  $('#saveCurrentProfilePhoto')?.addEventListener('click', async (event) => {
    const file = $('#currentProfilePhotoInput')?.files?.[0];
    if (!currentUser || !file) return showToast('Profile-kayga', 'Fadlan dooro sawir.');
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const res = await API.uploadProfilePhoto('user', currentUser.id, file);
      currentUser.photo_url = res.photo_url;
      updateCurrentUserProfile(currentUser);
      const matchingUser = users.find((row) => Number(row.id) === Number(currentUser.id));
      if (matchingUser) matchingUser.photo_url = res.photo_url;
      renderUsers();
      $('#currentProfilePhotoInput').value = '';
      showToast('Profile-kayga', 'Sawirkaaga waa la kaydiyey.');
    } catch (error) { showToast('Profile-kayga', error.message); }
    finally { button.disabled = false; }
  });

  // Settings tabs
  $$('[data-settings-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.settingsTab;
      $$('[data-settings-tab]').forEach((item) => item.classList.toggle('active', item === button));
      $$('[data-settings-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.settingsPanel === tab));
    });
  });
  $('#saveSettings')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const payload = {};
    $$('[data-setting]').forEach((field) => {
      payload[field.dataset.setting] = field.type === 'checkbox' ? (field.checked ? '1' : '0') : field.value;
    });
    try {
      await API.saveSettings(payload);
      showToast('Settings', 'Isbeddellada waa la kaydiyey.');
    } catch (error) {
      showToast('Settings', error.message);
    } finally {
      button.disabled = false;
    }
  });

  // Modals
  const openModal = (id) => {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };
  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
  };
  $$('[data-open-modal]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.openModal)));
  $$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal'))));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') $$('.modal.open').forEach(closeModal);
  });
  const modalHandlers = {
    officerModal:   { submit: (data) => API.officers.create(data), afterSubmit: async (result, file) => { if (file && result?.id) await API.uploadProfilePhoto('officer', result.id, file); }, reload: async () => { officers = (await API.officers.list({ limit: 100 })).data; renderOfficers(); }, label: 'Sarkaalka' },
    citizenModal:   { submit: (data) => API.citizens.create(data), afterSubmit: async (result, file) => { if (file && result?.id) await API.uploadProfilePhoto('citizen', result.id, file); }, reload: async () => { citizens = (await API.citizens.list({ limit: 100 })).data; renderCitizens(); }, label: 'Muwaadinka' },
    evidenceModal:  { submit: (data) => API.evidence.create(data), reload: async () => renderEvidence((await API.evidence.list({ limit: 100 })).data), label: 'Caddeynta' },
    prisonerModal:  { submit: (data) => API.prisoners.create(data), afterSubmit: async (result, file) => { if (file && result?.id) await API.uploadProfilePhoto('prisoner', result.id, file); }, reload: async () => { prisoners = (await API.prisoners.list({ limit: 100 })).data; renderPrisoners(); }, label: 'Maxbuuska' },
    patrolModal:    { submit: (data) => API.patrol.create(data), reload: async () => renderPatrols((await API.patrol.list({ limit: 100 })).data), label: 'Cutubka patrol-ka' },
    fleetModal:     { submit: (data) => API.fleet.create(data), reload: async () => renderFleet((await API.fleet.list({ limit: 100 })).data), label: 'Gaadhiga' },
    intelligenceModal: { submit: (data) => API.intelligence.create(data), reload: async () => renderIntel((await API.intelligence.list({ limit: 100 })).data), label: 'Warbixinta sirdoonka' },
    complaintModal: { submit: (data) => API.complaints.create(data), reload: async () => renderComplaints((await API.complaints.list({ limit: 100 })).data), label: 'Cabashada' },
    expenseModal:   { submit: (data) => API.finance.create(data), reload: async () => renderFinanceSummary(await API.financeSummary()), label: 'Kharashka' },
    caseModal:      { submit: (data) => API.cases.create(data), reload: async () => renderCases((await API.cases.list({ limit: 100 })).data), label: 'Kiiska' },
    casePersonModal:{ submit: (data) => API.cases.create(data), reload: async () => renderCasePersons((await API.request('cases.php', { params: { view: 'persons' } })).data), label: 'Qofka kiiska' },
    operationModal: { submit: (data) => API.operations.create(data), reload: async () => { operations=(await API.operations.list({ limit: 100 })).data; renderOperations(); }, label: 'Hawlgalka' },
    incidentModal:  { submit: (data) => API.incidents.create(data),  reload: async () => renderIncidents((await API.incidents.list({ limit: 50 })).data), label: 'Dhacdada' },
    callModal:      { submit: (data) => API.dispatch.create(data), reload: async () => renderDispatch((await API.dispatch.list()).data), label: 'Wicitaanka' },
    rosterModal:    { submit: (data) => API.roster.create(data), reload: async () => renderRoster((await API.roster.list()).data), label: 'Duty-ga' },
    warrantModal:   { submit: (data) => API.arrests.create({ ...data, record_type: 'warrant' }), reload: async () => renderWarrants((await API.arrests.list({ view: 'warrants' })).data), label: 'Warrant-ka' },
    arrestModal:    { submit: (data) => API.arrests.create({ ...data, record_type: 'arrest' }), reload: async () => renderArrests((await API.arrests.list()).data), label: 'Xarigga' },
    bookingModal:   { submit: (data) => API.custody.create({ ...data, record_type: 'booking' }), reload: async () => renderCustody((await API.custody.list()).data), label: 'Booking-ka' },
    custodyCheckModal: { submit: (data) => API.custody.create({ ...data, record_type: 'check' }), reload: async () => renderCustodyChecks((await API.custody.list({ view: 'checks' })).data), label: 'Hubinta custody-ga' },
    taskModal:      { submit: (data) => API.tasks.create(data), reload: async () => renderTasks((await API.tasks.list()).data), label: 'Hawsha' },
    evidenceMovementModal: { submit: (data) => API.evidenceChain.create(data), reload: async () => renderEvidence((await API.evidence.list({ limit: 100 })).data), label: 'Chain-of-custody' },
    reportModal:    { submit: (data) => API.generateReport(data), reload: async () => renderReports((await API.reports.list({ limit: 100 })).data), label: 'Warbixinta' },
    fieldReportModal: {
      submit: (data) => API.request('field_reports.php', { method: 'POST', body: data }),
      reload: async () => { await Promise.all([loadMyReports(), loadFieldReports()]); await refreshDashboard(); },
      label: 'Warbixinta',
      message: 'Warbixintaada waa la gudbiyey. Taliyaha ayaa dib u eegi doona.',
    },
  };

  const refreshDashboard = async () => {
    try { renderRoleDashboard(await API.dashboard()); } catch (_) { /* dashboard optional */ }
  };

  // --- Dib u eegista taliyaha ---
  let reviewingId = null;

  const openReviewModal = async (id) => {
    try {
      const res  = await API.request('field_reports.php', { params: { limit: 100 } });
      const item = res.data.find((row) => Number(row.id) === Number(id));
      if (!item) return showToast('Warbixin', 'Warbixinta lama helin.');
      reviewingId = id;
      $('#reviewReportTitle').textContent = item.title;
      $('#reviewReportBody').innerHTML = `
        <dl>
          <div><dt>Warbixinta</dt><dd>${escapeHtml(item.report_number)}</dd></div>
          <div><dt>Nooca</dt><dd>${escapeHtml(item.type)}</dd></div>
          <div><dt>Soo gudbiyey</dt><dd>${escapeHtml(item.submitter_name || '—')}</dd></div>
          <div><dt>Goobta</dt><dd>${escapeHtml(item.location || '—')}</dd></div>
          <div><dt>Mudnaanta</dt><dd>${escapeHtml(item.priority)}</dd></div>
          <div><dt>Xaaladda</dt><dd>${escapeHtml(item.status)}</dd></div>
        </dl>
        <div class="report-content">${escapeHtml(item.content)}</div>`;
      $('#reviewNote').value = item.review_note || '';
      openModal('reviewReportModal');
    } catch (error) {
      showToast('Warbixin', error.message);
    }
  };

  const submitReview = async (status) => {
    if (!reviewingId) return;
    try {
      const res = await API.request('field_reports.php', {
        method: 'PUT',
        params: { action: 'review' },
        body: { id: reviewingId, status, review_note: $('#reviewNote').value.trim() },
      });
      closeModal($('#reviewReportModal'));
      showToast('Dib u eegis', res.message);
      await Promise.all([loadFieldReports(), refreshDashboard()]);
    } catch (error) {
      showToast('Dib u eegis', error.message);
    }
  };

  $('#approveReportBtn')?.addEventListener('click', () => submitReview('La ansixiyey'));
  $('#rejectReportBtn')?.addEventListener('click', () => submitReview('La diiday'));

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-review-report]');
    if (trigger) openReviewModal(trigger.dataset.reviewReport);
  });

  $$('#reportFilterTabs button').forEach((button) => {
    button.addEventListener('click', () => {
      $$('#reportFilterTabs button').forEach((tab) => tab.classList.toggle('active', tab === button));
      loadFieldReports(button.dataset.reportStatus);
    });
  });

  let reportSearchTimer;
  $('#reportSearch')?.addEventListener('input', (event) => {
    const value = event.target.value.trim();
    clearTimeout(reportSearchTimer);
    reportSearchTimer = setTimeout(async () => {
      try {
        const res = await API.request('field_reports.php', { params: { limit: 100, search: value } });
        renderFieldReports(res.data, res.can_review);
      } catch (error) {
        showToast('Raadinta', error.message);
      }
    }, 280);
  });

  $$('.app-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const modal   = form.closest('.modal');
      const handler = modalHandlers[modal?.id];
      if (!handler) return;

      const submitButton = form.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent;
      if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Sugaya...'; }

      const formData = new FormData(form);
      const profilePhoto = formData.get('profile_photo');
      formData.delete('profile_photo');
      const data = Object.fromEntries([...formData.entries()].map(([key, value]) => [key, typeof value === 'string' && value.trim() === '' ? null : value]));

      try {
        const result = await handler.submit(data);
        if (handler.afterSubmit) await handler.afterSubmit(result, profilePhoto instanceof File && profilePhoto.size ? profilePhoto : null);
        closeModal(modal);
        form.reset();
        showToast('CIIDANKA BOOLISKA GOBOLKA GABILEY',
          handler.message || result?.message || `${handler.label} si guul leh ayaa loo kaydiyey.`);
        await handler.reload();
      } catch (error) {
        showToast('Khalad', error.message);
      } finally {
        if (submitButton) { submitButton.disabled = false; submitButton.textContent = originalText; }
      }
    });
  });


  const checkedPermissionValues = (container, name) => Array.from(container?.querySelectorAll(`input[name="${name}"]:checked`) || []).map((el) => el.value);

  $('#inviteUserForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.disabled = true; button.textContent = 'Diraya…';
    try {
      await ensurePermissionCatalog();
      const fd = new FormData(form);
      const payload = {
        full_name: String(fd.get('full_name') || '').trim(),
        email: String(fd.get('email') || '').trim(),
        role_id: Number(fd.get('role_id') || 4),
        officer_id: fd.get('officer_id') ? Number(fd.get('officer_id')) : null,
        security_clearance: fd.get('security_clearance') || 'Official',
        scope: fd.get('scope') || 'assigned',
        pages: checkedPermissionValues($('#invitePagePermissions'), 'page_permission'),
        capabilities: checkedPermissionValues($('#inviteCapabilityPermissions'), 'cap_permission'),
      };
      const result = await API.invitations.create(payload);
      closeModal($('#userModal'));
      form.reset();
      if (result.invite_url) {
        const box = $('#lastInviteLinkBox');
        const input = $('#lastInviteLink');
        if (box && input) { input.value = result.invite_url; box.hidden = false; }
      }
      showToast('Shaqaale Casuumaad', result.message || (result.email_sent ? 'Email waa la diray.' : 'Invitation-ka waa la sameeyey.'));
      const [usersRes, invitesRes] = await Promise.all([API.users.list(), API.invitations.list()]);
      users = usersRes.data || []; invitations = invitesRes.data || [];
      renderUsers(); renderMailStatus(invitesRes.mail || {});
      await applyInviteRoleDefaults();
    } catch (error) {
      showToast('Khalad', error.message);
    } finally {
      button.disabled = false; button.textContent = original;
    }
  });

  $('#inviteUserForm select[name="role_id"]')?.addEventListener('change', () => {
    applyInviteRoleDefaults().catch((error) => showToast('Rukhsado', error.message));
  });

  document.querySelector('[data-open-modal="userModal"]')?.addEventListener('click', () => {
    applyInviteRoleDefaults().catch((error) => showToast('Rukhsado', error.message));
  });

  const openPermissionEditor = async (userId) => {
    try {
      const res = await API.userPermissions.get(userId);
      permissionCatalog = res.catalog;
      $('#permissionUserId').value = res.user.id;
      $('#permissionScope').value = res.permissions.scope || 'assigned';
      $('#permissionModalTitle').textContent = `Rukhsadaha — ${res.user.full_name}`;
      $('#permissionUserSummary').innerHTML = `<strong>${escapeHtml(res.user.role)}</strong>${escapeHtml(res.user.email)}`;
      renderPermissionCheckboxes($('#editPagePermissions'), res.catalog.pages, res.permissions.pages, 'edit_page_permission');
      renderPermissionCheckboxes($('#editCapabilityPermissions'), res.catalog.capabilities, res.permissions.capabilities, 'edit_cap_permission');
      openModal('permissionModal');
    } catch (error) { showToast('Rukhsado', error.message); }
  };

  document.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-permissions]');
    if (edit) { await openPermissionEditor(edit.dataset.editPermissions); return; }
    const resend = event.target.closest('[data-resend-invite]');
    if (resend) {
      const original = resend.textContent; resend.disabled = true; resend.textContent = 'Diraya…';
      try {
        const result = await API.invitations.resend(Number(resend.dataset.resendInvite));
        if (result.invite_url) {
          $('#lastInviteLink').value = result.invite_url; $('#lastInviteLinkBox').hidden = false;
        }
        showToast('Invitation', result.message);
        const [u,i] = await Promise.all([API.users.list(), API.invitations.list()]); users=u.data||[]; invitations=i.data||[]; renderUsers(); renderMailStatus(i.mail||{});
      } catch (error) { showToast('Invitation', error.message); }
      finally { resend.disabled=false; resend.textContent=original; }
    }
    const revoke = event.target.closest('[data-revoke-invite]');
    if (revoke) {
      if (!window.confirm('Ma joojinaysaa casuumaaddan?')) return;
      const original = revoke.textContent; revoke.disabled = true; revoke.textContent = 'Joojinaya…';
      try {
        const result = await API.invitations.revoke(Number(revoke.dataset.revokeInvite));
        showToast('Invitation', result.message);
        const [u,i] = await Promise.all([API.users.list(), API.invitations.list()]); users=u.data||[]; invitations=i.data||[]; renderUsers(); renderMailStatus(i.mail||{});
      } catch (error) { showToast('Invitation', error.message); }
      finally { revoke.disabled=false; revoke.textContent=original; }
    }
  });

  $('#permissionForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); const original = button.textContent;
    button.disabled=true; button.textContent='Kaydinaya…';
    try {
      const result = await API.userPermissions.save({
        user_id: Number($('#permissionUserId').value),
        scope: $('#permissionScope').value,
        pages: checkedPermissionValues($('#editPagePermissions'), 'edit_page_permission'),
        capabilities: checkedPermissionValues($('#editCapabilityPermissions'), 'edit_cap_permission'),
      });
      closeModal($('#permissionModal'));
      showToast('Rukhsadaha', result.message);
      users=(await API.users.list()).data||[]; renderUsers();
    } catch(error){ showToast('Rukhsadaha', error.message); }
    finally{ button.disabled=false; button.textContent=original; }
  });

  $('#copyInviteLink')?.addEventListener('click', async () => {
    const value = $('#lastInviteLink')?.value || '';
    if (!value) return;
    try { await navigator.clipboard.writeText(value); showToast('Invitation Link', 'Link-ga waa la koobi-gareeyey.'); }
    catch (_) { $('#lastInviteLink')?.select(); document.execCommand('copy'); showToast('Invitation Link', 'Link-ga waa la koobi-gareeyey.'); }
  });

  document.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-dispatch-status]');
    if (!select) return;
    try {
      await API.dispatch.update(select.dataset.dispatchStatus, { status: select.value });
      renderDispatch((await API.dispatch.list()).data);
      showToast('Dispatch', 'Xaaladda wicitaanka waa la cusboonaysiiyey.');
    } catch (error) { showToast('Khalad', error.message); }
  });

  document.addEventListener('click', async (event) => {
    const taskButton = event.target.closest('[data-complete-task]');
    if (taskButton) {
      try {
        await API.tasks.update(taskButton.dataset.completeTask, { status: 'Completed' });
        renderTasks((await API.tasks.list()).data);
        showToast('Hawlaha', 'Hawsha waa la dhammaystiray.');
      } catch (error) { showToast('Khalad', error.message); }
      return;
    }
    const chainButton = event.target.closest('[data-evidence-chain]');
    if (chainButton) {
      const id = chainButton.dataset.evidenceChain;
      $('#movementEvidenceId').value = id;
      try { renderEvidenceChain((await API.evidenceChain.list({ evidence_id: id })).data); }
      catch (error) { renderEvidenceChain([]); showToast('Caddeynta', error.message); }
      openModal('evidenceMovementModal');
    }
  });



  const applyOperationFilters = () => {
    const query=($('#operationSearch')?.value||'').trim().toLowerCase();
    const active=$('#operationFilterTabs button.active')?.dataset.operationStatus||'';
    renderOperations(operations.filter((row)=>(!active||row.status===active)&&(!query||[row.name,row.commander_name,row.location,row.op_code].some((v)=>String(v||'').toLowerCase().includes(query)))));
  };
  $$('#operationFilterTabs button').forEach((button)=>button.addEventListener('click',()=>{ $$('#operationFilterTabs button').forEach((item)=>item.classList.toggle('active',item===button)); applyOperationFilters(); }));
  $('#operationFilterButton')?.addEventListener('click',applyOperationFilters);
  $('#operationSearch')?.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();applyOperationFilters();}});
  const applyOfficerFilters = () => {
    const query=($('#officerSearch')?.value||'').trim().toLowerCase();
    const active=$('#officerFilterTabs button.active')?.dataset.officerStatus||'';
    renderOfficers(officers.filter((row)=>(!active||row.status===active)&&(!query||[row.full_name,row.badge_id,row.department,row.rank].some((v)=>String(v||'').toLowerCase().includes(query)))));
  };
  $$('#officerFilterTabs button').forEach((button)=>button.addEventListener('click',()=>{ $$('#officerFilterTabs button').forEach((item)=>item.classList.toggle('active',item===button)); applyOfficerFilters(); }));
  $('#officerFilterButton')?.addEventListener('click',applyOfficerFilters);
  $('#officerSearch')?.addEventListener('keydown',(event)=>{if(event.key==='Enter'){event.preventDefault();applyOfficerFilters();}});

  $('#commandPrintButton')?.addEventListener('click', () => window.print());
  $('#citizenSearchButton')?.addEventListener('click', () => {
    const query = ($('#citizenSearchInput')?.value || '').trim().toLowerCase();
    const district = $('#citizenDistrictFilter')?.value || '';
    const type = $('#citizenTypeFilter')?.value || '';
    renderCitizens(citizens.filter((row) => {
      const matchesQuery = !query || [row.full_name,row.national_id,row.phone].some((value) => String(value || '').toLowerCase().includes(query));
      return matchesQuery && (!district || row.district === district) && (!type || row.record_type === type);
    }));
  });
  $('#citizenSearchInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); $('#citizenSearchButton')?.click(); } });

  $('#changePasswordForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Sugaya...'; }
    try {
      const result = await API.changePassword(Object.fromEntries(new FormData(form).entries()));
      if (currentUser) currentUser.force_password_change = false;
      closeModal($('#changePasswordModal'));
      form.reset();
      showToast('Amniga Akoonka', result.message);
    } catch (error) { showToast('Khalad', error.message); }
    finally { if (button) { button.disabled = false; button.textContent = original; } }
  });

  $('#documentUploadForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = 'Uploading...'; }
    try {
      const result = await API.uploadDocument(new FormData(form));
      closeModal($('#documentModal'));
      form.reset();
      renderDocuments((await API.documents.list()).data);
      showToast('Dukumentiyada', result.document_number ? `${result.document_number} waa la kaydiyey.` : 'Dukumentiga waa la kaydiyey.');
    } catch (error) { showToast('Khalad', error.message); }
    finally { if (button) { button.disabled = false; button.textContent = original; } }
  });

  $$('.report-template-grid button').forEach((button) => {
    button.addEventListener('click', async () => {
      const title = button.closest('article')?.querySelector('h3')?.textContent || 'Report';
      const typeMap = { 'Daily Command Report': 'Daily', 'Crime Statistics': 'Monthly', 'Officer Performance': 'HR', 'Finance & Fleet': 'Finance' };
      try {
        const res = await API.generateReport({ type: typeMap[title] || 'Daily', title });
        showToast('Warbixin', `"${res.title}" waa la diyaariyey.`);
      } catch (error) {
        showToast('Warbixin', error.message);
      }
    });
  });

  function showToast(title, message) {
    const container = $('#toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✓</span><div><strong>${title}</strong><small>${message}</small></div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 250);
    }, 3600);
  }

  // Canvas charts without external libraries
  const themeColors = () => {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue('--text-muted').trim() || '#6b788c',
      border: styles.getPropertyValue('--border').trim() || '#e2e8f0',
      surface: styles.getPropertyValue('--surface').trim() || '#ffffff',
      blue: '#1d70e8',
      blueSoft: 'rgba(29,112,232,.12)',
      muted: appState.theme === 'dark' ? '#3f5269' : '#cbd3df',
      green: '#0c9c70',
      gold: '#f4bd42'
    };
  };

  const setupCanvas = (canvas, height) => {
    if (!canvas || canvas.offsetParent === null) return null;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const cssHeight = height || canvas.clientHeight || 220;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(cssHeight * ratio));
    canvas.style.height = `${cssHeight}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { ctx, width, height: cssHeight };
  };

  const drawLineChart = (canvas, values, comparison = null, labels = []) => {
    const setup = setupCanvas(canvas, canvas?.id === 'trafficMiniChart' ? 100 : 220);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = themeColors();
    const pad = canvas.id === 'trafficMiniChart' ? { l: 4, r: 4, t: 10, b: 4 } : { l: 38, r: 12, t: 12, b: 28 };
    const chartW = width - pad.l - pad.r;
    const chartH = height - pad.t - pad.b;
    const allValues = comparison ? values.concat(comparison) : values;
    const max = Math.max(...allValues) * 1.15;
    const min = Math.min(...allValues) * .75;
    const y = (v) => pad.t + chartH - ((v - min) / (max - min || 1)) * chartH;
    const x = (i, length = values.length) => pad.l + (i / (length - 1 || 1)) * chartW;

    ctx.clearRect(0, 0, width, height);
    if (canvas.id !== 'trafficMiniChart') {
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      ctx.fillStyle = colors.text;
      ctx.font = '10px Inter, sans-serif';
      for (let i = 0; i <= 4; i++) {
        const yy = pad.t + (chartH / 4) * i;
        ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(width - pad.r, yy); ctx.stroke();
        const label = Math.round(max - ((max - min) / 4) * i);
        ctx.fillText(String(label), 4, yy + 3);
      }
      labels.forEach((label, i) => {
        if (i % Math.ceil(labels.length / 6) !== 0 && i !== labels.length - 1) return;
        ctx.fillText(label, x(i) - 7, height - 8);
      });
    }

    const line = (series, stroke, fill = null, dashed = false) => {
      ctx.save();
      ctx.beginPath();
      series.forEach((v, i) => i === 0 ? ctx.moveTo(x(i, series.length), y(v)) : ctx.lineTo(x(i, series.length), y(v)));
      ctx.strokeStyle = stroke;
      ctx.lineWidth = canvas.id === 'trafficMiniChart' ? 2.3 : 2.5;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (dashed) ctx.setLineDash([5, 6]);
      ctx.stroke();
      if (fill) {
        ctx.lineTo(x(series.length - 1, series.length), pad.t + chartH);
        ctx.lineTo(x(0, series.length), pad.t + chartH);
        ctx.closePath();
        const gradient = ctx.createLinearGradient(0, pad.t, 0, pad.t + chartH);
        gradient.addColorStop(0, fill);
        gradient.addColorStop(1, 'rgba(29,112,232,0)');
        ctx.fillStyle = gradient; ctx.fill();
      }
      ctx.restore();
    };

    if (comparison) line(comparison, colors.muted, null, true);
    line(values, colors.blue, colors.blueSoft, false);
  };

  const drawBarChart = (canvas, values, labels) => {
    const setup = setupCanvas(canvas, 250);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const colors = themeColors();
    const pad = { l: 35, r: 12, t: 16, b: 28 };
    const chartW = width - pad.l - pad.r;
    const chartH = height - pad.t - pad.b;
    const max = Math.max(1, ...values) * 1.2;
    ctx.clearRect(0, 0, width, height);
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = colors.text;
    ctx.strokeStyle = colors.border;
    for (let i = 0; i <= 4; i++) {
      const yy = pad.t + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(width - pad.r, yy); ctx.stroke();
      ctx.fillText(`$${Math.round(max - (max / 4) * i)}K`, 0, yy + 3);
    }
    const gap = chartW / values.length;
    const barW = Math.min(26, gap * .55);
    values.forEach((value, i) => {
      const h = (value / max) * chartH;
      const xx = pad.l + i * gap + (gap - barW) / 2;
      const yy = pad.t + chartH - h;
      const gradient = ctx.createLinearGradient(0, yy, 0, pad.t + chartH);
      gradient.addColorStop(0, colors.blue);
      gradient.addColorStop(1, '#65a6ff');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(xx, yy, barW, h, [5, 5, 0, 0]); else ctx.rect(xx, yy, barW, h);
      ctx.fill();
      ctx.fillStyle = colors.text;
      ctx.fillText(labels[i], xx - 1, height - 8);
    });
  };

  const crimeSeries = {
    30: [18, 23, 20, 29, 25, 31, 28, 35, 32, 38, 34, 42, 36, 44, 41, 48, 43, 51, 47, 54, 50, 58, 53, 61, 55, 63, 59, 67, 62, 69],
    14: [36, 44, 41, 48, 43, 51, 47, 54, 50, 58, 53, 61, 62, 69],
    7: [54, 50, 58, 53, 61, 62, 69]
  };

  function drawAllCharts() {
    const range = Number($('#chartRange')?.value || 30);
    const values = crimeSeries[range];
    const comparison = values.map((value, index) => Math.max(12, value - 5 + ((index % 3) - 1) * 3));
    const labels = range === 7 ? ['Isn', 'Tal', 'Arb', 'Kha', 'Jim', 'Sab', 'Axd'] : values.map((_, i) => `${i + 1}`);
    drawLineChart($('#crimeTrendChart'), values, comparison, labels);
    drawLineChart($('#trafficMiniChart'), [14, 18, 13, 20, 17, 22, 18, 25, 21, 19, 24, 20], null, []);
    drawBarChart($('#financeChart'), financeMonthlyData.some((value) => value > 0) ? financeMonthlyData : Array(12).fill(0), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
  }

  $('#chartRange')?.addEventListener('change', drawAllCharts);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawAllCharts, 180);
  });
  requestAnimationFrame(drawAllCharts);
})();
