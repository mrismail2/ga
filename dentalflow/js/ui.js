/* DentalFlow Pro — icons, charts and small UI helpers (no external libs) */

/* ---------------- Icons ---------------- */
const ICON_PATHS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  patients: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  dentist: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  chair: '<path d="M5 4h4l1 8H6a2 2 0 0 1-2-2V6a2 2 0 0 1 1-2Z"/><path d="M10 12h6a3 3 0 0 1 3 3v1a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3v-4Z"/><path d="M12 19v3"/>',
  treatment: '<path d="m14.5 3.5 6 6-9 9H5.5v-6z"/><path d="M13 5 19 11"/>',
  tooth: '<path d="M12 3c-2 0-2.6 1-4.2 1C5.6 4 4 5.7 4 8.4c0 3 1.2 4.6 1.8 7 .5 2 .6 5.6 2.2 5.6 1.7 0 1.3-4.4 4-4.4s2.3 4.4 4 4.4c1.6 0 1.7-3.6 2.2-5.6.6-2.4 1.8-4 1.8-7C20 5.7 18.4 4 16.2 4 14.6 4 14 3 12 3Z"/>',
  xray: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18M3 12h18M7.5 7.5 16.5 16.5M16.5 7.5 7.5 16.5"/>',
  rx: '<path d="M5 20V4h4a3 3 0 0 1 0 6H5"/><path d="m9 10 8 10M17 10l-8 10"/>',
  lab: '<path d="M9 3v6.5L4.2 18A2 2 0 0 0 6 21h12a2 2 0 0 0 1.8-3L15 9.5V3"/><path d="M8 3h8M7.5 14h9"/>',
  invoice: '<path d="M14 2H7a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 3-2V8Z"/><path d="M14 2v6h5M9 12h6M9 16h4"/>',
  payment: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  inventory: '<path d="m3 8 9-5 9 5v8l-9 5-9-5Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  staff: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  reports: '<path d="M3 3v18h18"/><path d="m7 15 4-5 3 3 5-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H1a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 2.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 7 2.6h.1A1.7 1.7 0 0 0 9 1V1a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 2.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dollar: '<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  trendUp: '<path d="m3 17 6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  trendDown: '<path d="m3 7 6 6 4-4 8 8"/><path d="M17 17h4v-4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M11 4H4v16h16v-7"/><path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5h20v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 6 10-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 8 5-5 5 5M12 3v12"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M14 9h4a2 2 0 0 1 2 2v10M2 21h20M8 7h2M8 11h2M8 15h2"/>',
  star: '<path d="m12 2 3 6.5 7 1-5 4.9 1.2 7L12 18l-6.2 3.4L7 14.4 2 9.5l7-1Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'
};

function icon(name, cls = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.dashboard;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
}

