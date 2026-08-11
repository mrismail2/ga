/* ============================================================
   DentalFlow Pro — application shell, router and views
   ============================================================ */

const D = DF_DATA;
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const state = {
  view: 'dashboard',
  param: null,
  theme: localStorage.getItem('df_theme') || 'light',
  mini: localStorage.getItem('df_mini') === '1',
  query: '',
  tab: 'overview',
  settingsTab: 'clinic',
  selectedTooth: null,
  odoPatient: 'P-1002',
  teeth: { ...D.toothStates },
  switches: { sms: true, email: true, backup: true, reminders: true, twofa: false, portal: true }
};

const TODAY = '2026-08-11';
const patientById = id => D.patients.find(p => p.id === id) || { id, name: '—', avatar: '?' };
const dentistById = id => D.dentists.find(d => d.id === id) || { id, name: 'Unassigned', spec: '—' };

/* ------------------------------------------------------------
   Navigation model
   ------------------------------------------------------------ */
const NAV = [
  { group: 'nav.main', items: [
    { key: 'dashboard', icon: 'dashboard' },
    { key: 'patients', icon: 'patients', badge: D.patients.length },
    { key: 'dentists', icon: 'dentist' },
    { key: 'appointments', icon: 'calendar', badge: D.appointments.filter(a => a.date === TODAY).length },
    { key: 'chairs', icon: 'chair' }
  ]},
  { group: 'nav.clinical', items: [
    { key: 'treatments', icon: 'treatment' },
    { key: 'odontogram', icon: 'tooth' },
    { key: 'xray', icon: 'xray' },
    { key: 'prescriptions', icon: 'rx' },
    { key: 'labs', icon: 'lab', badge: D.labs.filter(l => l.status !== 'Delivered').length }
  ]},
  { group: 'nav.finance', items: [
    { key: 'invoices', icon: 'invoice' },
    { key: 'payments', icon: 'payment' }
  ]},
  { group: 'nav.manage', items: [
    { key: 'inventory', icon: 'inventory', badge: D.inventory.filter(i => i.stock < i.min).length },
    { key: 'staff', icon: 'staff' },
    { key: 'reports', icon: 'reports' },
    { key: 'settings', icon: 'settings' }
  ]}
];
const NAV_ICON = {};
NAV.forEach(g => g.items.forEach(i => { NAV_ICON[i.key] = i.icon; }));

/* ------------------------------------------------------------
   Shell
   ------------------------------------------------------------ */
function renderSidebar() {
  const me = D.dentists[0];
  $('#sidebar').innerHTML = `
    <div class="brand">
      <span class="brand__mark">${icon('tooth')}</span>
      <span class="brand__text">Dental<span>Flow</span></span>
      <span class="brand__pro">Pro</span>
    </div>
    <nav class="nav">
      ${NAV.map(g => `
        <div class="nav__label eyebrow">${t(g.group)}</div>
        ${g.items.map(it => `
          <div class="nav__item ${state.view === it.key ? 'active' : ''}" data-nav="${it.key}"
               role="link" tabindex="0" title="${t(it.key)}">
            ${icon(it.icon)}<span>${t(it.key)}</span>
            ${it.badge ? `<span class="nav__badge">${it.badge}</span>` : ''}
          </div>`).join('')}`).join('')}
    </nav>
    <div class="sidebar__foot">
      <div class="sidebar__user" data-toast="Account menu">
        ${avatar(me.name)}
        <div class="who grow truncate"><b class="truncate">${me.name}</b><small>${me.role}</small></div>
        <span class="status-dot" title="Online"></span>
      </div>
    </div>`;
}

function renderTopbar() {
  const me = D.dentists[0];
  $('#topbar').innerHTML = `
    <button class="icon-btn" id="btn-menu" title="Toggle sidebar">${icon('menu')}</button>
    <button class="cmd-trigger" id="btn-cmdk">
      ${icon('search')}<span>${t('search')}</span><kbd class="kbd">⌘K</kbd>
    </button>
    <div class="topbar__right">
      <div class="seg-toggle" title="Language">
        <button class="${LANG === 'en' ? 'on' : ''}" data-lang="en">EN</button>
        <button class="${LANG === 'so' ? 'on' : ''}" data-lang="so">SO</button>
      </div>
      <button class="icon-btn" id="btn-theme" title="Toggle theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>
      <button class="icon-btn" data-toast="3 unread messages" title="Messages">${icon('chat')}<span class="dot"></span></button>
      <button class="icon-btn" data-toast="5 new notifications" title="Notifications">${icon('bell')}<span class="dot"></span></button>
      <div class="topbar__user" data-toast="Account menu">
        ${avatar(me.name, 'sm')}
        <div class="who"><b>${me.name}</b><small>${me.spec}</small></div>
        ${icon('chevronDown')}
      </div>
    </div>`;
}

