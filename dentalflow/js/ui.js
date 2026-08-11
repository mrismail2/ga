/* ============================================================
   DentalFlow Pro — icons, charts, tone system and helpers
   No external libraries: every glyph and chart is generated here.
   ============================================================ */

/* ------------------------------------------------------------
   Icons — 1.7px stroke, 24px grid
   ------------------------------------------------------------ */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7.5" height="8.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.8"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="1.8"/><rect x="3" y="15" width="7.5" height="6" rx="1.8"/>',
  patients: '<path d="M16 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.7v1.8"/><circle cx="9.5" cy="7.5" r="3.7"/><path d="M21 20.5v-1.8a3.7 3.7 0 0 0-2.8-3.6M15.5 4a3.7 3.7 0 0 1 0 7.1"/>',
  dentist: '<path d="M19 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H8.7A3.7 3.7 0 0 0 5 18.7v1.8"/><circle cx="12" cy="7.5" r="3.7"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.2"/><path d="M16 2.5v4M8 2.5v4M3 9.8h18"/>',
  chair: '<path d="M5.5 4h3.2l.9 7.5H6.5A2 2 0 0 1 4.5 9.5V6a2 2 0 0 1 1-2Z"/><path d="M9.6 11.5h6.2a3 3 0 0 1 3 3v.8a3 3 0 0 1-3 3h-3.6a2.6 2.6 0 0 1-2.6-2.6v-4.2Z"/><path d="M12.5 18.3V21M9 21h7"/>',
  treatment: '<path d="m14.2 3.6 6.2 6.2-9.1 9.1H5.1v-6.2z"/><path d="m13 5 6.2 6.2"/>',
  tooth: '<path d="M12 3.2c-1.9 0-2.5.9-4 .9C6 4.1 4.5 5.7 4.5 8.2c0 2.8 1.1 4.3 1.7 6.5.5 1.9.6 5.2 2.1 5.2 1.6 0 1.2-4.1 3.7-4.1s2.1 4.1 3.7 4.1c1.5 0 1.6-3.3 2.1-5.2.6-2.2 1.7-3.7 1.7-6.5 0-2.5-1.5-4.1-3.5-4.1-1.5 0-2.1-.9-4-.9Z"/>',
  xray: '<rect x="3" y="3" width="18" height="18" rx="2.2"/><path d="M12 3v18M3 12h18"/><path d="m7.8 7.8 8.4 8.4M16.2 7.8l-8.4 8.4"/>',
  rx: '<path d="M5 20.5V4h4.2a3.2 3.2 0 0 1 0 6.4H5"/><path d="m9 10.4 8.4 10.1M17.4 10.4 9 20.5"/>',
  lab: '<path d="M9.2 3v6.4L4.5 17.7A2 2 0 0 0 6.3 20.7h11.4a2 2 0 0 0 1.8-3l-4.7-8.3V3"/><path d="M8 3h8M7.2 14h9.6"/>',
  invoice: '<path d="M14 2.5H7.2a2 2 0 0 0-2 2v17l2.8-1.8 2 1.8 2-1.8 2 1.8 2.8-1.8V8.2Z"/><path d="M14 2.5v5.7h4.8M9 12.5h6M9 16h4"/>',
  payment: '<rect x="2.5" y="5" width="19" height="14" rx="2.2"/><path d="M2.5 9.8h19M6.2 15h3.6"/>',
  inventory: '<path d="m3.2 7.8 8.8-4.6 8.8 4.6v8.4L12 20.8l-8.8-4.6Z"/><path d="m3.2 7.8 8.8 4.7 8.8-4.7M12 12.5v8.3"/>',
  staff: '<path d="M15.5 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H6.7A3.7 3.7 0 0 0 3 18.7v1.8"/><circle cx="9.2" cy="7.5" r="3.7"/><path d="M19 8.2v5.4M21.7 10.9h-5.4"/>',
  reports: '<path d="M3.5 3v17.5H21"/><path d="m7 15.5 3.8-4.6 2.9 2.8 4.8-6.4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M18.8 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  bell: '<path d="M18 8.4a6 6 0 0 0-12 0c0 6.6-2.6 8.4-2.6 8.4h17.2S18 15 18 8.4"/><path d="M13.7 20.5a2 2 0 0 1-3.4 0"/>',
  chat: '<path d="M20.5 14.6a2 2 0 0 1-2 2H7.9L3.5 20.5V5.4a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.6 12h2M19.4 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 13.2A8.6 8.6 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7Z"/>',
  check: '<path d="M19.5 6.5 9.2 16.8 4.5 12.1"/>',
  alert: '<path d="M10.4 4 2.9 17.3a1.9 1.9 0 0 0 1.6 2.8h15a1.9 1.9 0 0 0 1.6-2.8L13.6 4a1.9 1.9 0 0 0-3.2 0Z"/><path d="M12 9.3v4M12 16.6h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3 1.8"/>',
  dollar: '<path d="M12 2.5v19"/><path d="M16.6 6H9.9a3.3 3.3 0 0 0 0 6.6h4.4a3.3 3.3 0 0 1 0 6.6H6.8"/>',
  trendUp: '<path d="m3.5 16.5 5.6-5.6 3.6 3.6 7.4-7.4"/><path d="M16.3 7.1h3.8v3.8"/>',
  trendDown: '<path d="m3.5 7.5 5.6 5.6 3.6-3.6 7.4 7.4"/><path d="M16.3 16.9h3.8v-3.8"/>',
  eye: '<path d="M2.5 12S6.3 5.6 12 5.6 21.5 12 21.5 12 17.7 18.4 12 18.4 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.9"/>',
  edit: '<path d="M11 4.4H4.6v15.2h15.2V13"/><path d="m18.1 3 3 3-9.4 9.4-3.9.9.9-3.9Z"/>',
  trash: '<path d="M3.6 6.2h16.8M8.2 6.2V4.4h7.6v1.8M18.4 6.2 17.3 20H6.7L5.6 6.2M10 10.4v5.4M14 10.4v5.4"/>',
  print: '<path d="M6.5 9.2V2.8h11v6.4M6.5 17.8H4.6a2 2 0 0 1-2-2v-4.6h18.8v4.6a2 2 0 0 1-2 2h-1.9"/><path d="M6.5 14h11v7.2h-11z"/>',
  download: '<path d="M20.8 15.2v3.6a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2v-3.6"/><path d="m7.4 10.4 4.6 4.6 4.6-4.6M12 15V3.2"/>',
  filter: '<path d="M21 3.5H3l7.2 8.5v6.3l3.6 1.8V12Z"/>',
  phone: '<path d="M21.5 16.9v2.7a1.8 1.8 0 0 1-2 1.8 18.2 18.2 0 0 1-7.9-2.8 17.9 17.9 0 0 1-5.5-5.5A18.2 18.2 0 0 1 3.3 5.1a1.8 1.8 0 0 1 1.8-2h2.7a1.8 1.8 0 0 1 1.8 1.6c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9L8.6 10.3a14.7 14.7 0 0 0 5.5 5.5l1.2-1.2a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.6 1.8Z"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.2"/><path d="m2.9 6.4 9.1 5.6 9.1-5.6"/>',
  shield: '<path d="M12 21.4s7.6-3.6 7.6-9.4V5.4L12 2.6 4.4 5.4V12c0 5.8 7.6 9.4 7.6 9.4Z"/><path d="m9.3 11.8 2 2 3.5-3.6"/>',
  chevronRight: '<path d="m9.5 18 6-6-6-6"/>',
  chevronLeft: '<path d="m14.5 18-6-6 6-6"/>',
  chevronDown: '<path d="m6 9.5 6 6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M20.8 15.2v3.6a2 2 0 0 1-2 2H5.2a2 2 0 0 1-2-2v-3.6"/><path d="m7.4 7.8 4.6-4.6 4.6 4.6M12 3.2V15"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.9-6.4L3.5 8.2"/><path d="M3.5 3.4v4.8h4.8M12 7.4V12l3.6 1.9"/>',
  building: '<path d="M4.4 21V4.6a2 2 0 0 1 2-2h5.2a2 2 0 0 1 2 2V21"/><path d="M13.6 9.4h4a2 2 0 0 1 2 2V21M2.5 21h19M8 6.6h1.9M8 10.4h1.9M8 14.2h1.9"/>',
  star: '<path d="m12 3 2.8 5.9 6.2.9-4.5 4.5 1.1 6.3L12 17.6 6.4 20.6l1.1-6.3L3 9.8l6.2-.9Z"/>',
  user: '<path d="M18.8 20.5v-1.8a3.7 3.7 0 0 0-3.7-3.7H8.9a3.7 3.7 0 0 0-3.7 3.7v1.8"/><circle cx="12" cy="7.5" r="3.7"/>',
  arrowRight: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  command: '<path d="M8.5 3.5a2.5 2.5 0 1 1-2.5 2.5v12a2.5 2.5 0 1 1 2.5-2.5h7a2.5 2.5 0 1 1 2.5 2.5V6a2.5 2.5 0 1 1-2.5 2.5Z"/>'
};