/* ---------------- Charts (hand-rolled SVG) ---------------- */
const Chart = {
  /* Smooth area + line chart */
  area(data, { w = 720, h = 230, key = 'v', label = 'm', color = '#2563eb', color2 = '#22d3ee', money = true, second = null } = {}) {
    const pad = { t: 18, r: 14, b: 28, l: 46 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const vals = data.map(d => d[key]).concat(second ? data.map(d => d[second.key]) : []);
    const max = Math.max(...vals) * 1.12, min = Math.min(...vals) * 0.82;
    const X = i => pad.l + (i / (data.length - 1)) * iw;
    const Y = v => pad.t + ih - ((v - min) / (max - min)) * ih;
    const pts = data.map((d, i) => [X(i), Y(d[key])]);

    let line = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const cx = (x0 + x1) / 2;
      line += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
    }
    const area = `${line} L ${pts[pts.length - 1][0]} ${pad.t + ih} L ${pts[0][0]} ${pad.t + ih} Z`;
    const uid = 'g' + Math.random().toString(36).slice(2, 7);

    const gridlines = [0, .25, .5, .75, 1].map(f => {
      const y = pad.t + ih * f;
      const v = max - (max - min) * f;
      return `<line x1="${pad.l}" y1="${y}" x2="${w - pad.r}" y2="${y}" stroke="currentColor" stroke-opacity=".12" stroke-dasharray="4 5"/>
              <text x="${pad.l - 9}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="currentColor" fill-opacity=".45" font-weight="600">${money ? '$' + Math.round(v / 1000) + 'K' : Math.round(v)}</text>`;
    }).join('');

    const dots = pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3.2}"
        fill="${i === pts.length - 1 ? color : 'var(--surface)'}" stroke="${color}" stroke-width="2.4"/>`).join('');
    const labels = data.map((d, i) => `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" font-size="10.5"
        fill="currentColor" fill-opacity=".5" font-weight="700">${d[label]}</text>`).join('');

    /* optional comparison series — line only, no fill */
    let secondLayer = '';
    if (second) {
      const p2 = data.map((d, i) => [X(i), Y(d[second.key])]);
      let l2 = `M ${p2[0][0]} ${p2[0][1]}`;
      for (let i = 0; i < p2.length - 1; i++) {
        const [x0, y0] = p2[i], [x1, y1] = p2[i + 1], cx = (x0 + x1) / 2;
        l2 += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
      }
      secondLayer = `<path d="${l2}" fill="none" stroke="${second.color}" stroke-width="2.4"
          stroke-dasharray="7 6" stroke-linecap="round"/>
        ${p2.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="var(--surface)" stroke="${second.color}" stroke-width="2"/>`).join('')}`;
    }

    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;max-height:${h * 1.3}px;color:var(--text)" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".34"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="${uid}s" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="${color2}"/>
        </linearGradient>
      </defs>
      ${gridlines}
      <path d="${area}" fill="url(#${uid})"/>
      <path d="${line}" fill="none" stroke="url(#${uid}s)" stroke-width="3" stroke-linecap="round"/>
      ${secondLayer}${dots}${labels}
    </svg>`;
  },

  /* Donut with center total */
  donut(slices, { size = 190, thickness = 26, centerTop = '', centerSub = '' } = {}) {
    const total = slices.reduce((s, x) => s + x.value, 0) || 1;
    const r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = slices.map(s => {
      const len = (s.value / total) * circ;
      const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${s.color}"
        stroke-width="${thickness}" stroke-dasharray="${len - 2.5} ${circ - len + 2.5}"
        stroke-dashoffset="${-offset}" stroke-linecap="round"
        transform="rotate(-90 ${c} ${c})"/>`;
      offset += len;
      return el;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" style="width:${size}px;height:${size}px;max-width:100%">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".08" stroke-width="${thickness}"/>
      ${arcs}
      <text x="${c}" y="${c - 2}" text-anchor="middle" font-size="27" font-weight="800" fill="var(--text)">${centerTop || total}</text>
      <text x="${c}" y="${c + 18}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-3)">${centerSub}</text>
    </svg>`;
  },

  /* Vertical bars */
  bars(data, { w = 560, h = 200, key = 'v', label = 'd', color = '#2563eb', color2 = '#22d3ee' } = {}) {
    const pad = { t: 14, r: 8, b: 26, l: 30 };
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const max = Math.max(...data.map(d => d[key])) * 1.15;
    const bw = (iw / data.length) * 0.52;
    const uid = 'b' + Math.random().toString(36).slice(2, 7);
    const bars = data.map((d, i) => {
      const x = pad.l + (i + 0.5) * (iw / data.length) - bw / 2;
      const bh = (d[key] / max) * ih;
      const y = pad.t + ih - bh;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="url(#${uid})"/>
        <text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" font-size="10.5" font-weight="800"
          fill="currentColor" fill-opacity=".65">${d[key]}</text>
        <text x="${x + bw / 2}" y="${h - 7}" text-anchor="middle" font-size="10.5" font-weight="700"
          fill="currentColor" fill-opacity=".5">${d[label]}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;color:var(--text)">
      <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color2}"/><stop offset="100%" stop-color="${color}"/>
      </linearGradient></defs>
      <line x1="${pad.l}" y1="${pad.t + ih}" x2="${w - pad.r}" y2="${pad.t + ih}" stroke="currentColor" stroke-opacity=".14"/>
      ${bars}</svg>`;
  },

  /* Horizontal ranked bars */
  ranked(data, { key = 'count', label = 'name', color = '#2563eb' } = {}) {
    const max = Math.max(...data.map(d => d[key]));
    return data.map(d => `
      <div style="display:flex;align-items:center;gap:12px;padding:9px 0">
        <span style="flex:0 0 132px;font-size:12.6px;font-weight:700">${d[label]}</span>
        <span class="bar" style="flex:1 1 auto;height:9px">
          <i style="width:${(d[key] / max) * 100}%;background:linear-gradient(90deg,${color},var(--cyan-400))"></i>
        </span>
        <b class="mono" style="flex:0 0 42px;text-align:right;font-size:12.6px">${d[key]}</b>
        <span class="muted mono" style="flex:0 0 62px;text-align:right;font-size:12px">$${(d.revenue / 1000).toFixed(1)}K</span>
      </div>`).join('');
  },

  /* Tiny sparkline */
  spark(vals, color = '#2563eb', w = 110, h = 34) {
    const max = Math.max(...vals), min = Math.min(...vals);
    const pts = vals.map((v, i) => [
      (i / (vals.length - 1)) * w,
      h - 3 - ((v - min) / ((max - min) || 1)) * (h - 6)
    ]);
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" style="width:${w}px;height:${h}px">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
};