/* Page header with breadcrumbs */
function pageHead({ title, sub, crumbs = [], actions = '', label, root = false }) {
  const trail = root ? [] : [{ label: t('dashboard'), view: 'dashboard' }, ...crumbs];
  return `
  ${trail.length ? `<div class="crumbs">
    ${trail.map((c, i) => `${i ? icon('chevronRight') : ''}<a data-nav="${c.view}">${c.label}</a>`).join('')}
    ${icon('chevronRight')}<span class="cur">${label || title}</span>
  </div>` : ''}
  <div class="page__head">
    <div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}

/* ------------------------------------------------------------
   Shared building blocks
   ------------------------------------------------------------ */
const statCard = ({ icon: ic, label, value, delta, up, t: tn, spark }) => `
  <div class="stat" style="${tone(tn)}">
    <div class="row">
      <span class="stat__icon">${icon(ic)}</span>
      <span class="stat__label grow">${label}</span>
    </div>
    <div class="stat__foot">
      <div class="grow"><div class="stat__value">${value}</div></div>
      ${spark ? `<div>${Chart.spark(spark, TONE_VAR[tn][0])}</div>` : ''}
    </div>
    ${delta !== undefined ? `<div class="row sm">
      <span class="delta ${up ? 'up' : 'down'}">${icon(up ? 'trendUp' : 'trendDown')}${delta}%</span>
      <span class="t-2xs faint">${t('vsYesterday')}</span></div>` : ''}
  </div>`;

const searchBox = ph => `<div class="search-inline">${icon('search')}
  <input class="input" placeholder="${ph}" data-search value="${state.query}"></div>`;

const rowBtns = extra => `<div class="row-actions">
  ${extra || `<button class="icon-btn" data-toast="Opening record" title="View">${icon('eye')}</button>`}
  <button class="icon-btn" data-toast="Edit mode enabled" title="Edit">${icon('edit')}</button>
  <button class="icon-btn" data-toast="Delete needs admin approval" title="Delete">${icon('trash')}</button></div>`;

function dataTable({ title, sub, crumbs, actions = '', toolbar = '', head, rows, count, total }) {
  return pageHead({ title, sub, crumbs, actions }) + `
  <div class="card">
    ${toolbar ? `<div class="toolbar">${toolbar}</div>` : ''}
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>${head.map(h => typeof h === 'string'
          ? `<th>${h}</th>` : `<th class="${h.right ? 'right' : ''}">${h.label}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${count ? '' : `<div class="empty">${icon('search')}<p>${t('noResults')}</p></div>`}
    </div>
    <div class="card__foot">
      <span class="t-xs faint">Showing <b class="fw-7">${count}</b> of ${total || count}</span>
      <div class="pager ml-auto">
        <button title="Previous">${icon('chevronLeft')}</button>
        <button class="on">1</button><button>2</button>
        <button title="Next">${icon('chevronRight')}</button>
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------
   Views
   ------------------------------------------------------------ */
const V = {};

/* ---------- Dashboard ---------- */
V.dashboard = () => {
  const today = D.appointments.filter(a => a.date === TODAY);
  const lowStock = D.inventory.filter(i => i.stock < i.min);
  const free = D.chairs.filter(c => c.status === 'Available').length;

  return pageHead({
    root: true,
    title: `${t('greeting')}, ${D.dentists[0].name}`,
    sub: t('dash.sub'),
    actions: `<button class="btn" data-print>${icon('print')} ${t('print')}</button>
              <button class="btn" data-toast="Dashboard exported as CSV">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="appointment">${icon('plus')} ${t('newAppt')}</button>`
  }) + `
  <div class="grid g-4 mb">
    ${statCard({ icon: 'calendar', label: t('stat.appts'), value: '32', delta: 15, up: true, t: 'brand', spark: [21, 26, 22, 28, 25, 30, 32] })}
    ${statCard({ icon: 'patients', label: t('stat.patients'), value: '24', delta: 12, up: true, t: 'teal', spark: [16, 19, 17, 21, 20, 22, 24] })}
    ${statCard({ icon: 'dollar', label: t('stat.revenue'), value: money(5670), delta: 18, up: true, t: 'ok', spark: [3900, 4200, 4050, 4800, 4600, 5200, 5670] })}
    ${statCard({ icon: 'clock', label: t('stat.pending'), value: '18', delta: 8, up: false, t: 'warn', spark: [24, 23, 21, 22, 20, 19, 18] })}
  </div>

  <div class="grid g-wide mb">
    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.revenue')}</h3><p>January – August 2026</p></div>
        <div class="right">
          <div class="chart-legend">
            <div><i style="background:var(--brand-500)"></i>Revenue</div>
            <div><i style="background:var(--warn)"></i>Expenses</div>
          </div>
          <select class="select btn--sm" style="width:88px"><option>2026</option><option>2025</option></select>
        </div>
      </div>
      <div class="card__body">
        <div class="row lg mb-16">
          <div><div class="eyebrow">August</div>
            <div class="t-lg fw-8" style="letter-spacing:-.03em;font-size:26px">$48,750</div></div>
          <div class="row sm"><span class="delta up">${icon('trendUp')}20.5%</span>
            <span class="t-2xs faint">vs July</span></div>
        </div>
        ${chartHost('area', D.revenue, { h: 232, second: { key: 'exp', color: 'var(--warn)', label: 'Exp' } })}
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${t('card.mix')}</h3><p>Last 30 days</p></div></div>
      <div class="card__body">
        <div class="donut-wrap">
          ${Chart.donut(D.treatmentMix, { centerTop: '128', centerSub: 'Treatments' })}
          <div class="chart-legend">
            ${D.treatmentMix.map(s => `<div><i style="background:${s.color}"></i>${s.label}<b>${s.value}</b></div>`).join('')}
          </div>
        </div>
        <div class="hint mt-16">${icon('trendUp')}
          <span>Completion rate is up 6 points this month — 72 of 128 plans closed.</span></div>
      </div>
    </div>
  </div>

  <div class="grid g-mid mb">
    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.upcoming')}</h3><p>Tuesday, 11 August 2026 · ${today.length} booked</p></div>
        <div class="right"><button class="btn btn--sm btn--ghost" data-nav="appointments">${t('viewAll')} ${icon('arrowRight')}</button></div>
      </div>
      <div class="card__body flush">
        ${today.map(a => {
          const p = patientById(a.patient), d = dentistById(a.dentist);
          const tn = { Confirmed: 'ok', 'In Progress': 'brand', Upcoming: 'warn', Cancelled: 'danger', Completed: 'ok' }[a.status] || 'brand';
          return `<div class="appt" style="${tone(tn)}" data-patient="${p.id}" role="button" tabindex="0">
            <span class="appt__time num">${a.time}</span>
            <span class="appt__rail"></span>
            ${avatar(p.name, 'sm')}
            <div class="appt__main"><b>${p.name}</b><small>${a.type} · ${d.name} · ${a.chair}</small></div>
            ${chip(a.status)}
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.chairs')}</h3><p>${free} of ${D.chairs.length} available</p></div>
        <div class="right"><button class="btn btn--sm btn--ghost" data-nav="chairs">${t('viewAll')} ${icon('arrowRight')}</button></div>
      </div>
      <div class="card__body">
        <div class="grid g-2" style="gap:10px">
          ${D.chairs.map(c => chairCard(c, true)).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-3">
    <div class="card">
      <div class="card__head"><div><h3>${t('card.week')}</h3><p>Patients seen per day</p></div></div>
      <div class="card__body">
        ${chartHost('bars', D.weekLoad, { h: 186 })}
        <div class="row mt-16" style="gap:8px">
          ${[['Total', D.weekLoad.reduce((s, w) => s + w.v, 0)],
             ['Daily avg', Math.round(D.weekLoad.reduce((s, w) => s + w.v, 0) / 7)],
             ['Busiest', 'Thursday']].map(([l, v]) => `
            <div class="tile"><span class="eyebrow">${l}</span><b>${v}</b></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${t('card.activity')}</h3><p>Live clinic feed</p></div></div>
      <div class="card__body flush"><ul class="activity" style="padding:8px 0">
        ${D.activity.map(a => `<li style="${tone(a.tone)}">
          <span class="ic">${icon(a.icon)}</span>
          <div><p>${a.text}</p><small>${a.time}</small></div></li>`).join('')}
      </ul></div>
    </div>

    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.stock')}</h3><p>${lowStock.length} items below minimum</p></div>
        <div class="right"><button class="btn btn--sm btn--ghost" data-nav="inventory">${t('viewAll')} ${icon('arrowRight')}</button></div>
      </div>
      <div class="card__body flush">
        ${lowStock.map(i => `
          <div class="row" style="padding:11px 18px;border-bottom:1px solid var(--line);${tone('warn')}">
            <span class="activity"><span class="ic" style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:var(--tone-bg);color:var(--tone)">${icon('alert')}</span></span>
            <div class="grow"><b class="t-sm fw-7">${i.name}</b>
              <div class="t-2xs faint">${i.stock} ${i.unit}s left · minimum ${i.min}</div></div>
            <button class="btn btn--sm" data-toast="Reorder request sent to ${i.supplier}">Reorder</button>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
};

function chairCard(c, compactMode) {
  const tn = c.status === 'Available' ? 'ok' : c.status === 'In Use' ? 'brand' : 'warn';
  const d = c.dentist ? dentistById(c.dentist) : null;
  const p = c.patient ? patientById(c.patient) : null;
  const sub = c.status === 'In Use' ? 'Since ' + c.since
    : c.status === 'Maintenance' ? 'Servicing since ' + c.since : 'Free until ' + c.next;
  return `<div class="chair" style="${tone(tn)}">
    <div class="row"><div class="grow"><h4>${c.id}</h4><small>${sub}</small></div>${chip(c.status)}</div>
    <div class="row mt-12">${d ? avatar(d.name, 'sm') + `<div class="grow truncate"><b class="t-xs fw-7">${d.name}</b>
      <div class="t-2xs faint">${d.spec}</div></div>` : '<span class="t-xs faint">No dentist assigned</span>'}</div>
    ${compactMode ? '' : `<div class="row mt-8">${p ? avatar(p.name, 'sm') + `<div class="grow truncate">
      <b class="t-xs fw-7">${p.name}</b><div class="t-2xs faint">${(D.appointments.find(a => a.patient === p.id && a.chair === c.id) || {}).type || 'In treatment'}</div></div>`
      : '<span class="t-xs faint">No patient in chair</span>'}</div>
    <div class="row sm mt-12">
      <button class="btn btn--sm grow" data-toast="${c.id} timeline">${icon('clock')} Timeline</button>
      <button class="btn btn--sm grow ${c.status === 'Available' ? 'btn--primary' : ''}" data-toast="${c.id} updated">Update</button>
    </div>`}
  </div>`;
}

/* ---------- Patients ---------- */
V.patients = () => {
  const q = state.query.toLowerCase();
  const list = D.patients.filter(p => !q || (p.name + p.id + p.phone + p.city).toLowerCase().includes(q));
  return dataTable({
    title: t('patients'),
    sub: `${D.patients.length} registered · ${D.patients.filter(p => p.status === 'Active').length} active · ${D.patients.filter(p => p.balance > 0).length} with balance`,
    actions: `<button class="btn">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="patient">${icon('plus')} ${t('newPatient')}</button>`,
    toolbar: `${searchBox('Search name, ID or phone…')}
      <div class="segmented"><button class="on">${t('all')}</button><button>Active</button><button>New</button><button>Inactive</button></div>
      <select class="select" style="width:132px"><option>All cities</option><option>Hargeisa</option><option>Gabiley</option><option>Berbera</option></select>
      <button class="btn ml-auto">${icon('filter')} ${t('filter')}</button>`,
    head: ['Patient', 'Contact', 'Age / Gender', 'Insurance', 'Last visit', 'Balance', 'Status', { label: '', right: true }],
    count: list.length, total: D.patients.length,
    rows: list.map(p => `<tr class="clickable" data-patient="${p.id}">
      <td><div class="cell-user">${avatar(p.name)}<div><b>${p.name}</b><small>${p.id} · ${p.city}</small></div></div></td>
      <td><div class="t-sm">${p.phone}</div><small class="t-2xs faint">${p.email}</small></td>
      <td class="num">${p.age} · ${p.gender}</td>
      <td>${p.insurance === 'None' ? '<span class="faint">—</span>' : chip(p.insurance, 'info')}</td>
      <td class="num">${p.lastVisit}</td>
      <td class="num fw-7" style="${p.balance ? 'color:var(--danger)' : 'color:var(--text-3)'}">${p.balance ? money(p.balance) : '—'}</td>
      <td>${chip(p.status)}</td>
      <td class="right">${rowBtns(`<button class="icon-btn" data-patient="${p.id}" title="Open profile">${icon('eye')}</button>`)}</td>
    </tr>`).join('')
  });
};

/* ---------- Patient detail ---------- */
V.patient = () => {
  const p = patientById(state.param);
  const appts = D.appointments.filter(a => a.patient === p.id);
  const treats = D.treatments.filter(x => x.patient === p.id);
  const invs = D.invoices.filter(i => i.patient === p.id);
  const rays = D.xrays.filter(x => x.patient === p.id);
  const rxs = D.prescriptions.filter(r => r.patient === p.id);
  const billed = invs.reduce((s, i) => s + i.total, 0);
  const paid = invs.reduce((s, i) => s + i.paid, 0);

  const tabs = { overview: 'Overview', treatments: 'Treatments', appointments: 'Appointments', billing: 'Billing', imaging: 'Imaging & Rx' };

  const panes = {
    overview: `
      <div class="grid g-3">
        <div class="card">
          <div class="card__head"><div><h3>Medical record</h3></div></div>
          <div class="card__body">
            <div class="kv">
              <div><small>Blood group</small><b>${p.blood}</b></div>
              <div><small>Allergies</small><b style="${p.allergy !== 'None' ? 'color:var(--danger)' : ''}">${p.allergy}</b></div>
              <div><small>Insurance</small><b>${p.insurance}</b></div>
              <div><small>Registered</small><b>${p.joined}</b></div>
              <div><small>Last visit</small><b>${p.lastVisit}</b></div>
              <div><small>City</small><b>${p.city}</b></div>
            </div>
            ${p.allergy !== 'None' ? `<div class="hint mt-16" style="border-color:var(--danger-line);background:var(--danger-bg)">
              ${icon('alert')}<span>Allergy on file: <b>${p.allergy}</b>. Check before prescribing.</span></div>` : ''}
          </div>
        </div>
        <div class="card">
          <div class="card__head"><div><h3>Clinical timeline</h3></div></div>
          <div class="card__body">
            <ul class="timeline">
              ${[...treats.map(x => ({ d: x.started, b: x.name, s: `${dentistById(x.dentist).name} · ${money(x.cost)}`, tn: 'brand' })),
                 ...rays.map(x => ({ d: x.date, b: `${x.type} X-ray (tooth ${x.tooth})`, s: x.note, tn: 'violet' })),
                 ...rxs.map(x => ({ d: x.date, b: 'Prescription issued', s: x.items, tn: 'ok' }))]
                .sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6)
                .map(e => `<li style="${tone(e.tn)}"><b>${e.b}</b><small>${e.d} · ${e.s}</small></li>`).join('')
                || '<li><b>No clinical history yet</b><small>Records will appear here after the first treatment.</small></li>'}
            </ul>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><div><h3>At a glance</h3></div></div>
          <div class="card__body">
            ${(() => {
              const next = appts.filter(a => a.date >= TODAY && a.status !== 'Cancelled')
                .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
              const open = treats.find(x => x.status === 'Ongoing');
              const owed = invs.filter(i => i.total > i.paid);
              return `
                <div class="eyebrow mb-8">Next appointment</div>
                ${next ? `<div class="row" style="${tone('brand')}">
                    <span class="stat__icon">${icon('calendar')}</span>
                    <div class="grow"><b class="t-sm fw-7">${next.type}</b>
                      <div class="t-2xs faint">${next.date} · ${next.time} · ${dentistById(next.dentist).name}</div></div>
                  </div>` : '<p class="t-sm faint">Nothing scheduled — book a recall.</p>'}
                <hr class="divider mt-16 mb-16">
                <div class="eyebrow mb-8">Active treatment</div>
                ${open ? `<b class="t-sm fw-7">${open.name}</b>
                  <div class="t-2xs faint mb-8">Tooth ${open.tooth} · session ${open.sessions}</div>
                  <span class="bar"><i style="width:${open.progress}%"></i></span>`
                  : '<p class="t-sm faint">No treatment in progress.</p>'}
                <hr class="divider mt-16 mb-16">
                <div class="eyebrow mb-8">Account</div>
                <div class="row between t-sm"><span class="muted">Invoices</span><b class="num">${invs.length}</b></div>
                <div class="row between t-sm mt-8"><span class="muted">Outstanding</span>
                  <b class="num" style="${owed.length ? 'color:var(--danger)' : ''}">${money(billed - paid)}</b></div>
                <button class="btn btn--sm w-full mt-16" data-tab="billing">${icon('invoice')} Open billing</button>`;
            })()}
          </div>
        </div>
      </div>`,
    treatments: treats.length ? `<div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Treatment</th><th>Tooth</th><th>Dentist</th><th>Sessions</th><th>Progress</th><th>Cost</th><th>Status</th></tr></thead>
        <tbody>${treats.map(x => `<tr>
          <td><b class="fw-7">${x.name}</b><br><small class="t-2xs faint">Started ${x.started}</small></td>
          <td>${chip(x.tooth, 'muted')}</td><td>${dentistById(x.dentist).name}</td><td class="num">${x.sessions}</td>
          <td><div class="row sm"><span class="bar" style="width:80px"><i style="width:${x.progress}%"></i></span>
            <b class="t-xs num">${x.progress}%</b></div></td>
          <td class="num fw-7">${money(x.cost)}</td><td>${chip(x.status)}</td></tr>`).join('')}
        </tbody></table></div></div>`
      : emptyCard('No treatment plans', 'Create a plan to start tracking sessions and costs.'),
    appointments: appts.length ? `<div class="card"><div class="card__body flush">
        ${appts.map(a => `<div class="appt" style="${tone(a.status === 'Cancelled' ? 'danger' : 'brand')}">
          <span class="appt__time num">${a.date}</span><span class="appt__rail"></span>
          <div class="appt__main"><b>${a.type}</b><small>${a.time} · ${dentistById(a.dentist).name} · ${a.chair}</small></div>
          ${chip(a.status)}</div>`).join('')}
      </div></div>` : emptyCard('No appointments', 'Book the first appointment for this patient.'),
    billing: `
      <div class="grid g-3 mb">
        ${statCard({ icon: 'invoice', label: 'Total billed', value: money(billed), t: 'brand' })}
        ${statCard({ icon: 'check', label: 'Paid', value: money(paid), t: 'ok' })}
        ${statCard({ icon: 'clock', label: 'Outstanding', value: money(billed - paid), t: billed - paid ? 'danger' : 'ok' })}
      </div>
      ${invs.length ? `<div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Method</th><th>Status</th></tr></thead>
        <tbody>${invs.map(i => `<tr><td class="num fw-7">${i.id}</td><td class="num">${i.date}</td><td class="num">${i.due}</td>
          <td class="num fw-7">${money(i.total)}</td><td class="num">${money(i.paid)}</td><td>${i.method}</td>
          <td>${chip(i.status)}</td></tr>`).join('')}</tbody></table></div></div>`
        : emptyCard('No invoices', 'Invoices generated for this patient will appear here.')}`,
    imaging: `
      <div class="grid g-2">
        <div class="card"><div class="card__head"><div><h3>X-ray images</h3><p>${rays.length} on file</p></div></div>
          <div class="card__body">${rays.length ? `<div class="grid g-auto-sm">
            ${rays.map(x => xrayCard(x)).join('')}</div>`
            : '<p class="t-sm faint">No imaging on file.</p>'}</div></div>
        <div class="card"><div class="card__head"><div><h3>Prescriptions</h3><p>${rxs.length} issued</p></div></div>
          <div class="card__body">${rxs.length ? `<ul class="timeline">${rxs.map(r => `
            <li style="${tone(r.status === 'Active' ? 'ok' : 'brand')}"><b>${r.items}</b>
              <small>${r.date} · ${r.duration} · ${dentistById(r.dentist).name}</small></li>`).join('')}</ul>`
            : '<p class="t-sm faint">No prescriptions issued.</p>'}</div></div>
      </div>`
  };

  return pageHead({
    title: p.name,
    crumbs: [{ label: t('patients'), view: 'patients' }],
    sub: `${p.id} · ${p.age} years · ${p.gender} · ${p.city}`,
    actions: `<button class="btn" data-print>${icon('print')} ${t('print')}</button>
              <button class="btn" data-nav="odontogram">${icon('tooth')} ${t('odontogram')}</button>
              <button class="btn btn--primary" data-modal="appointment">${icon('plus')} ${t('newAppt')}</button>`
  }) + `
  <div class="card mb">
    <div class="profile">
      ${avatar(p.name, 'lg')}
      <div class="grow">
        <div class="row sm"><h2 class="t-md fw-8">${p.name}</h2>${chip(p.status)}</div>
        <div class="row sm mt-4 wrap">
          <span class="t-xs faint">${icon('phone')}</span><span class="t-xs muted">${p.phone}</span>
          <span class="t-xs faint">${icon('mail')}</span><span class="t-xs muted">${p.email}</span>
        </div>
      </div>
      <div class="row lg wrap">
        <div><div class="eyebrow">Balance</div>
          <b class="t-md fw-8" style="${p.balance ? 'color:var(--danger)' : ''}">${p.balance ? money(p.balance) : money(0)}</b></div>
        <div><div class="eyebrow">Visits</div><b class="t-md fw-8">${appts.length}</b></div>
        <div><div class="eyebrow">Plans</div><b class="t-md fw-8">${treats.length}</b></div>
      </div>
    </div>
    <div class="tabs">
      ${Object.entries(tabs).map(([k, v]) => `<button class="${state.tab === k ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}
    </div>
  </div>
  ${panes[state.tab] || panes.overview}`;
};

const emptyCard = (title, sub) => `<div class="card"><div class="empty">${icon('search')}
  <b class="t-sm fw-7" style="display:block;color:var(--text-2)">${title}</b><p>${sub}</p></div></div>`;

const xrayCard = x => `<div class="xray-card">
  <div class="img">${icon('xray')}<span class="chip">${x.type}</span></div>
  <div class="meta"><b class="t-sm fw-7">${patientById(x.patient).name}</b>
    <div class="t-2xs faint">Tooth ${x.tooth} · ${x.date}</div>
    <div class="row sm mt-8">${avatar(dentistById(x.dentist).name, 'sm')}
      <span class="t-2xs faint truncate">${x.note}</span></div></div></div>`;

/* ---------- Dentists ---------- */
V.dentists = () => pageHead({
  title: t('dentists'),
  sub: `${D.dentists.length} practitioners · specialities, schedules and performance`,
  actions: `<button class="btn btn--primary" data-modal="staff">${icon('plus')} Add dentist</button>`
}) + `<div class="grid g-auto">
  ${D.dentists.map(d => {
    const todays = D.appointments.filter(a => a.dentist === d.id && a.date === TODAY).length;
    return `<div class="card">
      <div class="card__body">
        <div class="row">
          ${avatar(d.name, 'lg')}
          <div class="grow truncate">
            <b class="t-md fw-8 truncate" style="display:block">${d.name}</b>
            <div class="t-xs muted">${d.spec}</div>
            <div class="row sm mt-4">
              <span class="chip chip--warn">${icon('star')}${d.rating}</span>
              <span class="t-2xs faint">${d.patients} patients</span>
            </div>
          </div>
        </div>
        <div class="kv mt-16">
          <div><small>Role</small><b>${d.role}</b></div>
          <div><small>Room</small><b>${d.room}</b></div>
          <div><small>Today</small><b>${todays} appointment${todays === 1 ? '' : 's'}</b></div>
          <div><small>Phone</small><b class="num t-xs">${d.phone}</b></div>
        </div>
      </div>
      <div class="card__foot">
        <button class="btn btn--sm grow" data-toast="Schedule for ${d.name}">${icon('calendar')} Schedule</button>
        <button class="btn btn--sm grow" data-toast="Profile opened">${icon('user')} Profile</button>
      </div>
    </div>`;
  }).join('')}</div>`;

/* ---------- Appointments ---------- */
V.appointments = () => {
  const q = state.query.toLowerCase();
  const list = D.appointments.filter(a => !q || (patientById(a.patient).name + a.type + a.id).toLowerCase().includes(q));
  return dataTable({
    title: t('appointments'),
    sub: `${D.appointments.filter(a => a.date === TODAY).length} today · ${D.chairs.length} chairs · ${D.dentists.length} dentists`,
    actions: `<button class="btn" data-toast="Calendar view">${icon('calendar')} Calendar</button>
              <button class="btn btn--primary" data-modal="appointment">${icon('plus')} ${t('newAppt')}</button>`,
    toolbar: `${searchBox('Search appointments…')}
      <div class="segmented"><button class="on">${t('today')}</button><button>${t('week')}</button><button>${t('month')}</button><button>${t('all')}</button></div>
      <select class="select" style="width:150px"><option>All dentists</option>${D.dentists.map(d => `<option>${d.name}</option>`).join('')}</select>
      <select class="select" style="width:118px"><option>All chairs</option>${D.chairs.map(c => `<option>${c.id}</option>`).join('')}</select>`,
    head: ['When', 'Patient', 'Treatment', 'Dentist', 'Chair', 'Duration', 'Status', { label: '', right: true }],
    count: list.length, total: D.appointments.length,
    rows: list.map(a => {
      const p = patientById(a.patient), d = dentistById(a.dentist);
      return `<tr class="clickable" data-patient="${p.id}">
        <td><b class="num t-sm">${a.time}</b><div class="t-2xs faint num">${a.date}</div></td>
        <td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${p.name}</b><small class="num">${p.phone}</small></div></div></td>
        <td><b class="fw-7">${a.type}</b><div class="t-2xs faint truncate" style="max-width:190px">${a.note}</div></td>
        <td><div class="cell-user">${avatar(d.name, 'sm')}<div><b>${d.name}</b><small>${d.spec}</small></div></div></td>
        <td>${a.chair}</td><td class="num">${a.duration} min</td><td>${chip(a.status)}</td>
        <td class="right">${rowBtns()}</td></tr>`;
    }).join('')
  });
};

/* ---------- Chairs ---------- */
V.chairs = () => pageHead({
  title: t('chairs'),
  sub: `Live operatory board · ${D.chairs.filter(c => c.status === 'Available').length} available now`,
  actions: `<button class="btn" data-toast="Board refreshed">${icon('history')} Refresh</button>
            <button class="btn btn--primary" data-modal="appointment">${icon('plus')} Assign patient</button>`
}) + `
  <div class="grid g-3 mb">${D.chairs.map(c => chairCard(c, false)).join('')}</div>
  <div class="card">
    <div class="card__head"><div><h3>Chair utilisation today</h3><p>Share of booked working hours</p></div></div>
    <div class="card__body">
      ${D.chairs.map((c, i) => {
        const pct = [82, 91, 46, 64, 12, 0][i];
        const col = pct > 75 ? 'var(--ok)' : pct > 40 ? 'var(--brand-500)' : 'var(--warn)';
        return `<div class="kpi row">
          <b class="t-sm" style="flex:0 0 78px">${c.id}</b>
          <span class="bar grow"><i style="width:${pct}%;background:${col}"></i></span>
          <b class="t-sm num right" style="flex:0 0 40px">${pct}%</b></div>`;
      }).join('')}
    </div>
  </div>`;

/* ---------- Treatments ---------- */
V.treatments = () => {
  const q = state.query.toLowerCase();
  const list = D.treatments.filter(x => !q || (x.name + patientById(x.patient).name).toLowerCase().includes(q));
  return dataTable({
    title: t('treatments'),
    sub: `${D.treatments.filter(x => x.status === 'Ongoing').length} ongoing · ${D.treatments.filter(x => x.status === 'Completed').length} completed · ${D.treatments.filter(x => x.status === 'Upcoming').length} planned`,
    actions: `<button class="btn">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="treatment">${icon('plus')} New plan</button>`,
    toolbar: `${searchBox('Search treatments…')}
      <div class="segmented"><button class="on">${t('all')}</button><button>Ongoing</button><button>Completed</button><button>Upcoming</button></div>`,
    head: ['Patient', 'Treatment', 'Tooth', 'Dentist', 'Sessions', 'Progress', 'Cost', 'Status', { label: '', right: true }],
    count: list.length, total: D.treatments.length,
    rows: list.map(x => {
      const p = patientById(x.patient);
      return `<tr class="clickable" data-patient="${p.id}">
        <td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${p.name}</b><small>${x.id}</small></div></div></td>
        <td><b class="fw-7">${x.name}</b><div class="t-2xs faint">Started ${x.started}</div></td>
        <td>${chip(x.tooth, 'muted')}</td>
        <td>${dentistById(x.dentist).name}</td>
        <td class="num">${x.sessions}</td>
        <td><div class="row sm"><span class="bar" style="width:76px"><i style="width:${x.progress}%"></i></span>
          <b class="t-xs num">${x.progress}%</b></div></td>
        <td class="num fw-7">${money(x.cost)}</td>
        <td>${chip(x.status)}</td>
        <td class="right">${rowBtns()}</td></tr>`;
    }).join('')
  });
};

/* ---------- Odontogram ---------- */
V.odontogram = () => {
  const quads = {
    ur: ['18','17','16','15','14','13','12','11'], ul: ['21','22','23','24','25','26','27','28'],
    lr: ['48','47','46','45','44','43','42','41'], ll: ['31','32','33','34','35','36','37','38']
  };
  const p = patientById(state.odoPatient);
  const tooth = (n, upper) => {
    const st = state.teeth[n] || 'healthy';
    return `<div class="tooth ${state.selectedTooth === n ? 'sel' : ''}" data-tooth="${n}"
      role="button" tabindex="0" title="Tooth ${n} · ${TOOTH_STATE[st].label}">
      ${upper ? toothSVG(st, true) : ''}<span>${n}</span>${upper ? '' : toothSVG(st, false)}</div>`;
  };
  const sel = state.selectedTooth;
  const selState = sel ? (state.teeth[sel] || 'healthy') : null;
  const history = sel ? D.treatments.filter(x => x.tooth === sel) : [];
  const counts = Object.entries(state.teeth).reduce((m, [, v]) => (m[v] = (m[v] || 0) + 1, m), {});

  return pageHead({
    title: t('odontogram'),
    sub: 'Interactive dental chart · FDI numbering · select a tooth to record its condition',
    actions: `<select class="select" id="odo-patient" style="width:200px">
        ${D.patients.map(x => `<option value="${x.id}" ${x.id === state.odoPatient ? 'selected' : ''}>${x.name} — ${x.id}</option>`).join('')}
      </select>
      <button class="btn" data-print>${icon('print')} ${t('print')}</button>
      <button class="btn btn--primary" data-toast="Dental chart saved to the patient record">${icon('check')} ${t('save')}</button>`
  }) + `
  <div class="grid g-wide">
    <div class="card">
      <div class="card__head">
        <div><h3>Permanent dentition</h3><p>32 teeth · upper and lower arch</p></div>
        <div class="right"><div class="cell-user">${avatar(p.name, 'sm')}
          <div><b>${p.name}</b><small>${p.id}</small></div></div></div>
      </div>
      <div class="card__body">
        <div class="odo">
          <div class="odo__arch">
            <div class="odo__quad">${quads.ur.map(n => tooth(n, true)).join('')}</div>
            <div class="odo__quad">${quads.ul.map(n => tooth(n, true)).join('')}</div>
          </div>
          <div class="odo__mid"></div>
          <div class="odo__arch">
            <div class="odo__quad">${quads.lr.map(n => tooth(n, false)).join('')}</div>
            <div class="odo__quad">${quads.ll.map(n => tooth(n, false)).join('')}</div>
          </div>
        </div>
        <hr class="divider mt-16 mb-16">
        <div class="odo__legend">
          ${Object.entries(TOOTH_STATE).map(([k, v]) => `<div>
            <i style="background:${v.fill};border-color:${v.stroke}"></i>${v.label}
            ${counts[k] ? `<b class="t-2xs">(${counts[k]})</b>` : ''}</div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${sel ? 'Tooth ' + sel : 'Tooth details'}</h3>
        <p>${sel ? TOOTH_STATE[selState].label : 'Nothing selected'}</p></div>
        ${sel ? `<div class="right">${chip(TOOTH_STATE[selState].label, selState === 'healthy' ? 'muted' : 'info')}</div>` : ''}</div>
      <div class="card__body">
        ${sel ? `
          <div class="field mb-16"><label for="tooth-state">Condition</label>
            <select class="select" id="tooth-state">
              ${Object.entries(TOOTH_STATE).map(([k, v]) => `<option value="${k}" ${k === selState ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select></div>
          <div class="field mb-16"><label>Clinical note</label>
            <textarea class="input" rows="3" placeholder="Observation for tooth ${sel}…"></textarea></div>
          <div class="eyebrow mb-8">Treatment history</div>
          ${history.length ? `<ul class="timeline">${history.map(x => `<li style="${tone('brand')}">
              <b>${x.name}</b><small>${x.started} · ${dentistById(x.dentist).name} · ${money(x.cost)}</small></li>`).join('')}</ul>`
            : '<p class="t-sm faint">No recorded treatment on this tooth.</p>'}
          <button class="btn btn--primary w-full mt-16" data-toast="Tooth ${sel} updated">${icon('check')} Apply changes</button>`
        : `<div class="empty">${icon('tooth')}
             <b class="t-sm fw-7" style="display:block;color:var(--text-2)">Select a tooth</b>
             <p>Click any tooth on the chart to view and edit its condition, notes and treatment history.</p></div>`}
        <div class="hint mt-16">${icon('shield')}
          <span>Every change is versioned in the clinical record with the practitioner's name and a timestamp.</span></div>
      </div>
    </div>
  </div>`;
};

/* ---------- X-ray ---------- */
V.xray = () => pageHead({
  title: t('xray'),
  sub: `${D.xrays.length} images stored · compare across a treatment timeline`,
  actions: `<button class="btn">${icon('filter')} ${t('filter')}</button>
            <button class="btn btn--primary" data-toast="Upload dialog opened">${icon('upload')} Upload X-ray</button>`
}) + `<div class="grid g-auto-sm">${D.xrays.map(x => xrayCard(x)).join('')}</div>`;

/* ---------- Prescriptions ---------- */
V.prescriptions = () => dataTable({
  title: t('prescriptions'),
  sub: `${D.prescriptions.filter(r => r.status === 'Active').length} active · allergy warnings shown inline`,
  actions: `<button class="btn" data-print>${icon('print')} ${t('print')}</button>
            <button class="btn btn--primary" data-toast="Prescription form opened">${icon('plus')} New prescription</button>`,
  toolbar: `${searchBox('Search prescriptions…')}
    <div class="segmented"><button class="on">${t('all')}</button><button>Active</button><button>Completed</button></div>`,
  head: ['ID', 'Patient', 'Medication', 'Prescribed by', 'Date', 'Duration', 'Status', { label: '', right: true }],
  count: D.prescriptions.length,
  rows: D.prescriptions.map(r => {
    const p = patientById(r.patient);
    return `<tr class="clickable" data-patient="${p.id}">
      <td class="num fw-7">${r.id}</td>
      <td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${p.name}</b>
        <small style="${p.allergy !== 'None' ? 'color:var(--danger)' : ''}">${p.allergy !== 'None' ? 'Allergy: ' + p.allergy : 'No allergies'}</small></div></div></td>
      <td>${r.items}</td><td>${dentistById(r.dentist).name}</td>
      <td class="num">${r.date}</td><td>${r.duration}</td><td>${chip(r.status)}</td>
      <td class="right">${rowBtns()}</td></tr>`;
  }).join('')
});

/* ---------- Lab requests ---------- */
V.labs = () => dataTable({
  title: t('labs'),
  sub: `${D.labs.filter(l => l.status !== 'Delivered').length} open requests with external laboratories`,
  actions: `<button class="btn btn--primary" data-toast="Lab request created">${icon('plus')} New lab request</button>`,
  toolbar: `${searchBox('Search lab requests…')}
    <div class="segmented"><button class="on">${t('all')}</button><button>Pending</button><button>In Progress</button><button>Delivered</button></div>`,
  head: ['Request', 'Patient', 'Item', 'Laboratory', 'Sent', 'Due', 'Cost', 'Status', { label: '', right: true }],
  count: D.labs.length,
  rows: D.labs.map(l => {
    const p = patientById(l.patient);
    const late = l.status !== 'Delivered' && l.due < TODAY;
    return `<tr class="clickable" data-patient="${p.id}">
      <td class="num fw-7">${l.id}</td>
      <td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${p.name}</b><small>${p.id}</small></div></div></td>
      <td><b class="fw-7">${l.item}</b></td><td>${l.lab}</td>
      <td class="num">${l.sent}</td>
      <td class="num" style="${late ? 'color:var(--danger);font-weight:700' : ''}">${l.due}</td>
      <td class="num fw-7">${money(l.cost)}</td><td>${chip(l.status)}</td>
      <td class="right">${rowBtns()}</td></tr>`;
  }).join('')
});

/* ---------- Invoices ---------- */
V.invoices = () => {
  const total = D.invoices.reduce((s, i) => s + i.total, 0);
  const paid = D.invoices.reduce((s, i) => s + i.paid, 0);
  const overdue = D.invoices.filter(i => i.status === 'Overdue');
  return `<div class="grid g-4 mb">
    ${statCard({ icon: 'invoice', label: 'Total invoiced', value: money(total), t: 'brand' })}
    ${statCard({ icon: 'check', label: 'Collected', value: money(paid), t: 'ok' })}
    ${statCard({ icon: 'clock', label: 'Outstanding', value: money(total - paid), t: 'warn' })}
    ${statCard({ icon: 'alert', label: 'Overdue', value: overdue.length + (overdue.length === 1 ? ' invoice' : ' invoices'), t: 'danger' })}
  </div>` + dataTable({
    title: t('invoices'),
    sub: 'Billing, insurance claims and receipts',
    actions: `<button class="btn">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="invoice">${icon('plus')} Create invoice</button>`,
    toolbar: `${searchBox('Search invoices…')}
      <div class="segmented"><button class="on">${t('all')}</button><button>Paid</button><button>Partial</button><button>Unpaid</button><button>Overdue</button></div>`,
    head: ['Invoice', 'Patient', 'Issued', 'Due', 'Items', 'Total', 'Paid', 'Method', 'Status', { label: '', right: true }],
    count: D.invoices.length,
    rows: D.invoices.map(v => {
      const p = patientById(v.patient);
      return `<tr class="clickable" data-patient="${p.id}">
        <td class="num fw-7">${v.id}</td>
        <td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${p.name}</b><small>${p.insurance}</small></div></div></td>
        <td class="num">${v.date}</td>
        <td class="num" style="${v.status === 'Overdue' ? 'color:var(--danger);font-weight:700' : ''}">${v.due}</td>
        <td class="num">${v.items}</td><td class="num fw-7">${money(v.total)}</td>
        <td class="num">${money(v.paid)}</td><td>${v.method}</td><td>${chip(v.status)}</td>
        <td class="right"><div class="row-actions">
          <button class="icon-btn" data-toast="Invoice ${v.id} preview">${icon('eye')}</button>
          <button class="icon-btn" data-print>${icon('print')}</button>
          <button class="icon-btn" data-toast="Receipt emailed to ${p.email}">${icon('mail')}</button></div></td></tr>`;
    }).join('')
  });
};

/* ---------- Payments ---------- */
V.payments = () => dataTable({
  title: t('payments'),
  sub: 'Cash, card, mobile money and insurance settlements',
  actions: `<button class="btn">${icon('download')} ${t('export')}</button>
            <button class="btn btn--primary" data-toast="Payment recorded">${icon('plus')} Record payment</button>`,
  toolbar: `${searchBox('Search payments…')}
    <div class="segmented"><button class="on">${t('all')}</button><button>Cash</button><button>Card</button><button>Mobile Money</button><button>Insurance</button></div>`,
  head: ['Payment', 'Invoice', 'Patient', 'Date', 'Method', 'Reference', 'Amount', 'Status', { label: '', right: true }],
  count: D.payments.length,
  rows: D.payments.map(v => {
    const p = patientById(v.patient);
    return `<tr class="clickable" data-patient="${p.id}">
      <td class="num fw-7">${v.id}</td><td class="num">${v.invoice}</td>
      <td><div class="cell-user">${avatar(p.name, 'sm')}<div><b>${p.name}</b><small>${p.id}</small></div></div></td>
      <td class="num">${v.date}</td><td>${v.method}</td><td class="num faint">${v.ref}</td>
      <td class="num fw-7">${money(v.amount)}</td><td>${chip(v.status)}</td>
      <td class="right">${rowBtns()}</td></tr>`;
  }).join('')
});

/* ---------- Inventory ---------- */
V.inventory = () => dataTable({
  title: t('inventory'),
  sub: `${D.inventory.length} items tracked · ${D.inventory.filter(i => i.stock < i.min).length} below minimum`,
  actions: `<button class="btn" data-toast="Purchase order drafted">${icon('download')} Purchase order</button>
            <button class="btn btn--primary" data-toast="Item form opened">${icon('plus')} Add item</button>`,
  toolbar: `${searchBox('Search inventory…')}
    <div class="segmented"><button class="on">${t('all')}</button><button>Low stock</button><button>Expiring</button></div>
    <select class="select" style="width:146px"><option>All suppliers</option><option>DentSupply</option><option>MediCore</option><option>SafeHands</option></select>`,
  head: ['Item', 'Category', 'Stock level', 'Minimum', 'Unit price', 'Supplier', 'Expiry', { label: '', right: true }],
  count: D.inventory.length,
  rows: D.inventory.map(i => {
    const pct = Math.min(100, (i.stock / (i.min * 2)) * 100);
    const low = i.stock < i.min;
    return `<tr>
      <td><b class="fw-7">${i.name}</b><div class="t-2xs faint num">${i.id}</div></td>
      <td>${chip(i.cat, 'muted')}</td>
      <td><div class="row sm"><span class="bar" style="width:70px">
        <i style="width:${pct}%;background:${low ? 'var(--danger)' : 'var(--ok)'}"></i></span>
        <b class="t-xs num" style="${low ? 'color:var(--danger)' : ''}">${i.stock} ${i.unit}</b></div></td>
      <td class="num">${i.min}</td><td class="num">${money(i.price)}</td>
      <td>${i.supplier}</td><td class="num">${i.expiry}</td>
      <td class="right">${low
        ? `<button class="btn btn--sm btn--primary" data-toast="Reorder sent to ${i.supplier}">Reorder</button>`
        : rowBtns()}</td></tr>`;
  }).join('')
});

/* ---------- Staff ---------- */
V.staff = () => dataTable({
  title: t('staff'),
  sub: `${D.staff.length} team members · roles, shifts and attendance`,
  actions: `<button class="btn btn--primary" data-modal="staff">${icon('plus')} Add staff</button>`,
  toolbar: `${searchBox('Search staff…')}
    <div class="segmented"><button class="on">${t('all')}</button><button>On Duty</button><button>Off Duty</button><button>Leave</button></div>`,
  head: ['Member', 'Role', 'Shift', 'Phone', 'Joined', 'Status', { label: '', right: true }],
  count: D.staff.length,
  rows: D.staff.map(s => `<tr>
    <td><div class="cell-user">${avatar(s.name)}<div><b>${s.name}</b><small>${s.id}</small></div></div></td>
    <td>${s.role}</td><td>${chip(s.shift, 'info')}</td>
    <td class="num">${s.phone}</td><td class="num">${s.joined}</td><td>${chip(s.status)}</td>
    <td class="right">${rowBtns()}</td></tr>`).join('')
});

/* ---------- Reports ---------- */
V.reports = () => {
  const rev = D.revenue.reduce((s, r) => s + r.v, 0);
  const exp = D.revenue.reduce((s, r) => s + r.exp, 0);
  const services = D.topServices;
  return pageHead({
    title: t('reports'),
    sub: 'Advanced analytics to grow your dental practice',
    actions: `<select class="select" style="width:158px"><option>Jan – Aug 2026</option><option>Last 12 months</option><option>2025</option></select>
              <button class="btn" data-print>${icon('print')} ${t('print')}</button>
              <button class="btn btn--primary" data-toast="Report exported as PDF">${icon('download')} ${t('export')} PDF</button>`
  }) + `
  <div class="grid g-4 mb">
    ${statCard({ icon: 'dollar', label: 'Gross revenue', value: money(rev), delta: 22, up: true, t: 'ok', spark: D.revenue.map(r => r.v) })}
    ${statCard({ icon: 'invoice', label: 'Expenses', value: money(exp), delta: 9, up: false, t: 'warn', spark: D.revenue.map(r => r.exp) })}
    ${statCard({ icon: 'trendUp', label: 'Net profit', value: money(rev - exp), delta: 31, up: true, t: 'brand', spark: D.revenue.map(r => r.v - r.exp) })}
    ${statCard({ icon: 'patients', label: 'New patients', value: '312', delta: 14, up: true, t: 'violet', spark: [28, 31, 36, 34, 42, 39, 48, 54] })}
  </div>

  <div class="grid g-mid mb">
    <div class="card">
      <div class="card__head"><div><h3>Revenue vs expenses</h3><p>Monthly comparison</p></div>
        <div class="right"><div class="chart-legend">
          <div><i style="background:var(--brand-500)"></i>Revenue</div>
          <div><i style="background:var(--warn)"></i>Expenses</div></div></div></div>
      <div class="card__body">
        <div class="row lg mb-16">
          <div><div class="eyebrow">Revenue</div><b class="t-lg fw-8">${money(rev)}</b></div>
          <div><div class="eyebrow">Expenses</div><b class="t-lg fw-8">${money(exp)}</b></div>
          <div><div class="eyebrow">Margin</div><b class="t-lg fw-8" style="color:var(--ok)">${Math.round((1 - exp / rev) * 100)}%</b></div>
        </div>
        ${chartHost('area', D.revenue, { h: 250, second: { key: 'exp', color: 'var(--warn)', label: 'Exp' } })}
      </div>
    </div>
    <div class="card">
      <div class="card__head"><div><h3>${t('card.services')}</h3><p>By volume and revenue</p></div></div>
      <div class="card__body">
        ${Chart.ranked(services)}
        <div class="row mt-16" style="gap:8px">
          <div class="tile"><span class="eyebrow">Procedures</span><b>${services.reduce((s, x) => s + x.count, 0)}</b></div>
          <div class="tile"><span class="eyebrow">Revenue</span><b>${compact(services.reduce((s, x) => s + x.revenue, 0))}</b></div>
          <div class="tile"><span class="eyebrow">Avg ticket</span><b>${money(Math.round(services.reduce((s, x) => s + x.revenue, 0) / services.reduce((s, x) => s + x.count, 0)))}</b></div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-3">
    <div class="card">
      <div class="card__head"><div><h3>Patient demographics</h3><p>Age distribution</p></div></div>
      <div class="card__body">
        ${chartHost('bars', [{ d: '0-17', v: 84 }, { d: '18-29', v: 156 }, { d: '30-44', v: 212 },
                             { d: '45-59', v: 128 }, { d: '60+', v: 67 }], { h: 186, color: '#7455d8' })}
        <div class="mt-12">
          ${[['Female', 58, 'var(--pink)'], ['Male', 42, 'var(--brand-500)']].map(([l, v, c]) => `
            <div class="kpi"><div class="row between t-xs fw-7 mb-8"><span>${l}</span><span class="num">${v}%</span></div>
              <span class="bar"><i style="width:${v}%;background:${c}"></i></span></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>Payment methods</h3><p>Share of collections</p></div></div>
      <div class="card__body"><div class="donut-wrap">
        ${Chart.donut([
          { label: 'Mobile Money', value: 38, color: '#0f9d6f' },
          { label: 'Cash', value: 26, color: '#2f6bf0' },
          { label: 'Insurance', value: 24, color: '#7455d8' },
          { label: 'Card', value: 12, color: '#c2820b' }
        ], { size: 150, centerTop: '$301K', centerSub: 'Collected' })}
        <div class="chart-legend">
          <div><i style="background:#0f9d6f"></i>Mobile Money<b>38%</b></div>
          <div><i style="background:#2f6bf0"></i>Cash<b>26%</b></div>
          <div><i style="background:#7455d8"></i>Insurance<b>24%</b></div>
          <div><i style="background:#c2820b"></i>Card<b>12%</b></div>
        </div></div></div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>Clinic KPIs</h3><p>This month</p></div></div>
      <div class="card__body">
        ${[['Chair utilisation', 78, 'var(--brand-500)'], ['Appointment show-rate', 91, 'var(--ok)'],
           ['Treatment acceptance', 64, 'var(--violet)'], ['Recall compliance', 55, 'var(--warn)'],
           ['Collection rate', 86, 'var(--teal)']].map(([l, v, c]) => `
          <div class="kpi"><div class="row between t-sm fw-7 mb-8"><span>${l}</span><span class="num">${v}%</span></div>
            <span class="bar"><i style="width:${v}%;background:${c}"></i></span></div>`).join('')}
      </div>
    </div>
  </div>`;
};

/* ---------- Settings ---------- */
V.settings = () => {
  const tabs = { clinic: 'Clinic profile', notif: 'Notifications', security: 'Security & backup', billing: 'Billing', appearance: 'Appearance' };
  const sw = (key, title, desc) => `
    <div class="switch-row"><div class="txt"><b>${title}</b><small>${desc}</small></div>
      <div class="switch ${state.switches[key] ? 'on' : ''}" data-switch="${key}" role="switch"
        aria-checked="${!!state.switches[key]}" tabindex="0"></div></div>`;

  const panes = {
    clinic: `<div class="form-grid">
        <div class="field"><label>Clinic name</label><input class="input" value="DentalFlow Clinic — Hargeisa"></div>
        <div class="field"><label>License number</label><input class="input" value="SL-DENT-2026-0198"></div>
        <div class="field"><label>Phone</label><input class="input" value="+252 63 4455000"></div>
        <div class="field"><label>Email</label><input class="input" value="info@dentalflow.so"></div>
        <div class="field full"><label>Address</label><input class="input" value="Road No. 1, Hargeisa, Somaliland"></div>
        <div class="field"><label>Currency</label><select class="select"><option>USD ($)</option><option>SLSH</option></select></div>
        <div class="field"><label>Time zone</label><select class="select"><option>EAT (UTC+3)</option><option>UTC</option></select></div>
        <div class="field"><label>Working hours</label><input class="input" value="08:00 — 18:00"></div>
        <div class="field"><label>Working days</label><input class="input" value="Saturday — Thursday"></div>
      </div>`,
    notif: sw('sms', 'SMS reminders', 'Send an SMS 24 hours before each appointment.')
         + sw('email', 'Email notifications', 'Invoices, receipts and treatment summaries by email.')
         + sw('reminders', 'Recall reminders', 'Automatic six-month check-up recalls for every patient.')
         + `<div class="hint mt-16">${icon('chat')}<span>Reminder templates exist in Somali and English — each patient receives messages in their preferred language.</span></div>`,
    security: sw('twofa', 'Two-factor authentication', 'Require a one-time code for admin accounts.')
            + sw('backup', 'Daily automatic backup', 'Encrypted backup every night at 02:00 EAT.')
            + sw('portal', 'Patient portal access', 'Let patients view appointments and invoices online.')
            + `<div class="hint mt-16">${icon('shield')}<span>Last backup completed 11 Aug 2026 at 02:00 · 412 MB · integrity verified.</span></div>`,
    billing: `<div class="form-grid">
        <div class="field"><label>Tax rate (%)</label><input class="input" value="5"></div>
        <div class="field"><label>Invoice prefix</label><input class="input" value="INV-"></div>
        <div class="field"><label>Payment terms</label><select class="select"><option>Due in 14 days</option><option>Due on receipt</option></select></div>
        <div class="field"><label>Default method</label><select class="select"><option>Mobile Money</option><option>Cash</option><option>Card</option></select></div>
        <div class="field full"><label>Insurance providers</label><input class="input" value="MedPlus, Takaful Health, SomCare"></div>
      </div>`,
    appearance: `
      <div class="switch-row"><div class="txt"><b>Dark mode</b><small>Switch the workspace to a dark palette.</small></div>
        <div class="switch ${state.theme === 'dark' ? 'on' : ''}" id="sw-theme" role="switch" tabindex="0"></div></div>
      <div class="switch-row"><div class="txt"><b>Compact sidebar</b><small>Show icons only to gain screen width.</small></div>
        <div class="switch ${state.mini ? 'on' : ''}" id="sw-mini" role="switch" tabindex="0"></div></div>
      <div class="switch-row"><div class="txt"><b>Interface language</b><small>English or Somali across the whole system.</small></div>
        <div class="seg-toggle ml-auto">
          <button class="${LANG === 'en' ? 'on' : ''}" data-lang="en">EN</button>
          <button class="${LANG === 'so' ? 'on' : ''}" data-lang="so">SO</button></div></div>`
  };

  return pageHead({
    title: t('settings'),
    sub: 'Configure the clinic, notifications, security and billing',
    actions: `<button class="btn btn--primary" data-toast="Settings saved">${icon('check')} ${t('save')}</button>`
  }) + `
  <div class="settings-grid">
    <div class="card"><div class="card__body" style="padding:10px">
      <div class="settings-nav">
        ${Object.entries(tabs).map(([k, v]) => `<button class="${state.settingsTab === k ? 'on' : ''}" data-stab="${k}">${v}</button>`).join('')}
      </div></div></div>
    <div class="card">
      <div class="card__head"><div><h3>${tabs[state.settingsTab]}</h3><p>Changes apply to the whole clinic</p></div></div>
      <div class="card__body">${panes[state.settingsTab]}</div>
      <div class="card__foot"><span class="t-xs faint">Last edited 11 Aug 2026 by Dr. Ayesha Khan</span>
        <button class="btn btn--sm btn--primary ml-auto" data-toast="Settings saved">${t('save')}</button></div>
    </div>
  </div>`;
};

/* ------------------------------------------------------------
   Modals
   ------------------------------------------------------------ */
const MODALS = {
  patient: () => ({
    title: 'Register new patient',
    body: `<div class="form-grid">
      <div class="field"><label>Full name</label><input class="input" placeholder="e.g. Ayaan Mohamed"></div>
      <div class="field"><label>Phone</label><input class="input" placeholder="+252 …"></div>
      <div class="field"><label>Date of birth</label><input class="input" type="date"></div>
      <div class="field"><label>Gender</label><select class="select"><option>Female</option><option>Male</option></select></div>
      <div class="field"><label>City</label><select class="select"><option>Hargeisa</option><option>Gabiley</option><option>Berbera</option><option>Borama</option></select></div>
      <div class="field"><label>Blood group</label><select class="select"><option>O+</option><option>O-</option><option>A+</option><option>B+</option><option>AB+</option></select></div>
      <div class="field full"><label>Email</label><input class="input" placeholder="name@mail.com"></div>
      <div class="field full"><label>Allergies / medical notes</label>
        <textarea class="input" rows="2" placeholder="Penicillin, latex…"></textarea>
        <span class="help">Shown as a warning before any prescription is issued.</span></div>
      <div class="field"><label>Insurance</label><select class="select"><option>None</option><option>MedPlus</option><option>Takaful</option></select></div>
      <div class="field"><label>Assigned dentist</label><select class="select">${D.dentists.map(d => `<option>${d.name}</option>`).join('')}</select></div>
    </div>`, ok: 'Register patient', toast: 'New patient registered'
  }),
  appointment: () => ({
    title: 'Book appointment',
    body: `<div class="form-grid">
      <div class="field full"><label>Patient</label><select class="select">${D.patients.map(p => `<option>${p.name} — ${p.id}</option>`).join('')}</select></div>
      <div class="field"><label>Date</label><input class="input" type="date" value="2026-08-12"></div>
      <div class="field"><label>Time</label><input class="input" type="time" value="10:30"></div>
      <div class="field"><label>Dentist</label><select class="select">${D.dentists.map(d => `<option>${d.name}</option>`).join('')}</select></div>
      <div class="field"><label>Chair</label><select class="select">${D.chairs.map(c => `<option ${c.status !== 'Available' ? 'disabled' : ''}>${c.id}${c.status !== 'Available' ? ' — ' + c.status : ''}</option>`).join('')}</select></div>
      <div class="field"><label>Treatment</label><select class="select"><option>Consultation</option><option>Teeth Cleaning</option><option>Dental Filling</option><option>Root Canal</option><option>Extraction</option><option>Whitening</option></select></div>
      <div class="field"><label>Duration</label><select class="select"><option>20 min</option><option selected>30 min</option><option>45 min</option><option>60 min</option><option>90 min</option></select></div>
      <div class="field full"><label>Note</label><textarea class="input" rows="2" placeholder="Reason for visit…"></textarea></div>
      <div class="full"><div class="hint">${icon('chat')}<span>An SMS reminder in the patient's language is sent 24 hours beforehand.</span></div></div>
    </div>`, ok: 'Confirm booking', toast: 'Appointment booked · reminder scheduled'
  }),
  treatment: () => ({
    title: 'New treatment plan',
    body: `<div class="form-grid">
      <div class="field full"><label>Patient</label><select class="select">${D.patients.map(p => `<option>${p.name} — ${p.id}</option>`).join('')}</select></div>
      <div class="field"><label>Treatment</label><select class="select"><option>Root Canal Therapy</option><option>Composite Filling</option><option>Crown</option><option>Implant</option><option>Braces</option></select></div>
      <div class="field"><label>Tooth (FDI)</label><input class="input" placeholder="e.g. 26"></div>
      <div class="field"><label>Sessions</label><input class="input" type="number" value="3"></div>
      <div class="field"><label>Estimated cost</label><input class="input" value="$320"></div>
      <div class="field full"><label>Plan notes</label><textarea class="input" rows="3"></textarea></div>
    </div>`, ok: 'Create plan', toast: 'Treatment plan created'
  }),
  invoice: () => ({
    title: 'Create invoice',
    body: `<div class="form-grid">
      <div class="field full"><label>Patient</label><select class="select">${D.patients.map(p => `<option>${p.name} — ${p.id}</option>`).join('')}</select></div>
      <div class="field"><label>Issue date</label><input class="input" type="date" value="2026-08-11"></div>
      <div class="field"><label>Due date</label><input class="input" type="date" value="2026-08-25"></div>
      <div class="field full"><label>Line items</label>
        <div style="border:1px solid var(--line);border-radius:var(--r-sm);overflow:hidden">
          <table class="tbl" style="min-width:0"><thead><tr><th>Service</th><th>Qty</th><th class="right">Price</th></tr></thead>
          <tbody><tr><td>Root Canal — session 3</td><td class="num">1</td><td class="num right">$160</td></tr>
          <tr><td>Periapical X-ray</td><td class="num">2</td><td class="num right">$40</td></tr></tbody></table>
        </div></div>
      <div class="field"><label>Payment method</label><select class="select"><option>Mobile Money</option><option>Cash</option><option>Card</option><option>Insurance</option></select></div>
      <div class="field"><label>Tax (5%)</label><input class="input" value="$10" disabled></div>
    </div>`, ok: 'Generate invoice', toast: 'Invoice generated and sent'
  }),
  staff: () => ({
    title: 'Add team member',
    body: `<div class="form-grid">
      <div class="field"><label>Full name</label><input class="input"></div>
      <div class="field"><label>Role</label><select class="select"><option>Dentist</option><option>Dental Assistant</option><option>Receptionist</option><option>Lab Technician</option><option>Accountant</option></select></div>
      <div class="field"><label>Phone</label><input class="input"></div>
      <div class="field"><label>Shift</label><select class="select"><option>Morning</option><option>Evening</option><option>Full Day</option></select></div>
      <div class="field full"><label>System permissions</label><select class="select"><option>Standard user</option><option>Clinic admin</option><option>Read only</option></select></div>
    </div>`, ok: 'Add member', toast: 'Team member added'
  })
};

function openModal(kind) {
  const m = MODALS[kind]();
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal ${kind === 'invoice' ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal__head"><h3>${m.title}</h3>
      <button class="icon-btn ml-auto" data-close title="Close">${icon('x')}</button></div>
    <div class="modal__body">${m.body}</div>
    <div class="modal__foot">
      <button class="btn" data-close>${t('cancel')}</button>
      <button class="btn btn--primary" data-ok>${icon('check')} ${m.ok}</button></div></div>`;
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-close]')) el.remove();
    if (e.target.closest('[data-ok]')) { el.remove(); toast(m.toast); }
  });
  document.body.appendChild(el);
  el.querySelector('input,select,textarea')?.focus();
}

/* ------------------------------------------------------------
   Command palette
   ------------------------------------------------------------ */
let cmdkIndex = 0;
function cmdkItems(q) {
  q = q.trim().toLowerCase();
  const views = NAV.flatMap(g => g.items).map(i => ({
    group: 'Modules', label: t(i.key), icon: i.icon, go: () => go(i.key)
  }));
  const people = D.patients.map(p => ({
    group: 'Patients', label: p.name, sub: `${p.id} · ${p.city}`, icon: 'user',
    go: () => go('patient', p.id)
  }));
  const actions = [
    { group: 'Actions', label: 'New appointment', icon: 'plus', go: () => openModal('appointment') },
    { group: 'Actions', label: 'Register patient', icon: 'plus', go: () => openModal('patient') },
    { group: 'Actions', label: 'Create invoice', icon: 'plus', go: () => openModal('invoice') },
    { group: 'Actions', label: 'Toggle dark mode', icon: 'moon', go: () => toggleTheme() }
  ];
  return [...views, ...actions, ...people]
    .filter(i => !q || (i.label + (i.sub || '')).toLowerCase().includes(q))
    .slice(0, 9);
}

function renderCmdkList(root, q) {
  const items = cmdkItems(q);
  cmdkIndex = Math.min(cmdkIndex, Math.max(items.length - 1, 0));
  let last = '';
  root.querySelector('.cmdk__list').innerHTML = items.length ? items.map((i, n) => {
    const head = i.group !== last ? `<div class="cmdk__group eyebrow">${i.group}</div>` : '';
    last = i.group;
    return `${head}<div class="cmdk__item ${n === cmdkIndex ? 'on' : ''}" data-cmdk="${n}">
      ${icon(i.icon)}<span>${i.label}</span>
      ${i.sub ? `<span class="hintk">${i.sub}</span>` : ''}</div>`;
  }).join('') : `<div class="empty" style="padding:28px">${icon('search')}<p>${t('noResults')}</p></div>`;
  return items;
}

function openCmdk() {
  if ($('.cmdk-backdrop')) return;
  cmdkIndex = 0;
  const el = document.createElement('div');
  el.className = 'cmdk-backdrop';
  el.innerHTML = `<div class="cmdk" role="dialog" aria-modal="true">
    <div class="cmdk__input">${icon('search')}
      <input placeholder="Search modules, patients or actions…" autocomplete="off">
      <kbd class="kbd">ESC</kbd></div>
    <div class="cmdk__list"></div></div>`;
  document.body.appendChild(el);
  const input = el.querySelector('input');
  let items = renderCmdkList(el, '');
  input.focus();

  input.addEventListener('input', () => { cmdkIndex = 0; items = renderCmdkList(el, input.value); });
  el.addEventListener('click', e => {
    if (e.target === el) return el.remove();
    const it = e.target.closest('[data-cmdk]');
    if (it) { el.remove(); items[+it.dataset.cmdk].go(); }
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') return el.remove();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      cmdkIndex = (cmdkIndex + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      renderCmdkList(el, input.value);
    }
    if (e.key === 'Enter' && items[cmdkIndex]) { el.remove(); items[cmdkIndex].go(); }
  });
}

/* ------------------------------------------------------------
   Toast & chart tooltip
   ------------------------------------------------------------ */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="ic">${icon('check')}</span><span>${msg}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = '.25s'; el.style.opacity = '0'; el.style.transform = 'translateX(16px)'; }, 2500);
  setTimeout(() => el.remove(), 2820);
}

const tip = document.createElement('div');
tip.className = 'chart-tip';
document.body.appendChild(tip);
document.addEventListener('mousemove', e => {
  const host = e.target.closest ? e.target.closest('[data-tip]') : null;
  if (!host) { tip.classList.remove('on'); return; }
  tip.textContent = host.dataset.tip;
  tip.classList.add('on');
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(e.clientX + 14, window.innerWidth - r.width - 10) + 'px';
  tip.style.top = Math.max(e.clientY - r.height - 10, 8) + 'px';
});

/* ------------------------------------------------------------
   Render & routing
   ------------------------------------------------------------ */
function render() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.body.classList.toggle('mini', state.mini);
  CHART_QUEUE = [];
  renderSidebar();
  renderTopbar();
  $('#view').innerHTML = (V[state.view] || V.dashboard)();
  mountCharts();
}

function go(view, param = null) {
  if (!V[view]) return;
  state.view = view;
  state.param = param;
  state.query = '';
  state.tab = 'overview';
  document.body.classList.remove('drawer');
  location.hash = param ? `${view}/${param}` : view;
  render();
  window.scrollTo({ top: 0 });
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('df_theme', state.theme);
  render();
}
function toggleMini() {
  state.mini = !state.mini;
  localStorage.setItem('df_mini', state.mini ? '1' : '0');
  render();
}

/* ------------------------------------------------------------
   Events
   ------------------------------------------------------------ */
document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return go(nav.dataset.nav);

  const pat = e.target.closest('[data-patient]');
  if (pat && !e.target.closest('[data-toast],[data-modal],[data-print]')) return go('patient', pat.dataset.patient);

  if (e.target.closest('#btn-menu')) {
    return window.innerWidth <= 1080 ? document.body.classList.toggle('drawer') : toggleMini();
  }
  if (e.target.closest('#btn-cmdk')) return openCmdk();
  if (e.target.closest('#btn-theme') || e.target.closest('#sw-theme')) return toggleTheme();
  if (e.target.closest('#sw-mini')) return toggleMini();

  const lang = e.target.closest('[data-lang]');
  if (lang) { LANG = lang.dataset.lang; localStorage.setItem('df_lang', LANG); return render(); }

  const tab = e.target.closest('[data-tab]');
  if (tab) { state.tab = tab.dataset.tab; return render(); }

  const stab = e.target.closest('[data-stab]');
  if (stab) { state.settingsTab = stab.dataset.stab; return render(); }

  const sw = e.target.closest('[data-switch]');
  if (sw) { state.switches[sw.dataset.switch] = !state.switches[sw.dataset.switch]; return render(); }

  const th = e.target.closest('[data-tooth]');
  if (th) { state.selectedTooth = th.dataset.tooth === state.selectedTooth ? null : th.dataset.tooth; return render(); }

  const modal = e.target.closest('[data-modal]');
  if (modal) return openModal(modal.dataset.modal);

  if (e.target.closest('[data-print]')) return window.print();

  const seg = e.target.closest('.segmented button, .pager button');
  if (seg && !seg.querySelector('svg')) {
    seg.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on'));
    seg.classList.add('on');
    return;
  }

  const tst = e.target.closest('[data-toast]');
  if (tst) return toast(tst.dataset.toast);
});