function icon(name, cls = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.dashboard;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}

/* ------------------------------------------------------------
   Tone system — every colour used in the UI comes from here, so
   light and dark themes stay consistent.
   ------------------------------------------------------------ */
const TONES = ['brand', 'ok', 'warn', 'danger', 'violet', 'teal', 'pink'];
const TONE_VAR = {
  brand: ['var(--brand-500)', 'var(--info-bg)'],
  ok: ['var(--ok)', 'var(--ok-bg)'],
  warn: ['var(--warn)', 'var(--warn-bg)'],
  danger: ['var(--danger)', 'var(--danger-bg)'],
  violet: ['var(--violet)', 'var(--violet-bg)'],
  teal: ['var(--teal)', 'var(--teal-bg)'],
  pink: ['var(--pink)', 'var(--pink-bg)']
};
const tone = t => `--tone:${TONE_VAR[t][0]};--tone-bg:${TONE_VAR[t][1]}`;

/* Deterministic tone from a name — avatars stay stable between renders
   without hard-coding a colour per record. */
function toneOf(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

const TITLES = ['dr.', 'dr', 'mr.', 'mrs.', 'ms.', 'prof.'];
const initialsOf = n => n.split(' ')
  .filter(w => w && !TITLES.includes(w.toLowerCase()))
  .map(w => w[0]).slice(0, 2).join('').toUpperCase();

function avatar(name, cls = '') {
  const t = toneOf(name);
  return `<span class="avatar ${cls}" style="--av-bg:${TONE_VAR[t][1]};--av-fg:${TONE_VAR[t][0]};--av-line:color-mix(in srgb, ${TONE_VAR[t][0]} 22%, transparent)">${initialsOf(name)}</span>`;
}

const STATUS_TONE = {
  Confirmed: 'ok', Completed: 'ok', Paid: 'ok', Success: 'ok', Delivered: 'ok',
  Active: 'ok', 'On Duty': 'ok', Available: 'ok',
  'In Progress': 'info', Ongoing: 'info', Partial: 'info', 'In Use': 'info', New: 'info',
  Upcoming: 'warn', Pending: 'warn', 'Follow-up': 'warn', Maintenance: 'warn',
  Leave: 'warn', Unpaid: 'warn',
  Cancelled: 'danger', Overdue: 'danger', Failed: 'danger',
  Inactive: 'muted', 'Off Duty': 'muted'
};
const chip = (txt, t) => `<span class="chip chip--${t || STATUS_TONE[txt] || 'muted'}"><i></i>${txt}</span>`;
const money = n => '$' + Number(n).toLocaleString('en-US');
const compact = n => n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K' : '$' + n;

/* ------------------------------------------------------------
   Charts
   ------------------------------------------------------------
   Charts are mounted after layout so every SVG is drawn at its real
   pixel size — no viewBox stretching, so labels stay crisp and round.
   ------------------------------------------------------------ */
let CHART_SEQ = 0;
let CHART_QUEUE = [];

/** Reserve a slot in the DOM; the chart is drawn by mountCharts(). */
function chartHost(type, data, opts = {}) {
  const id = 'chart-' + (++CHART_SEQ);
  CHART_QUEUE.push({ id, type, data, opts });
  return `<div class="chart" id="${id}" style="height:${opts.h || 220}px"></div>`;
}

function mountCharts() {
  for (const c of CHART_QUEUE) {
    const el = document.getElementById(c.id);
    if (!el) continue;
    const w = Math.max(el.clientWidth, 240);
    el.innerHTML = Chart[c.type](c.data, { ...c.opts, w, h: c.opts.h || 220 });
  }
  CHART_QUEUE = [];
}

const CSS_VAR = {
  brand: '#2f6bf0', accent: '#12a8c4', ok: '#0f9d6f',
  warn: '#c2820b', danger: '#d33c3c', violet: '#7455d8'
};

const Chart = {
  /* Smooth area chart with an optional comparison line and hover targets */
  area(data, { w = 640, h = 220, key = 'v', label = 'm', color = CSS_VAR.brand,
               fmt = compact, second = null, ticks = 4 } = {}) {
    const pad = { t: 14, r: 8, b: 24, l: 46 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const all = data.map(d => d[key]).concat(second ? data.map(d => d[second.key]) : []);
    const hi = Math.max(...all), lo = Math.min(...all);
    const max = hi + (hi - lo) * .18, min = Math.max(0, lo - (hi - lo) * .35);
    const X = i => pad.l + (i / (data.length - 1)) * iw;
    const Y = v => pad.t + ih - ((v - min) / (max - min || 1)) * ih;

    const curve = pts => pts.reduce((d, p, i) => {
      if (!i) return `M ${p[0]} ${p[1]}`;
      const q = pts[i - 1], cx = (q[0] + p[0]) / 2;
      return `${d} C ${cx} ${q[1]}, ${cx} ${p[1]}, ${p[0]} ${p[1]}`;
    }, '');

    const pts = data.map((d, i) => [X(i), Y(d[key])]);
    const line = curve(pts);
    const area = `${line} L ${X(data.length - 1)} ${pad.t + ih} L ${pad.l} ${pad.t + ih} Z`;
    const uid = 'a' + (++CHART_SEQ);

    let grid = '';
    for (let i = 0; i <= ticks; i++) {
      const y = pad.t + (ih / ticks) * i;
      const v = max - ((max - min) / ticks) * i;
      grid += `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="currentColor" stroke-opacity=".1"/>
        <text x="${pad.l - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" font-weight="600"
          fill="currentColor" fill-opacity=".42">${fmt(v)}</text>`;
    }

    let cmp = '';
    if (second) {
      const p2 = data.map((d, i) => [X(i), Y(d[second.key])]);
      cmp = `<path d="${curve(p2)}" fill="none" stroke="${second.color}" stroke-width="2"
        stroke-dasharray="6 5" stroke-linecap="round" opacity=".9"/>`;
    }

    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}"
      r="${i === pts.length - 1 ? 4 : 2.6}" fill="${i === pts.length - 1 ? color : 'var(--surface)'}"
      stroke="${color}" stroke-width="2"/>`).join('');

    const xLabels = data.map((d, i) => `<text x="${X(i)}" y="${h - 6}" text-anchor="middle"
      font-size="10" font-weight="600" fill="currentColor" fill-opacity=".45">${d[label]}</text>`).join('');

    const band = iw / (data.length - 1);
    const hits = data.map((d, i) => {
      const t = `${d[label]} · ${fmt(d[key])}` + (second ? ` · ${second.label || 'B'} ${fmt(d[second.key])}` : '');
      return `<rect x="${X(i) - band / 2}" y="${pad.t}" width="${band}" height="${ih}"
        fill="transparent" data-tip="${t}" style="cursor:crosshair"/>`;
    }).join('');

    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="color:var(--text)">
      <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".22"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <path d="${area}" fill="url(#${uid})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      ${cmp}${dots}${xLabels}${hits}
    </svg>`;
  },

  /* Donut with a centred readout */
  donut(slices, { size = 168, thickness = 20, centerTop = '', centerSub = '' } = {}) {
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    const r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r;
    let off = 0;
    const arcs = slices.map(s => {
      const len = (s.value / total) * circ;
      const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}"
        stroke-width="${thickness}" stroke-dasharray="${Math.max(len - 3, .5)} ${circ - len + 3}"
        stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})" stroke-linecap="round"
        data-tip="${s.label} · ${s.value}"/>`;
      off += len;
      return el;
    }).join('');
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thickness}"/>
      ${arcs}
      <text x="${c}" y="${c - 1}" text-anchor="middle" font-size="24" font-weight="800"
        letter-spacing="-.5" fill="var(--text)">${centerTop || total}</text>
      <text x="${c}" y="${c + 16}" text-anchor="middle" font-size="10.5" font-weight="700"
        fill="var(--text-3)">${centerSub}</text>
    </svg>`;
  },

  /* Vertical bars */
  bars(data, { w = 520, h = 200, key = 'v', label = 'd', color = CSS_VAR.brand, fmt = String } = {}) {
    const pad = { t: 18, r: 6, b: 22, l: 6 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const max = Math.max(...data.map(d => d[key])) * 1.16;
    const slot = iw / data.length;
    const bw = Math.min(slot * .5, 34);
    const bars = data.map((d, i) => {
      const x = pad.l + i * slot + (slot - bw) / 2;
      const bh = Math.max((d[key] / max) * ih, 2);
      const y = pad.t + ih - bh;
      return `<g data-tip="${d[label]} · ${fmt(d[key])}" style="cursor:default">
        <rect x="${x - (slot - bw) / 2}" y="${pad.t}" width="${slot}" height="${ih}" fill="transparent"/>
        <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="4" fill="${color}" opacity=".9"/>
        <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-weight="700"
          fill="currentColor" fill-opacity=".6">${d[key]}</text>
        <text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" font-size="10" font-weight="600"
          fill="currentColor" fill-opacity=".45">${d[label]}</text></g>`;
    }).join('');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="color:var(--text)">
      <line x1="${pad.l}" y1="${pad.t + ih + .5}" x2="${w - pad.r}" y2="${pad.t + ih + .5}"
        stroke="currentColor" stroke-opacity=".12"/>${bars}</svg>`;
  },

  /* Horizontal ranked list — rendered as HTML so it wraps cleanly */
  ranked(data, { key = 'count', label = 'name', color = 'var(--brand-500)' } = {}) {
    const max = Math.max(...data.map(d => d[key]));
    return `<div class="col">${data.map(d => `
      <div class="row" style="padding:7px 0">
        <span class="t-sm fw-7 truncate" style="flex:0 0 118px">${d[label]}</span>
        <span class="bar grow"><i style="width:${(d[key] / max) * 100}%;background:${color}"></i></span>
        <b class="t-sm num right" style="flex:0 0 34px">${d[key]}</b>
        <span class="t-xs num faint right" style="flex:0 0 52px">${compact(d.revenue)}</span>
      </div>`).join('')}</div>`;
  },

  /* Sparkline for metric cards */
  spark(vals, color = CSS_VAR.brand, w = 84, h = 30) {
    const max = Math.max(...vals), min = Math.min(...vals);
    const pts = vals.map((v, i) => [
      (i / (vals.length - 1)) * (w - 2) + 1,
      h - 3 - ((v - min) / ((max - min) || 1)) * (h - 8)
    ]);
    const d = pts.reduce((s, p, i) => {
      if (!i) return `M ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      const q = pts[i - 1], cx = (q[0] + p[0]) / 2;
      return `${s} C ${cx.toFixed(1)} ${q[1].toFixed(1)}, ${cx.toFixed(1)} ${p[1].toFixed(1)}, ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    }, '');
    const uid = 's' + (++CHART_SEQ);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".2"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${d} L ${w - 1} ${h} L 1 ${h} Z" fill="url(#${uid})"/>
      <path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/>
    </svg>`;
  }
};

/* ------------------------------------------------------------
   Odontogram tooth glyph
   ------------------------------------------------------------ */
const TOOTH_STATE = {
  healthy:      { fill: 'var(--surface)',  stroke: 'var(--line-2)', label: 'Healthy' },
  caries:       { fill: '#fbd5d5', stroke: '#d33c3c', label: 'Caries' },
  filled:       { fill: '#c9daff', stroke: '#2f6bf0', label: 'Filled' },
  'root-canal': { fill: '#ded3f8', stroke: '#7455d8', label: 'Root Canal' },
  crown:        { fill: '#f8e2b4', stroke: '#c2820b', label: 'Crown' },
  implant:      { fill: '#b6e6d3', stroke: '#0f9d6f', label: 'Implant' },
  missing:      { fill: 'var(--surface-3)', stroke: 'var(--text-3)', label: 'Missing' },
  extract:      { fill: '#f6cccc', stroke: '#a92c2c', label: 'To Extract' },
  planned:      { fill: '#c4ecf2', stroke: '#0e8f9e', label: 'Planned' }
};

/* Roots at the top, occlusal surface at the bottom; the lower arch
   reuses the same outline, mirrored. */
const TOOTH_PATH = 'M4.6 11.5C4.6 6 7.4 2.6 10.6 2.6c2.1 0 3.1 2.6 4.4 2.6s2.3-2.6 4.4-2.6c3.2 0 6 3.4 6 8.9 0 8.4-2.6 15.9-5.6 15.9-2 0-2.2-4.3-4.8-4.3s-2.8 4.3-4.8 4.3c-3 0-5.6-7.5-5.6-15.9Z';
const TOOTH_GROOVE = 'M10.4 20.4c1.5-1.2 3-1.8 4.6-1.8s3.1.6 4.6 1.8';

function toothSVG(state = 'healthy', upper = true) {
  const s = TOOTH_STATE[state] || TOOTH_STATE.healthy;
  const flip = upper ? '' : ' transform="scale(1,-1) translate(0,-30)"';
  const cross = state === 'missing' || state === 'extract'
    ? `<path d="M7 7 23 23M23 7 7 23" stroke="${s.stroke}" stroke-width="2.2" stroke-linecap="round"/>` : '';
  return `<svg viewBox="0 0 30 30">
    <g${flip} opacity="${state === 'missing' ? .5 : 1}">
      <path d="${TOOTH_PATH}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="${TOOTH_GROOVE}" fill="none" stroke="${s.stroke}" stroke-width=".9" stroke-linecap="round" opacity=".45"/>
    </g>${cross}</svg>`;
}