/* ---------------- Tooth glyph for the odontogram ---------------- */
const TOOTH_STATE = {
  healthy:     { fill: '#ffffff', stroke: '#b9c8e0', label: 'Healthy' },
  caries:      { fill: '#fca5a5', stroke: '#ef4444', label: 'Caries' },
  filled:      { fill: '#93c5fd', stroke: '#2563eb', label: 'Filled' },
  'root-canal':{ fill: '#c4b5fd', stroke: '#8b5cf6', label: 'Root Canal' },
  crown:       { fill: '#fcd34d', stroke: '#f59e0b', label: 'Crown' },
  implant:     { fill: '#6ee7b7', stroke: '#10b981', label: 'Implant' },
  missing:     { fill: '#e5e7eb', stroke: '#9ca3af', label: 'Missing' },
  extract:     { fill: '#fecaca', stroke: '#b91c1c', label: 'To Extract' },
  planned:     { fill: '#a5f3fc', stroke: '#06b6d4', label: 'Planned' }
};

/* One tooth outline — roots at the top, occlusal cusps at the bottom.
   The lower arch reuses the same path, mirrored vertically. */
const TOOTH_PATH = 'M4.6 11.5C4.6 6 7.4 2.6 10.6 2.6c2.1 0 3.1 2.6 4.4 2.6s2.3-2.6 4.4-2.6c3.2 0 6 3.4 6 8.9 0 8.4-2.6 15.9-5.6 15.9-2 0-2.2-4.3-4.8-4.3s-2.8 4.3-4.8 4.3c-3 0-5.6-7.5-5.6-15.9Z';
const TOOTH_GROOVE = 'M10.4 20.4c1.5-1.2 3-1.8 4.6-1.8s3.1.6 4.6 1.8';

function toothSVG(state = 'healthy', upper = true) {
  const s = TOOTH_STATE[state] || TOOTH_STATE.healthy;
  const flip = upper ? '' : ' transform="scale(1,-1) translate(0,-30)"';
  const cross = state === 'missing' || state === 'extract'
    ? `<path d="M7 7 L23 23 M23 7 L7 23" stroke="${s.stroke}" stroke-width="2.4" stroke-linecap="round"/>` : '';
  return `<svg viewBox="0 0 30 30">
    <g${flip} opacity="${state === 'missing' ? .45 : 1}">
      <path d="${TOOTH_PATH}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="${TOOTH_GROOVE}" fill="none" stroke="${s.stroke}" stroke-width="1" stroke-linecap="round" opacity=".5"/>
    </g>${cross}</svg>`;
}

/* ---------------- Helpers ---------------- */
const money = n => '$' + Number(n).toLocaleString('en-US');
const TITLES = ['dr.', 'dr', 'mr.', 'mrs.', 'ms.', 'prof.'];
const initialsOf = n => n.split(' ')
  .filter(w => w && !TITLES.includes(w.toLowerCase()))
  .map(w => w[0]).slice(0, 2).join('').toUpperCase();

function avatar(name, color, cls = '') {
  return `<span class="avatar ${cls}" style="background:linear-gradient(135deg,${color},${shade(color, -28)})">${initialsOf(name)}</span>`;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map(v => Math.max(0, Math.min(255, v + amt)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const STATUS_CHIP = {
  Confirmed: 'ok', Completed: 'ok', Paid: 'ok', Success: 'ok', Delivered: 'ok', Active: 'ok', 'On Duty': 'ok', Available: 'ok',
  'In Progress': 'info', Ongoing: 'info', Partial: 'info', 'In Use': 'info', New: 'info',
  Upcoming: 'warn', Pending: 'warn', 'Follow-up': 'warn', Maintenance: 'warn', Leave: 'warn', Unpaid: 'warn',
  Cancelled: 'danger', Overdue: 'danger', Failed: 'danger', Inactive: 'muted', 'Off Duty': 'muted'
};
const chip = (txt, tone) => `<span class="chip chip--${tone || STATUS_CHIP[txt] || 'muted'}"><i></i>${txt}</span>`;