/* Enter/Space activates the custom interactive elements */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); return openCmdk(); }
  if (e.key === 'Escape') { $('.modal-backdrop')?.remove(); $('.cmdk-backdrop')?.remove(); }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[tabindex="0"]')) {
    e.preventDefault(); e.target.click();
  }
});

document.addEventListener('input', e => {
  if (!e.target.hasAttribute('data-search')) return;
  state.query = e.target.value;
  const pos = e.target.selectionStart;
  render();
  const box = $('[data-search]');
  if (box) { box.focus(); box.setSelectionRange(pos, pos); }
});

document.addEventListener('change', e => {
  if (e.target.id === 'tooth-state' && state.selectedTooth) {
    state.teeth[state.selectedTooth] = e.target.value;
    render();
    toast(`Tooth ${state.selectedTooth} set to ${TOOTH_STATE[e.target.value].label}`);
  }
  if (e.target.id === 'odo-patient') {
    state.odoPatient = e.target.value;
    state.selectedTooth = null;
    render();
  }
});

/* Charts are drawn at pixel size, so redraw them when the layout changes */
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(render, 180);
});

window.addEventListener('hashchange', () => {
  const [v, p] = location.hash.slice(1).split('/');
  if (v && V[v] && (v !== state.view || p !== state.param)) {
    state.view = v; state.param = p || null; render();
  }
});

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
const [bootView, bootParam] = location.hash.slice(1).split('/');
if (bootView && V[bootView]) { state.view = bootView; state.param = bootParam || null; }
render();
