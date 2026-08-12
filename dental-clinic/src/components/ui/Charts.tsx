import { useEffect, useRef, useState } from 'react';
import { money } from '@/lib/format';
import { useI18n } from '@/i18n';

/** Measures the container so charts are drawn at real pixel size (crisp labels). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface SeriesPoint { label: string; a: number; b?: number }

export function LineChart({
  data, height = 220, format = money, labelA = 'Series A', labelB,
}: { data: SeriesPoint[]; height?: number; format?: (n: number) => string; labelA?: string; labelB?: string }) {
  const { t: translate } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  if (!data.length) return <div ref={ref} className="chart chart--empty">{translate('rep.noData')}</div>;

  const pad = { t: 14, r: 10, b: 26, l: 54 };
  const w = Math.max(width, 280);
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const values = data.flatMap((d) => (d.b != null ? [d.a, d.b] : [d.a]));
  const hi = Math.max(...values, 1);
  const max = hi * 1.15;
  const x = (i: number) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  const path = (key: 'a' | 'b') =>
    data.reduce((d, point, i) => {
      const value = key === 'a' ? point.a : point.b ?? 0;
      if (!i) return `M ${x(i)} ${y(value)}`;
      const prev = key === 'a' ? data[i - 1].a : data[i - 1].b ?? 0;
      const cx = (x(i - 1) + x(i)) / 2;
      return `${d} C ${cx} ${y(prev)}, ${cx} ${y(value)}, ${x(i)} ${y(value)}`;
    }, '');

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const step = data.length > 12 ? Math.ceil(data.length / 8) : 1;

  return (
    <div ref={ref} className="chart">
      <svg width={w} height={height} role="img" aria-label={`${labelA} over time`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} y1={pad.t + ih * t} x2={w - pad.r} y2={pad.t + ih * t}
                  className="chart__grid" />
            <text x={pad.l - 8} y={pad.t + ih * t + 4} textAnchor="end" className="chart__axis">
              {format(max * (1 - t))}
            </text>
          </g>
        ))}
        <path d={`${path('a')} L ${x(data.length - 1)} ${pad.t + ih} L ${pad.l} ${pad.t + ih} Z`}
              className="chart__area" />
        <path d={path('a')} className="chart__line" />
        {labelB && <path d={path('b')} className="chart__line chart__line--b" />}
        {data.map((d, i) => (
          <circle key={d.label} cx={x(i)} cy={y(d.a)} r={3} className="chart__dot">
            <title>{`${d.label}: ${format(d.a)}`}</title>
          </circle>
        ))}
        {data.map((d, i) => (i % step === 0 ? (
          <text key={d.label} x={x(i)} y={height - 8} textAnchor="middle" className="chart__axis">
            {d.label}
          </text>
        ) : null))}
      </svg>
    </div>
  );
}

export function BarChart({
  data, height = 200, format = (n: number) => String(n),
}: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) {
  const { t: translate } = useI18n();
  const [ref, width] = useWidth<HTMLDivElement>();
  if (!data.length) return <div ref={ref} className="chart chart--empty">{translate('rep.noData')}</div>;

  const pad = { t: 20, r: 6, b: 24, l: 6 };
  const w = Math.max(width, 240);
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;
  const max = Math.max(...data.map((d) => d.value), 1) * 1.18;
  const slot = iw / data.length;
  const bw = Math.min(slot * 0.55, 40);

  return (
    <div ref={ref} className="chart">
      <svg width={w} height={height}>
        <line x1={pad.l} y1={pad.t + ih} x2={w - pad.r} y2={pad.t + ih} className="chart__grid" />
        {data.map((d, i) => {
          const bh = Math.max((d.value / max) * ih, 2);
          const bx = pad.l + i * slot + (slot - bw) / 2;
          return (
            <g key={d.label}>
              <rect x={bx} y={pad.t + ih - bh} width={bw} height={bh} rx={4} className="chart__bar">
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              <text x={bx + bw / 2} y={pad.t + ih - bh - 6} textAnchor="middle" className="chart__axis">
                {d.value}
              </text>
              <text x={bx + bw / 2} y={height - 7} textAnchor="middle" className="chart__axis">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function DonutChart({
  slices, size = 160, centerLabel, centerValue,
}: {
  slices: { label: string; value: number; tone: string }[];
  size?: number; centerLabel?: string; centerValue?: string;
}) {
  const total = slices.reduce((t, s) => t + s.value, 0);
  const r = (size - 22) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="donut">
      <svg width={size} height={size}>
        <circle cx={c} cy={c} r={r} className="donut__track" strokeWidth={22} fill="none" />
        {total > 0 && slices.map((s) => {
          const len = (s.value / total) * circ;
          const el = (
            <circle
              key={s.label} cx={c} cy={c} r={r} fill="none" strokeWidth={22}
              className={`donut__slice tone-${s.tone}`}
              strokeDasharray={`${Math.max(len - 2, 0)} ${circ - len + 2}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${c} ${c})`}
            >
              <title>{`${s.label}: ${s.value}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x={c} y={c - 1} textAnchor="middle" className="donut__value">{centerValue ?? total}</text>
        <text x={c} y={c + 16} textAnchor="middle" className="donut__label">{centerLabel}</text>
      </svg>
      <ul className="donut__legend">
        {slices.map((s) => (
          <li key={s.label}>
            <i className={`tone-${s.tone}`} />{s.label}<b>{s.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
