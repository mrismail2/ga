/* ============================================================
   DentalFlow Pro — application shell, router and views
   ============================================================ */

const D = DF_DATA;
const $ = s => document.querySelector(s);

const state = {
  view: 'dashboard',
  theme: localStorage.getItem('df_theme') || 'light',
  mini: localStorage.getItem('df_mini') === '1',
  query: '',
  filters: {},
  selectedTooth: null,
  teeth: { ...D.toothStates },
  settingsTab: 'clinic',
  switches: { sms: true, email: true, backup: true, reminders: true, twofa: false, portal: true }
};

/* -------- lookups -------- */
const patientById = id => D.patients.find(p => p.id === id) || { name: '—', color: '#94a3b8', avatar: '?' };
const dentistById = id => D.dentists.find(d => d.id === id) || { name: 'Unassigned', color: '#94a3b8' };

/* -------- navigation model -------- */
const NAV = [
  { group: 'nav.main', items: [
    { key: 'dashboard', icon: 'dashboard' },
    { key: 'patients', icon: 'patients', badge: D.patients.length },
    { key: 'dentists', icon: 'dentist' },
    { key: 'appointments', icon: 'calendar', badge: D.appointments.filter(a => a.date === '2026-08-11').length },
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

/* ============================================================
   Shell
   ============================================================ */
function renderSidebar() {
  const me = D.dentists[0];
  $('#sidebar').innerHTML = `
    <div class="brand">
      <div class="brand__mark">${icon('tooth')}</div>
      <div class="brand__text">Dental<span>Flow</span></div>
      <span class="brand__pro">Pro</span>
    </div>
    <nav class="nav">
      ${NAV.map(g => `
        <div class="nav__label">${t(g.group)}</div>
        ${g.items.map(it => `
          <div class="nav__item ${state.view === it.key ? 'active' : ''}" data-nav="${it.key}" title="${t(it.key)}">
            ${icon(it.icon)}<span>${t(it.key)}</span>
            ${it.badge ? `<span class="nav__badge">${it.badge}</span>` : ''}
          </div>`).join('')}
      `).join('')}
    </nav>
    <div class="sidebar__user">
      ${avatar(me.name, me.color)}
      <div class="who"><b>${me.name}</b><small>${me.role}</small></div>
      <span class="dot-online"></span>
    </div>`;
}

function renderTopbar() {
  const me = D.dentists[0];
  $('#topbar').innerHTML = `
    <button class="icon-btn" id="btn-menu" aria-label="Toggle menu">${icon('menu')}</button>
    <div class="search">${icon('search')}
      <input id="global-search" placeholder="${t('search')}" value="${state.query}">
    </div>
    <div class="topbar__right">
      <div class="lang-toggle">
        <button class="${LANG === 'en' ? 'on' : ''}" data-lang="en">EN</button>
        <button class="${LANG === 'so' ? 'on' : ''}" data-lang="so">SO</button>
      </div>
      <button class="icon-btn" id="btn-theme" aria-label="Theme">${icon(state.theme === 'dark' ? 'sun' : 'moon')}</button>
      <button class="icon-btn" aria-label="Messages">${icon('chat')}<span class="dot">3</span></button>
      <button class="icon-btn" aria-label="Notifications">${icon('bell')}<span class="dot">5</span></button>
      <div class="topbar__user">
        ${avatar(me.name, me.color, 'sm')}
        <div class="who"><b>${me.name.replace('Dr. ', 'Dr. ')}</b><small>${me.spec}</small></div>
      </div>
    </div>`;
}

/* ============================================================
   Views
   ============================================================ */
const V = {};

/* ---------- Dashboard ---------- */
V.dashboard = () => {
  const today = D.appointments.filter(a => a.date === '2026-08-11');
  const stats = [
    { icon: 'calendar', label: t('stat.appts'), value: 32, delta: 15, up: true, accent: 'var(--brand-500)' },
    { icon: 'patients', label: t('stat.patients'), value: 24, delta: 12, up: true, accent: 'var(--cyan-500)' },
    { icon: 'dollar', label: t('stat.revenue'), value: money(5670), delta: 18, up: true, accent: 'var(--ok)' },
    { icon: 'clock', label: t('stat.pending'), value: 18, delta: 8, up: false, accent: 'var(--warn)' }
  ];
  const lowStock = D.inventory.filter(i => i.stock < i.min);

  return `
  <div class="page__head">
    <div>
      <h1>${t('greeting')}, ${D.dentists[0].name} 👋</h1>
      <p>${t('dash.sub')}</p>
    </div>
    <div class="actions">
      <button class="btn" data-print>${icon('print')} ${t('print')}</button>
      <button class="btn" data-toast="Report exported as CSV">${icon('download')} ${t('export')}</button>
      <button class="btn btn--primary" data-modal="appointment">${icon('plus')} ${t('newAppt')}</button>
    </div>
  </div>

  <div class="grid stats mb">
    ${stats.map(s => `
      <div class="stat" style="--accent:${s.accent}">
        <div class="stat__top">
          <div class="stat__icon">${icon(s.icon)}</div>
          <div><div class="stat__label">${s.label}</div>
            <div class="stat__value">${s.value}</div></div>
        </div>
        <div class="stat__foot">
          <span class="delta ${s.up ? 'up' : 'down'}">${icon(s.up ? 'trendUp' : 'trendDown')}${s.delta}%</span>
          ${t('vsYesterday')}
        </div>
      </div>`).join('')}
  </div>

  <div class="grid g-wide mb">
    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.revenue')}</h3><p>January – August 2026</p></div>
        <div class="right">
          <span class="chip chip--ok"><i></i>+20.5%</span>
          <select class="select btn--sm" style="height:32px">
            <option>2026</option><option>2025</option>
          </select>
        </div>
      </div>
      <div class="card__body">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:6px">
          <span style="font-size:26px;font-weight:800;letter-spacing:-1px">$48,750</span>
          <span class="muted" style="font-size:12.4px">August total revenue</span>
        </div>
        ${Chart.area(D.revenue, { color: '#2563eb', color2: '#22d3ee' })}
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${t('card.mix')}</h3><p>Last 30 days</p></div></div>
      <div class="card__body">
        <div class="donut-wrap">
          ${Chart.donut(D.treatmentMix, { centerTop: '128', centerSub: 'Total' })}
          <div class="chart-legend">
            ${D.treatmentMix.map(s => `<div><i style="background:${s.color}"></i>${s.label}<b>${s.value}</b></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-mid mb">
    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.upcoming')}</h3><p>Tuesday, 11 August 2026</p></div>
        <div class="right"><button class="btn btn--sm btn--ghost" data-nav="appointments">${t('viewAll')}</button></div>
      </div>
      <div class="card__body flush">
        ${today.slice(0, 6).map(a => {
          const p = patientById(a.patient), d = dentistById(a.dentist);
          return `<div class="appt">
            <div class="appt__time">${a.time}</div>
            ${avatar(p.name, p.color, 'sm')}
            <div class="appt__main"><b>${p.name}</b><small>${a.type} · ${d.name} · ${a.chair}</small></div>
            ${chip(a.status)}
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card__head">
        <div><h3>${t('card.chairs')}</h3><p>${D.chairs.filter(c => c.status === 'Available').length} of ${D.chairs.length} available</p></div>
        <div class="right"><button class="btn btn--sm btn--ghost" data-nav="chairs">${t('viewAll')}</button></div>
      </div>
      <div class="card__body">
        <div class="grid g-2" style="gap:11px">
          ${D.chairs.map(c => {
            const col = c.status === 'Available' ? 'var(--ok)' : c.status === 'In Use' ? 'var(--brand-500)' : 'var(--warn)';
            const d = c.dentist ? dentistById(c.dentist) : null;
            return `<div class="chair" style="--c:${col}">
              <div class="chair__bar"></div>
              <h4>${c.id}</h4><small>${c.status === 'In Use' ? 'Since ' + c.since : 'Next ' + c.next}</small>
              ${chip(c.status)}
              <div class="chair__who">${d ? avatar(d.name, d.color, 'sm') + `<small>${d.name}</small>` : '<small class="muted">Unassigned</small>'}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-3">
    <div class="card">
      <div class="card__head"><div><h3>${t('card.week')}</h3><p>Patients per day</p></div></div>
      <div class="card__body">
        ${Chart.bars(D.weekLoad)}
        <div style="display:flex;gap:10px;margin-top:14px">
          ${[['Total', D.weekLoad.reduce((s, w) => s + w.v, 0)],
             ['Daily avg', Math.round(D.weekLoad.reduce((s, w) => s + w.v, 0) / 7)],
             ['Busiest', 'Thu · 35']].map(([l, v]) => `
            <div style="flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:10px 12px">
              <small class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${l}</small>
              <div style="font-size:17px;font-weight:800;letter-spacing:-.4px">${v}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${t('card.activity')}</h3><p>Live clinic feed</p></div></div>
      <div class="card__body flush">
        <ul class="activity">
          ${D.activity.map(a => `<li>
            <span class="ic" style="background:${a.color}1f;color:${a.color}">${icon(a.icon)}</span>
            <div><p>${a.text}</p><small>${a.time}</small></div>
          </li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${t('card.stock')}</h3><p>${lowStock.length} items below minimum</p></div>
        <div class="right"><button class="btn btn--sm btn--ghost" data-nav="inventory">${t('viewAll')}</button></div></div>
      <div class="card__body">
        ${lowStock.map(i => `
          <div style="display:flex;align-items:center;gap:11px;padding:9px 0;border-bottom:1px solid var(--line)">
            <span class="ic" style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--warn-soft);color:var(--warn)">${icon('alert')}</span>
            <div style="min-width:0;flex:1"><b style="font-size:12.9px;display:block">${i.name}</b>
              <small class="muted" style="font-size:11.4px">${i.stock} ${i.unit}s left · min ${i.min}</small></div>
            <button class="btn btn--sm" data-toast="Reorder request sent to ${i.supplier}">Reorder</button>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
};

/* ---------- generic table page ---------- */
function tablePage({ title, sub, actions = '', toolbar = '', head, rows, count }) {
  return `
  <div class="page__head">
    <div><h1>${title}</h1><p>${sub}</p></div>
    <div class="actions">${actions}</div>
  </div>
  <div class="card">
    ${toolbar ? `<div class="toolbar">${toolbar}</div>` : ''}
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>${head.map(h => `<th${h.right ? ' style="text-align:right"' : ''}>${h.label || h}</th>`).join('')}</tr></thead>
        <tbody>${rows || ''}</tbody>
      </table>
      ${!rows ? `<div class="empty">${icon('search')}<p>${t('noResults')}</p></div>` : ''}
    </div>
    <div class="toolbar" style="border-bottom:none;border-top:1px solid var(--line);justify-content:space-between">
      <span class="muted" style="font-size:12.4px">Showing <b>${count}</b> records</span>
      <div style="display:flex;gap:6px">
        <button class="btn btn--sm">${icon('chevronLeft')}</button>
        <button class="btn btn--sm btn--primary">1</button>
        <button class="btn btn--sm">2</button>
        <button class="btn btn--sm">${icon('chevronRight')}</button>
      </div>
    </div>
  </div>`;
}

const searchBox = ph => `<div class="search-inline">${icon('search')}<input placeholder="${ph}" data-search></div>`;
const rowBtns = () => `<div class="row-actions">
  <button class="icon-btn" data-toast="Opening record…">${icon('eye')}</button>
  <button class="icon-btn" data-toast="Edit mode enabled">${icon('edit')}</button>
  <button class="icon-btn" data-toast="Delete requires admin approval">${icon('trash')}</button></div>`;

/* ---------- Patients ---------- */
V.patients = () => {
  const q = state.query.toLowerCase();
  const list = D.patients.filter(p => !q || (p.name + p.id + p.phone + p.city).toLowerCase().includes(q));
  return tablePage({
    title: t('patients'), sub: `${D.patients.length} registered patients · ${D.patients.filter(p => p.status === 'Active').length} active`,
    actions: `<button class="btn">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="patient">${icon('plus')} ${t('newPatient')}</button>`,
    toolbar: `${searchBox('Search by name, ID, phone…')}
      <div class="segmented">
        <button class="on">${t('all')}</button><button>Active</button><button>New</button><button>Inactive</button>
      </div>
      <select class="select btn--sm" style="height:38px"><option>All cities</option><option>Hargeisa</option><option>Gabiley</option><option>Berbera</option></select>
      <button class="btn" style="margin-left:auto">${icon('filter')} ${t('filter')}</button>`,
    head: ['Patient', 'Contact', 'Age / Gender', 'Insurance', 'Last Visit', 'Balance', 'Status', { label: 'Actions', right: true }],
    count: list.length,
    rows: list.map(p => `<tr>
      <td><div class="cell-user">${avatar(p.name, p.color)}<div><b>${p.name}</b><small>${p.id} · ${p.city}</small></div></div></td>
      <td><div style="font-size:12.7px">${p.phone}</div><small class="muted">${p.email}</small></td>
      <td>${p.age} · ${p.gender}</td>
      <td>${p.insurance === 'None' ? '<span class="muted">—</span>' : chip(p.insurance, 'info')}</td>
      <td class="mono">${p.lastVisit}</td>
      <td class="mono" style="color:${p.balance > 0 ? 'var(--danger)' : 'var(--text-3)'}">${p.balance ? money(p.balance) : '—'}</td>
      <td>${chip(p.status)}</td>
      <td style="text-align:right">${rowBtns()}</td>
    </tr>`).join('')
  });
};

/* ---------- Dentists ---------- */
V.dentists = () => `
  <div class="page__head">
    <div><h1>${t('dentists')}</h1><p>${D.dentists.length} practitioners · schedules, specialities and performance</p></div>
    <div class="actions"><button class="btn btn--primary" data-modal="staff">${icon('plus')} Add Dentist</button></div>
  </div>
  <div class="grid g-auto">
    ${D.dentists.map(d => `
      <div class="card">
        <div class="profile-head" style="padding:20px">
          ${avatar(d.name, d.color, 'lg')}
          <div style="min-width:0">
            <h3 style="font-size:15.5px;font-weight:800">${d.name}</h3>
            <p class="muted" style="font-size:12.4px">${d.spec} · ${d.role}</p>
            <div style="display:flex;gap:4px;align-items:center;margin-top:5px;color:var(--warn);font-weight:800;font-size:12.4px">
              ${icon('star')} ${d.rating} <span class="muted" style="font-weight:600">(${d.patients} patients)</span>
            </div>
          </div>
        </div>
        <div class="card__body">
          <div class="kv" style="grid-template-columns:1fr 1fr">
            <div><small>Room</small><b>${d.room}</b></div>
            <div><small>Phone</small><b>${d.phone}</b></div>
            <div><small>Today</small><b>${D.appointments.filter(a => a.dentist === d.id && a.date === '2026-08-11').length} appointments</b></div>
            <div><small>Status</small>${chip('On Duty')}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn--sm" style="flex:1" data-toast="Opening schedule for ${d.name}">${icon('calendar')} Schedule</button>
            <button class="btn btn--sm" style="flex:1" data-toast="Profile opened">${icon('eye')} Profile</button>
          </div>
        </div>
      </div>`).join('')}
  </div>`;

/* ---------- Appointments ---------- */
V.appointments = () => {
  const q = state.query.toLowerCase();
  const list = D.appointments.filter(a => {
    const p = patientById(a.patient);
    return !q || (p.name + a.type + a.id).toLowerCase().includes(q);
  });
  return tablePage({
    title: t('appointments'), sub: `${D.appointments.filter(a => a.date === '2026-08-11').length} scheduled today · ${D.chairs.length} chairs`,
    actions: `<button class="btn">${icon('calendar')} Calendar view</button>
              <button class="btn btn--primary" data-modal="appointment">${icon('plus')} ${t('newAppt')}</button>`,
    toolbar: `${searchBox('Search appointments…')}
      <div class="segmented"><button class="on">${t('today')}</button><button>${t('week')}</button><button>${t('month')}</button><button>${t('all')}</button></div>
      <select class="select btn--sm" style="height:38px"><option>All dentists</option>${D.dentists.map(d => `<option>${d.name}</option>`).join('')}</select>
      <select class="select btn--sm" style="height:38px"><option>All chairs</option>${D.chairs.map(c => `<option>${c.id}</option>`).join('')}</select>`,
    head: ['Time', 'Patient', 'Treatment', 'Dentist', 'Chair', 'Duration', 'Status', { label: 'Actions', right: true }],
    count: list.length,
    rows: list.map(a => {
      const p = patientById(a.patient), d = dentistById(a.dentist);
      return `<tr>
        <td><b class="mono">${a.time}</b><br><small class="muted mono">${a.date}</small></td>
        <td><div class="cell-user">${avatar(p.name, p.color, 'sm')}<div><b>${p.name}</b><small>${p.phone}</small></div></div></td>
        <td><b style="font-weight:700">${a.type}</b><br><small class="muted">${a.note}</small></td>
        <td><div class="cell-user">${avatar(d.name, d.color, 'sm')}<div><b>${d.name}</b><small>${d.spec}</small></div></div></td>
        <td>${a.chair}</td>
        <td class="mono">${a.duration} min</td>
        <td>${chip(a.status)}</td>
        <td style="text-align:right">${rowBtns()}</td>
      </tr>`;
    }).join('')
  });
};

/* ---------- Chairs ---------- */
V.chairs = () => `
  <div class="page__head">
    <div><h1>${t('chairs')}</h1><p>Live operatory board · ${D.chairs.filter(c => c.status === 'Available').length} available now</p></div>
    <div class="actions"><button class="btn" data-toast="Board refreshed">${icon('history')} Refresh</button>
      <button class="btn btn--primary" data-modal="appointment">${icon('plus')} Assign patient</button></div>
  </div>
  <div class="grid chairs mb">
    ${D.chairs.map(c => {
      const col = c.status === 'Available' ? 'var(--ok)' : c.status === 'In Use' ? 'var(--brand-500)' : 'var(--warn)';
      const d = c.dentist ? dentistById(c.dentist) : null;
      const p = c.patient ? patientById(c.patient) : null;
      return `<div class="card" style="padding:0">
        <div class="chair" style="--c:${col};border:none;background:transparent;padding:20px">
          <div class="chair__bar"></div>
          <h4 style="font-size:15px">${c.id}</h4>
          <small>${c.status === 'In Use' ? 'Occupied since ' + c.since : c.status === 'Maintenance' ? 'Servicing since ' + c.since : 'Free until ' + c.next}</small>
          ${chip(c.status)}
          <div style="display:grid;gap:11px;margin-top:16px">
            <div class="chair__who">${d ? avatar(d.name, d.color, 'sm') + `<div><b style="font-size:12.7px">${d.name}</b><br><small class="muted">${d.spec}</small></div>` : '<small class="muted">No dentist assigned</small>'}</div>
            <div class="chair__who" style="margin-top:0">${p ? avatar(p.name, p.color, 'sm') + `<div><b style="font-size:12.7px">${p.name}</b><br><small class="muted">${(D.appointments.find(a => a.patient === p.id && a.chair === c.id) || {}).type || ''}</small></div>` : '<small class="muted">No patient in chair</small>'}</div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn--sm" style="flex:1" data-toast="${c.id} timeline opened">${icon('clock')} Timeline</button>
            <button class="btn btn--sm ${c.status === 'Available' ? 'btn--primary' : ''}" style="flex:1" data-toast="${c.id} status updated">Update</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>
  <div class="card">
    <div class="card__head"><div><h3>Chair utilisation today</h3><p>Percentage of booked hours per chair</p></div></div>
    <div class="card__body">
      ${D.chairs.map((c, i) => {
        const pct = [82, 91, 46, 64, 12, 0][i];
        return `<div style="display:flex;align-items:center;gap:14px;padding:9px 0">
          <b style="flex:0 0 90px;font-size:12.8px">${c.id}</b>
          <span class="bar" style="flex:1;height:9px"><i style="width:${pct}%"></i></span>
          <b class="mono" style="flex:0 0 46px;text-align:right;font-size:12.6px">${pct}%</b>
        </div>`;
      }).join('')}
    </div>
  </div>`;

/* ---------- Treatments ---------- */
V.treatments = () => {
  const q = state.query.toLowerCase();
  const list = D.treatments.filter(x => !q || (x.name + patientById(x.patient).name).toLowerCase().includes(q));
  return tablePage({
    title: t('treatments'), sub: `${D.treatments.filter(x => x.status === 'Ongoing').length} ongoing · ${D.treatments.filter(x => x.status === 'Completed').length} completed`,
    actions: `<button class="btn">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="treatment">${icon('plus')} New treatment plan</button>`,
    toolbar: `${searchBox('Search treatments…')}
      <div class="segmented"><button class="on">${t('all')}</button><button>Ongoing</button><button>Completed</button><button>Upcoming</button></div>`,
    head: ['Patient', 'Treatment', 'Tooth', 'Dentist', 'Sessions', 'Progress', 'Cost', 'Status', { label: 'Actions', right: true }],
    count: list.length,
    rows: list.map(x => {
      const p = patientById(x.patient), d = dentistById(x.dentist);
      return `<tr>
        <td><div class="cell-user">${avatar(p.name, p.color, 'sm')}<div><b>${p.name}</b><small>${x.id}</small></div></div></td>
        <td><b style="font-weight:700">${x.name}</b><br><small class="muted">Started ${x.started}</small></td>
        <td><span class="chip chip--info"><i></i>${x.tooth}</span></td>
        <td>${d.name}</td>
        <td class="mono">${x.sessions}</td>
        <td><div style="display:flex;align-items:center;gap:9px"><span class="bar"><i style="width:${x.progress}%"></i></span><b class="mono" style="font-size:12px">${x.progress}%</b></div></td>
        <td class="mono">${money(x.cost)}</td>
        <td>${chip(x.status)}</td>
        <td style="text-align:right">${rowBtns()}</td>
      </tr>`;
    }).join('')
  });
};

/* ---------- Odontogram ---------- */
V.odontogram = () => {
  const quads = {
    ur: ['18','17','16','15','14','13','12','11'],
    ul: ['21','22','23','24','25','26','27','28'],
    lr: ['48','47','46','45','44','43','42','41'],
    ll: ['31','32','33','34','35','36','37','38']
  };
  const tooth = (n, upper) => {
    const st = state.teeth[n] || 'healthy';
    return `<div class="tooth ${state.selectedTooth === n ? 'sel' : ''}" data-tooth="${n}" title="Tooth ${n} · ${TOOTH_STATE[st].label}">
      ${upper ? toothSVG(st, true) : ''}<span>${n}</span>${!upper ? toothSVG(st, false) : ''}</div>`;
  };
  const sel = state.selectedTooth;
  const selState = sel ? (state.teeth[sel] || 'healthy') : null;
  const history = sel ? D.treatments.filter(x => x.tooth === sel) : [];

  return `
  <div class="page__head">
    <div><h1>${t('odontogram')}</h1><p>Interactive dental chart · FDI numbering · click a tooth to update its condition</p></div>
    <div class="actions">
      <select class="select" id="odo-patient">${D.patients.map((p, i) => `<option ${i === 1 ? 'selected' : ''}>${p.name} — ${p.id}</option>`).join('')}</select>
      <button class="btn" data-print>${icon('print')} ${t('print')}</button>
      <button class="btn btn--primary" data-toast="Dental chart saved to patient record">${icon('check')} ${t('save')}</button>
    </div>
  </div>

  <div class="grid g-wide">
    <div class="card">
      <div class="card__head"><div><h3>Permanent dentition</h3><p>32 teeth · upper and lower arch</p></div>
        <div class="right">${chip('Ali Raza · P-1002', 'info')}</div></div>
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
          <div class="odo__legend">
            ${Object.entries(TOOTH_STATE).map(([k, v]) => `<div><i style="background:${v.fill};border-color:${v.stroke}"></i>${v.label}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card__head"><div><h3>${sel ? 'Tooth ' + sel : 'Tooth details'}</h3><p>${sel ? TOOTH_STATE[selState].label : 'Select a tooth from the chart'}</p></div></div>
      <div class="card__body">
        ${sel ? `
          <div class="field" style="margin-bottom:16px">
            <label>Condition</label>
            <select class="select" id="tooth-state">
              ${Object.entries(TOOTH_STATE).map(([k, v]) => `<option value="${k}" ${k === selState ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
          </div>
          <div class="field" style="margin-bottom:16px">
            <label>Clinical note</label>
            <textarea class="input" style="height:82px;padding:10px 12px" placeholder="Add observation for tooth ${sel}…"></textarea>
          </div>
          <b style="font-size:12.6px;display:block;margin-bottom:8px">Treatment history</b>
          ${history.length ? history.map(x => `
            <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)">
              <span class="ic" style="width:32px;height:32px;border-radius:10px;display:grid;place-items:center;background:var(--info-soft);color:var(--info)">${icon('treatment')}</span>
              <div><b style="font-size:12.8px">${x.name}</b><br><small class="muted">${x.started} · ${dentistById(x.dentist).name} · ${money(x.cost)}</small></div>
            </div>`).join('') : '<p class="muted" style="font-size:12.6px">No recorded treatment on this tooth.</p>'}
          <button class="btn btn--primary" style="width:100%;margin-top:16px" data-toast="Tooth ${sel} updated">${icon('check')} Apply changes</button>
        ` : `<div class="empty">${icon('tooth')}<p>Click any tooth on the chart to view and edit its condition, notes and treatment history.</p></div>`}
        <div class="hint" style="margin-top:16px">${icon('shield')}
          <span>Every change is versioned and stored in the patient's clinical record with the practitioner's name and timestamp.</span></div>
      </div>
    </div>
  </div>`;
};

/* ---------- X-Ray ---------- */
V.xray = () => `
  <div class="page__head">
    <div><h1>${t('xray')}</h1><p>${D.xrays.length} images stored · compare on a timeline</p></div>
    <div class="actions"><button class="btn">${icon('filter')} ${t('filter')}</button>
      <button class="btn btn--primary" data-toast="Upload dialog opened">${icon('upload')} Upload X-Ray</button></div>
  </div>
  <div class="grid g-auto-sm">
    ${D.xrays.map(x => {
      const p = patientById(x.patient);
      return `<div class="xray-card">
        <div class="img">${icon('xray')}<span class="chip chip--info" style="position:absolute;top:10px;left:10px">${x.type}</span></div>
        <div class="meta">
          <b>${p.name}</b><small>Tooth ${x.tooth} · ${x.date}</small>
          <div style="display:flex;align-items:center;gap:7px;margin-top:9px">
            ${avatar(dentistById(x.dentist).name, dentistById(x.dentist).color, 'sm')}
            <small class="muted" style="font-size:11.4px">${x.note}</small>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

/* ---------- Prescriptions ---------- */
V.prescriptions = () => tablePage({
  title: t('prescriptions'), sub: `${D.prescriptions.filter(r => r.status === 'Active').length} active prescriptions`,
  actions: `<button class="btn" data-print>${icon('print')} ${t('print')}</button>
            <button class="btn btn--primary" data-toast="Prescription form opened">${icon('plus')} New prescription</button>`,
  toolbar: `${searchBox('Search prescriptions…')}<div class="segmented"><button class="on">${t('all')}</button><button>Active</button><button>Completed</button></div>`,
  head: ['ID', 'Patient', 'Medication', 'Prescribed by', 'Date', 'Duration', 'Status', { label: 'Actions', right: true }],
  count: D.prescriptions.length,
  rows: D.prescriptions.map(r => {
    const p = patientById(r.patient);
    return `<tr>
      <td class="mono">${r.id}</td>
      <td><div class="cell-user">${avatar(p.name, p.color, 'sm')}<div><b>${p.name}</b><small>${p.allergy !== 'None' ? '⚠ Allergy: ' + p.allergy : 'No allergies'}</small></div></div></td>
      <td>${r.items}</td>
      <td>${dentistById(r.dentist).name}</td>
      <td class="mono">${r.date}</td>
      <td>${r.duration}</td>
      <td>${chip(r.status)}</td>
      <td style="text-align:right">${rowBtns()}</td>
    </tr>`;
  }).join('')
});

/* ---------- Lab requests ---------- */
V.labs = () => tablePage({
  title: t('labs'), sub: `${D.labs.filter(l => l.status !== 'Delivered').length} open requests with external laboratories`,
  actions: `<button class="btn btn--primary" data-toast="Lab request created">${icon('plus')} New lab request</button>`,
  toolbar: `${searchBox('Search lab requests…')}<div class="segmented"><button class="on">${t('all')}</button><button>Pending</button><button>In Progress</button><button>Delivered</button></div>`,
  head: ['Request', 'Patient', 'Item', 'Laboratory', 'Sent', 'Due', 'Cost', 'Status', { label: 'Actions', right: true }],
  count: D.labs.length,
  rows: D.labs.map(l => {
    const p = patientById(l.patient);
    return `<tr>
      <td class="mono">${l.id}</td>
      <td><div class="cell-user">${avatar(p.name, p.color, 'sm')}<div><b>${p.name}</b><small>${p.id}</small></div></div></td>
      <td><b style="font-weight:700">${l.item}</b></td>
      <td>${l.lab}</td>
      <td class="mono">${l.sent}</td>
      <td class="mono" style="${l.status !== 'Delivered' && l.due < '2026-08-11' ? 'color:var(--danger)' : ''}">${l.due}</td>
      <td class="mono">${money(l.cost)}</td>
      <td>${chip(l.status)}</td>
      <td style="text-align:right">${rowBtns()}</td>
    </tr>`;
  }).join('')
});

/* ---------- Invoices ---------- */
V.invoices = () => {
  const total = D.invoices.reduce((s, i) => s + i.total, 0);
  const paid = D.invoices.reduce((s, i) => s + i.paid, 0);
  const cards = [
    { icon: 'invoice', label: 'Total invoiced', value: money(total), accent: 'var(--brand-500)' },
    { icon: 'check', label: 'Collected', value: money(paid), accent: 'var(--ok)' },
    { icon: 'clock', label: 'Outstanding', value: money(total - paid), accent: 'var(--warn)' },
    { icon: 'alert', label: 'Overdue', value: D.invoices.filter(i => i.status === 'Overdue').length + ' invoices', accent: 'var(--danger)' }
  ];
  return `
  <div class="grid stats mb">
    ${cards.map(s => `<div class="stat" style="--accent:${s.accent}">
      <div class="stat__top"><div class="stat__icon">${icon(s.icon)}</div>
        <div><div class="stat__label">${s.label}</div><div class="stat__value" style="font-size:23px">${s.value}</div></div></div>
    </div>`).join('')}
  </div>
  ` + tablePage({
    title: t('invoices'), sub: 'Billing, insurance claims and receipts',
    actions: `<button class="btn">${icon('download')} ${t('export')}</button>
              <button class="btn btn--primary" data-modal="invoice">${icon('plus')} Create invoice</button>`,
    toolbar: `${searchBox('Search invoices…')}<div class="segmented"><button class="on">${t('all')}</button><button>Paid</button><button>Partial</button><button>Unpaid</button><button>Overdue</button></div>`,
    head: ['Invoice', 'Patient', 'Issued', 'Due', 'Items', 'Total', 'Paid', 'Method', 'Status', { label: 'Actions', right: true }],
    count: D.invoices.length,
    rows: D.invoices.map(v => {
      const p = patientById(v.patient);
      return `<tr>
        <td class="mono"><b>${v.id}</b></td>
        <td><div class="cell-user">${avatar(p.name, p.color, 'sm')}<div><b>${p.name}</b><small>${p.insurance}</small></div></div></td>
        <td class="mono">${v.date}</td>
        <td class="mono" style="${v.status === 'Overdue' ? 'color:var(--danger);font-weight:700' : ''}">${v.due}</td>
        <td>${v.items}</td>
        <td class="mono"><b>${money(v.total)}</b></td>
        <td class="mono">${money(v.paid)}</td>
        <td>${v.method}</td>
        <td>${chip(v.status)}</td>
        <td style="text-align:right"><div class="row-actions">
          <button class="icon-btn" data-toast="Invoice ${v.id} preview">${icon('eye')}</button>
          <button class="icon-btn" data-print>${icon('print')}</button>
          <button class="icon-btn" data-toast="Receipt emailed to ${p.email}">${icon('mail')}</button></div></td>
      </tr>`;
    }).join('')
  });
};

/* ---------- Payments ---------- */
V.payments = () => tablePage({
  title: t('payments'), sub: 'Cash, card, mobile money and insurance settlements',
  actions: `<button class="btn">${icon('download')} ${t('export')}</button>
            <button class="btn btn--primary" data-toast="Payment recorded">${icon('plus')} Record payment</button>`,
  toolbar: `${searchBox('Search payments…')}<div class="segmented"><button class="on">${t('all')}</button><button>Cash</button><button>Card</button><button>Mobile Money</button><button>Insurance</button></div>`,
  head: ['Payment', 'Invoice', 'Patient', 'Date', 'Method', 'Reference', 'Amount', 'Status', { label: 'Actions', right: true }],
  count: D.payments.length,
  rows: D.payments.map(v => {
    const p = patientById(v.patient);
    return `<tr>
      <td class="mono"><b>${v.id}</b></td>
      <td class="mono">${v.invoice}</td>
      <td><div class="cell-user">${avatar(p.name, p.color, 'sm')}<div><b>${p.name}</b><small>${p.id}</small></div></div></td>
      <td class="mono">${v.date}</td>
      <td>${v.method}</td>
      <td class="mono muted">${v.ref}</td>
      <td class="mono"><b>${money(v.amount)}</b></td>
      <td>${chip(v.status)}</td>
      <td style="text-align:right">${rowBtns()}</td>
    </tr>`;
  }).join('')
});

/* ---------- Inventory ---------- */
V.inventory = () => tablePage({
  title: t('inventory'), sub: `${D.inventory.length} items tracked · ${D.inventory.filter(i => i.stock < i.min).length} below minimum`,
  actions: `<button class="btn" data-toast="Purchase order drafted">${icon('download')} Purchase order</button>
            <button class="btn btn--primary" data-toast="Item form opened">${icon('plus')} Add item</button>`,
  toolbar: `${searchBox('Search inventory…')}<div class="segmented"><button class="on">${t('all')}</button><button>Low stock</button><button>Expiring</button></div>
            <select class="select btn--sm" style="height:38px"><option>All suppliers</option><option>DentSupply</option><option>MediCore</option><option>SafeHands</option></select>`,
  head: ['Item', 'Category', 'Stock level', 'Minimum', 'Unit price', 'Supplier', 'Expiry', { label: 'Actions', right: true }],
  count: D.inventory.length,
  rows: D.inventory.map(i => {
    const pct = Math.min(100, (i.stock / (i.min * 2)) * 100);
    const low = i.stock < i.min;
    return `<tr>
      <td><b style="font-weight:700">${i.name}</b><br><small class="muted mono">${i.id}</small></td>
      <td>${chip(i.cat, 'muted')}</td>
      <td><div style="display:flex;align-items:center;gap:9px">
        <span class="bar"><i style="width:${pct}%;background:${low ? 'linear-gradient(90deg,var(--danger),var(--warn))' : 'linear-gradient(90deg,var(--ok),var(--cyan-400))'}"></i></span>
        <b class="mono" style="font-size:12.3px;color:${low ? 'var(--danger)' : 'inherit'}">${i.stock} ${i.unit}</b></div></td>
      <td class="mono">${i.min}</td>
      <td class="mono">${money(i.price)}</td>
      <td>${i.supplier}</td>
      <td class="mono">${i.expiry}</td>
      <td style="text-align:right">${low
        ? `<button class="btn btn--sm btn--primary" data-toast="Reorder sent to ${i.supplier}">Reorder</button>`
        : rowBtns()}</td>
    </tr>`;
  }).join('')
});

/* ---------- Staff ---------- */
V.staff = () => tablePage({
  title: t('staff'), sub: `${D.staff.length} team members · roles, shifts and attendance`,
  actions: `<button class="btn btn--primary" data-modal="staff">${icon('plus')} Add staff</button>`,
  toolbar: `${searchBox('Search staff…')}<div class="segmented"><button class="on">${t('all')}</button><button>On Duty</button><button>Off Duty</button><button>Leave</button></div>`,
  head: ['Member', 'Role', 'Shift', 'Phone', 'Joined', 'Status', { label: 'Actions', right: true }],
  count: D.staff.length,
  rows: D.staff.map(s => `<tr>
    <td><div class="cell-user">${avatar(s.name, s.color)}<div><b>${s.name}</b><small>${s.id}</small></div></div></td>
    <td>${s.role}</td>
    <td>${chip(s.shift, 'info')}</td>
    <td class="mono">${s.phone}</td>
    <td class="mono">${s.joined}</td>
    <td>${chip(s.status)}</td>
    <td style="text-align:right">${rowBtns()}</td>
  </tr>`).join('')
});

/* ---------- Reports ---------- */
V.reports = () => {
  const totalRev = D.revenue.reduce((s, r) => s + r.v, 0);
  const totalExp = D.revenue.reduce((s, r) => s + r.exp, 0);
  return `
  <div class="page__head">
    <div><h1>${t('reports')}</h1><p>Advanced analytics to grow your dental practice</p></div>
    <div class="actions">
      <select class="select"><option>Jan – Aug 2026</option><option>Last 12 months</option><option>2025</option></select>
      <button class="btn" data-print>${icon('print')} ${t('print')}</button>
      <button class="btn btn--primary" data-toast="Full report exported as PDF">${icon('download')} ${t('export')} PDF</button>
    </div>
  </div>

  <div class="grid stats mb">
    ${[
      { icon: 'dollar', label: 'Gross revenue', value: money(totalRev), delta: 22, up: true, accent: 'var(--ok)' },
      { icon: 'invoice', label: 'Expenses', value: money(totalExp), delta: 9, up: false, accent: 'var(--warn)' },
      { icon: 'trendUp', label: 'Net profit', value: money(totalRev - totalExp), delta: 31, up: true, accent: 'var(--brand-500)' },
      { icon: 'patients', label: 'New patients', value: '312', delta: 14, up: true, accent: 'var(--purple)' }
    ].map(s => `<div class="stat" style="--accent:${s.accent}">
      <div class="stat__top"><div class="stat__icon">${icon(s.icon)}</div>
        <div><div class="stat__label">${s.label}</div><div class="stat__value" style="font-size:23px">${s.value}</div></div></div>
      <div class="stat__foot"><span class="delta ${s.up ? 'up' : 'down'}">${icon(s.up ? 'trendUp' : 'trendDown')}${s.delta}%</span> vs last period</div>
    </div>`).join('')}
  </div>

  <div class="grid g-mid mb">
    <div class="card">
      <div class="card__head"><div><h3>Revenue vs expenses</h3><p>Monthly comparison</p></div>
        <div class="right"><div class="chart-legend">
          <div><i style="background:#2563eb"></i>Revenue</div><div><i style="background:#f59e0b"></i>Expenses</div>
        </div></div></div>
      <div class="card__body">
        <div style="display:flex;gap:26px;margin-bottom:10px">
          ${[['Revenue', money(totalRev), 'var(--brand-500)'],
             ['Expenses', money(totalExp), 'var(--warn)'],
             ['Margin', Math.round((1 - totalExp / totalRev) * 100) + '%', 'var(--ok)']].map(([l, v, c]) => `
            <div><small class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">${l}</small>
              <div style="font-size:20px;font-weight:800;letter-spacing:-.6px;color:${c}">${v}</div></div>`).join('')}
        </div>
        ${Chart.area(D.revenue, { h: 260, color: '#2563eb', color2: '#22d3ee', second: { key: 'exp', color: '#f59e0b' } })}
      </div>
    </div>
    <div class="card">
      <div class="card__head"><div><h3>${t('card.services')}</h3><p>By volume and revenue</p></div></div>
      <div class="card__body">
        ${Chart.ranked(D.topServices)}
        <div style="display:flex;gap:10px;margin-top:16px">
          <div style="flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:12px">
            <small class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Procedures</small>
            <div style="font-size:19px;font-weight:800;letter-spacing:-.5px">${D.topServices.reduce((s, x) => s + x.count, 0)}</div>
          </div>
          <div style="flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:12px">
            <small class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Revenue</small>
            <div style="font-size:19px;font-weight:800;letter-spacing:-.5px">${money(D.topServices.reduce((s, x) => s + x.revenue, 0))}</div>
          </div>
          <div style="flex:1;background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:12px">
            <small class="muted" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Avg ticket</small>
            <div style="font-size:19px;font-weight:800;letter-spacing:-.5px">${money(Math.round(D.topServices.reduce((s, x) => s + x.revenue, 0) / D.topServices.reduce((s, x) => s + x.count, 0)))}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid g-3">
    <div class="card">
      <div class="card__head"><div><h3>Patient demographics</h3><p>Age distribution</p></div></div>
      <div class="card__body">
        ${Chart.bars([
          { d: '0-17', v: 84 }, { d: '18-29', v: 156 }, { d: '30-44', v: 212 },
          { d: '45-59', v: 128 }, { d: '60+', v: 67 }], { h: 190, color: '#8b5cf6', color2: '#c4b5fd' })}
        <div style="margin-top:14px">
          ${[['Female', 58, '#ec4899'], ['Male', 42, '#3b82f6']].map(([l, v, c]) => `
            <div style="padding:7px 0">
              <div style="display:flex;justify-content:space-between;font-size:12.4px;font-weight:700;margin-bottom:5px">
                <span>${l}</span><span class="mono">${v}%</span></div>
              <span class="bar" style="display:block"><i style="width:${v}%;background:${c}"></i></span>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card__head"><div><h3>Payment methods</h3><p>Share of collections</p></div></div>
      <div class="card__body"><div class="donut-wrap">
        ${Chart.donut([
          { label: 'Mobile Money', value: 38, color: '#10b981' },
          { label: 'Cash', value: 26, color: '#2563eb' },
          { label: 'Insurance', value: 24, color: '#8b5cf6' },
          { label: 'Card', value: 12, color: '#f59e0b' }
        ], { size: 160, centerTop: '100%', centerSub: 'Collected' })}
        <div class="chart-legend">
          <div><i style="background:#10b981"></i>Mobile Money<b>38%</b></div>
          <div><i style="background:#2563eb"></i>Cash<b>26%</b></div>
          <div><i style="background:#8b5cf6"></i>Insurance<b>24%</b></div>
          <div><i style="background:#f59e0b"></i>Card<b>12%</b></div>
        </div></div></div>
    </div>
    <div class="card">
      <div class="card__head"><div><h3>Clinic KPIs</h3><p>This month</p></div></div>
      <div class="card__body">
        ${[
          ['Chair utilisation', 78, 'var(--brand-500)'],
          ['Appointment show-rate', 91, 'var(--ok)'],
          ['Treatment acceptance', 64, 'var(--purple)'],
          ['Recall compliance', 55, 'var(--warn)'],
          ['Collection rate', 86, 'var(--cyan-500)']
        ].map(([label, val, col]) => `
          <div style="padding:9px 0">
            <div style="display:flex;justify-content:space-between;font-size:12.6px;font-weight:700;margin-bottom:6px">
              <span>${label}</span><span class="mono">${val}%</span></div>
            <span class="bar" style="display:block"><i style="width:${val}%;background:${col}"></i></span>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
};

/* ---------- Settings ---------- */
V.settings = () => {
  const tabs = { clinic: 'Clinic profile', notif: 'Notifications', security: 'Security & backup', billing: 'Billing', appearance: 'Appearance' };
  const sw = (key, title, desc) => `
    <div class="switch-row"><div class="txt"><b>${title}</b><small>${desc}</small></div>
      <div class="switch ${state.switches[key] ? 'on' : ''}" data-switch="${key}"></div></div>`;

  const panes = {
    clinic: `
      <div class="form-grid">
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
         + sw('reminders', 'Recall reminders', 'Automatic 6-month check-up recalls for every patient.')
         + `<div class="hint" style="margin-top:16px">${icon('chat')}<span>Reminder templates support Somali and English — patients receive messages in their preferred language.</span></div>`,
    security: sw('twofa', 'Two-factor authentication', 'Require a one-time code for admin accounts.')
            + sw('backup', 'Daily automatic backup', 'Encrypted backup to Firebase every night at 02:00 EAT.')
            + sw('portal', 'Patient portal access', 'Let patients view appointments and invoices online.')
            + `<div class="hint" style="margin-top:16px">${icon('shield')}<span>Last backup completed 11 Aug 2026, 02:00 · 412 MB · verified.</span></div>`,
    billing: `<div class="form-grid">
        <div class="field"><label>Tax rate (%)</label><input class="input" value="5"></div>
        <div class="field"><label>Invoice prefix</label><input class="input" value="INV-"></div>
        <div class="field"><label>Payment terms</label><select class="select"><option>Due in 14 days</option><option>Due on receipt</option></select></div>
        <div class="field"><label>Default method</label><select class="select"><option>Mobile Money</option><option>Cash</option><option>Card</option></select></div>
        <div class="field full"><label>Insurance providers</label><input class="input" value="MedPlus, Takaful Health, SomCare"></div>
      </div>`,
    appearance: `
      <div class="switch-row"><div class="txt"><b>Dark mode</b><small>Switch the whole workspace to a dark palette.</small></div>
        <div class="switch ${state.theme === 'dark' ? 'on' : ''}" id="sw-theme"></div></div>
      <div class="switch-row"><div class="txt"><b>Compact sidebar</b><small>Show icons only to gain screen width.</small></div>
        <div class="switch ${state.mini ? 'on' : ''}" id="sw-mini"></div></div>
      <div class="switch-row"><div class="txt"><b>Interface language</b><small>English or Somali across the whole system.</small></div>
        <div class="lang-toggle" style="margin-left:auto">
          <button class="${LANG === 'en' ? 'on' : ''}" data-lang="en">EN</button>
          <button class="${LANG === 'so' ? 'on' : ''}" data-lang="so">SO</button></div></div>`
  };

  return `
  <div class="page__head">
    <div><h1>${t('settings')}</h1><p>Configure the clinic, notifications, security and billing</p></div>
    <div class="actions"><button class="btn btn--primary" data-toast="Settings saved">${icon('check')} ${t('save')}</button></div>
  </div>
  <div class="settings-grid">
    <div class="card"><div class="card__body" style="padding:12px">
      <div class="settings-nav">
        ${Object.entries(tabs).map(([k, v]) => `<button class="${state.settingsTab === k ? 'on' : ''}" data-stab="${k}">${v}</button>`).join('')}
      </div>
    </div></div>
    <div class="card">
      <div class="card__head"><div><h3>${tabs[state.settingsTab]}</h3><p>Changes apply to the whole clinic</p></div></div>
      <div class="card__body">${panes[state.settingsTab]}</div>
    </div>
  </div>`;
};

/* ============================================================
   Modals
   ============================================================ */
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
      <div class="field full"><label>Allergies / medical notes</label><textarea class="input" style="height:78px;padding:10px 12px" placeholder="Penicillin, latex…"></textarea></div>
      <div class="field"><label>Insurance</label><select class="select"><option>None</option><option>MedPlus</option><option>Takaful</option></select></div>
      <div class="field"><label>Assigned dentist</label><select class="select">${D.dentists.map(d => `<option>${d.name}</option>`).join('')}</select></div>
    </div>`,
    ok: 'Register patient', toast: 'New patient registered successfully'
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
      <div class="field full"><label>Note</label><textarea class="input" style="height:70px;padding:10px 12px" placeholder="Reason for visit…"></textarea></div>
      <div class="field full"><div class="hint">${icon('chat')}<span>An SMS reminder in the patient's language is sent 24 hours before the appointment.</span></div></div>
    </div>`,
    ok: 'Confirm booking', toast: 'Appointment booked and reminder scheduled'
  }),
  treatment: () => ({
    title: 'New treatment plan',
    body: `<div class="form-grid">
      <div class="field full"><label>Patient</label><select class="select">${D.patients.map(p => `<option>${p.name} — ${p.id}</option>`).join('')}</select></div>
      <div class="field"><label>Treatment</label><select class="select"><option>Root Canal Therapy</option><option>Composite Filling</option><option>Crown</option><option>Implant</option><option>Braces</option></select></div>
      <div class="field"><label>Tooth (FDI)</label><input class="input" placeholder="e.g. 26"></div>
      <div class="field"><label>Sessions</label><input class="input" type="number" value="3"></div>
      <div class="field"><label>Estimated cost</label><input class="input" value="$320"></div>
      <div class="field full"><label>Plan notes</label><textarea class="input" style="height:78px;padding:10px 12px"></textarea></div>
    </div>`,
    ok: 'Create plan', toast: 'Treatment plan created'
  }),
  invoice: () => ({
    title: 'Create invoice',
    body: `<div class="form-grid">
      <div class="field full"><label>Patient</label><select class="select">${D.patients.map(p => `<option>${p.name} — ${p.id}</option>`).join('')}</select></div>
      <div class="field"><label>Issue date</label><input class="input" type="date" value="2026-08-11"></div>
      <div class="field"><label>Due date</label><input class="input" type="date" value="2026-08-25"></div>
      <div class="field full"><label>Line items</label>
        <div style="border:1px solid var(--line);border-radius:11px;overflow:hidden">
          <table class="tbl" style="min-width:0"><thead><tr><th>Service</th><th>Qty</th><th>Price</th></tr></thead>
          <tbody><tr><td>Root Canal — session 3</td><td>1</td><td class="mono">$160</td></tr>
          <tr><td>Periapical X-Ray</td><td>2</td><td class="mono">$40</td></tr></tbody></table>
        </div></div>
      <div class="field"><label>Payment method</label><select class="select"><option>Mobile Money</option><option>Cash</option><option>Card</option><option>Insurance</option></select></div>
      <div class="field"><label>Tax (5%)</label><input class="input" value="$10" disabled></div>
    </div>`,
    ok: 'Generate invoice', toast: 'Invoice generated and sent to the patient'
  }),
  staff: () => ({
    title: 'Add team member',
    body: `<div class="form-grid">
      <div class="field"><label>Full name</label><input class="input"></div>
      <div class="field"><label>Role</label><select class="select"><option>Dentist</option><option>Dental Assistant</option><option>Receptionist</option><option>Lab Technician</option><option>Accountant</option></select></div>
      <div class="field"><label>Phone</label><input class="input"></div>
      <div class="field"><label>Shift</label><select class="select"><option>Morning</option><option>Evening</option><option>Full Day</option></select></div>
      <div class="field full"><label>System permissions</label><select class="select"><option>Standard user</option><option>Clinic admin</option><option>Read only</option></select></div>
    </div>`,
    ok: 'Add member', toast: 'Team member added'
  })
};

function openModal(kind) {
  const m = MODALS[kind]();
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal ${kind === 'invoice' ? 'wide' : ''}">
    <div class="modal__head"><h3>${m.title}</h3>
      <button class="icon-btn" style="margin-left:auto" data-close>${icon('x')}</button></div>
    <div class="modal__body">${m.body}</div>
    <div class="modal__foot">
      <button class="btn" data-close>${t('cancel')}</button>
      <button class="btn btn--primary" data-ok>${icon('check')} ${m.ok}</button>
    </div></div>`;
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-close]')) el.remove();
    if (e.target.closest('[data-ok]')) { el.remove(); toast(m.toast); }
  });
  document.body.appendChild(el);
}

/* ---------- toast ---------- */
function toast(msg, tone = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="ic" style="background:var(--${tone}-soft);color:var(--${tone})">${icon('check')}</span><span>${msg}</span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = '.25s'; }, 2600);
  setTimeout(() => el.remove(), 2950);
}

/* ============================================================
   Render + events
   ============================================================ */
function render() {
  document.documentElement.setAttribute('data-theme', state.theme);
  document.body.classList.toggle('mini', state.mini);
  renderSidebar();
  renderTopbar();
  $('#view').innerHTML = (V[state.view] || V.dashboard)();
  window.scrollTo({ top: 0 });
}

function go(view) {
  if (!V[view]) return;
  state.view = view;
  state.query = '';
  document.body.classList.remove('drawer');
  location.hash = view;
  render();
}

document.addEventListener('click', e => {
  const nav = e.target.closest('[data-nav]');
  if (nav) return go(nav.dataset.nav);

  if (e.target.closest('#btn-menu')) {
    if (window.innerWidth <= 1080) document.body.classList.toggle('drawer');
    else { state.mini = !state.mini; localStorage.setItem('df_mini', state.mini ? '1' : '0'); render(); }
    return;
  }
  if (e.target.closest('#btn-theme') || e.target.closest('#sw-theme')) {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('df_theme', state.theme);
    return render();
  }
  if (e.target.closest('#sw-mini')) {
    state.mini = !state.mini; localStorage.setItem('df_mini', state.mini ? '1' : '0'); return render();
  }
  const lang = e.target.closest('[data-lang]');
  if (lang) { LANG = lang.dataset.lang; localStorage.setItem('df_lang', LANG); return render(); }

  const stab = e.target.closest('[data-stab]');
  if (stab) { state.settingsTab = stab.dataset.stab; return render(); }

  const sw = e.target.closest('[data-switch]');
  if (sw) { const k = sw.dataset.switch; state.switches[k] = !state.switches[k]; return render(); }

  const th = e.target.closest('[data-tooth]');
  if (th) { state.selectedTooth = th.dataset.tooth === state.selectedTooth ? null : th.dataset.tooth; return render(); }

  const modal = e.target.closest('[data-modal]');
  if (modal) return openModal(modal.dataset.modal);

  if (e.target.closest('[data-print]')) return window.print();

  const seg = e.target.closest('.segmented button');
  if (seg) { seg.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on')); seg.classList.add('on'); return; }

  const tst = e.target.closest('[data-toast]');
  if (tst) return toast(tst.dataset.toast);
});

document.addEventListener('input', e => {
  if (e.target.id === 'global-search' || e.target.hasAttribute('data-search')) {
    state.query = e.target.value;
    const searchable = ['patients', 'appointments', 'treatments'];
    if (!searchable.includes(state.view)) state.view = 'patients';
    const pos = e.target.selectionStart;
    render();
    const box = $('[data-search]') || $('#global-search');
    if (box) { box.value = state.query; box.focus(); box.setSelectionRange(pos, pos); }
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'tooth-state' && state.selectedTooth) {
    state.teeth[state.selectedTooth] = e.target.value;
    render();
    toast('Tooth condition updated');
  }
});

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (v && V[v] && v !== state.view) { state.view = v; render(); }
});

/* boot */
const initial = location.hash.slice(1);
if (initial && V[initial]) state.view = initial;
render();
