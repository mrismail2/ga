import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentReport, patientReport, treatmentReport } from '@/services/admin';
import { financialSummary, incomeByDay, listOutstanding } from '@/services/finance';
import { listMedicineStock } from '@/services/pharmacy';
import { dateOnly, isoDate, money } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Button, Card, EmptyState, Input, QueryBoundary, Skeleton, StatCard, Tabs,
} from '@/components/ui';
import { BarChart, DonutChart, LineChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const PRESETS = [
  { id: 'today', key: 'common.today' },
  { id: 'week', key: 'common.last7' },
  { id: 'month', key: 'common.thisMonth' },
  { id: 'year', key: 'common.thisYear' },
] as const;

function presetRange(id: (typeof PRESETS)[number]['id']) {
  const now = new Date();
  if (id === 'today') return { from: isoDate(now), to: isoDate(now) };
  if (id === 'week') return { from: isoDate(new Date(Date.now() - 6 * 86_400_000)), to: isoDate(now) };
  if (id === 'month') {
    return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
  }
  return { from: isoDate(new Date(now.getFullYear(), 0, 1)), to: isoDate(now) };
}

export default function Reports() {
  const { can } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState('financial');
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('month');
  const initial = presetRange('month');
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  function applyPreset(id: (typeof PRESETS)[number]['id']) {
    setPreset(id);
    const range = presetRange(id);
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('rep.title')}</h1>
          <p>{t('rep.subtitle')} {dateOnly(from)} – {dateOnly(to)}.</p>
        </div>
        <div className="page__actions">
          <Button onClick={() => window.print()}><Icon name="print" /> {t('common.print')}</Button>
        </div>
      </div>

      <Card padded={false} className="mb-16">
        <div className="toolbar">
          <div className="segmented">
            {PRESETS.map((p) => (
              <button key={p.id} className={preset === p.id ? 'is-active' : undefined}
                onClick={() => applyPreset(p.id)}>
                {t(p.key)}
              </button>
            ))}
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Tabs
          tabs={[
            { id: 'financial', label: t('rep.tabFinancial') },
            { id: 'patients', label: t('rep.tabPatients') },
            { id: 'treatments', label: t('rep.tabTreatments') },
            { id: 'appointments', label: t('rep.tabAppointments') },
            { id: 'pharmacy', label: t('rep.tabPharmacy') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Card>

      {tab === 'financial' && <FinancialReport from={from} to={to} />}
      {tab === 'patients' && <PatientsReport from={from} to={to} />}
      {tab === 'treatments' && <TreatmentsReport from={from} to={to} />}
      {tab === 'appointments' && <AppointmentsReport from={from} to={to} />}
      {tab === 'pharmacy' && (can('pharmacy.read')
        ? <PharmacyReport />
        : <EmptyState title={t('rep.notForRole')} />)}
    </>
  );
}

function FinancialReport({ from, to }: { from: string; to: string }) {
  const { t, label } = useI18n();
  const summary = useQuery({
    queryKey: ['financial-summary', from, to], queryFn: () => financialSummary(from, to),
  });
  const series = useQuery({
    queryKey: ['income-by-day', from, to], queryFn: () => incomeByDay(from, to),
  });
  const outstanding = useQuery({
    queryKey: ['outstanding', 'report'], queryFn: () => listOutstanding({ pageSize: 100 }),
  });

  if (summary.isPending) return <Skeleton rows={6} />;
  const s = summary.data!;

  return (
    <>
      <div className="grid grid--4 mb-16">
        <StatCard tone="ok" label={t('rep.grossIncome')} value={money(s.grossIncome)}
          hint={`${t('rep.treatments')} ${money(s.treatmentIncome)} · ${t('rep.pharmacy')} ${money(s.pharmacyIncome)}`} />
        <StatCard tone="warn" label={t('rep.expenses')} value={money(s.expenses)} />
        <StatCard tone="brand" label={t('rep.net')} value={money(s.net)} hint={t('rep.netHint')} />
        <StatCard tone="danger" label={t('rep.outstanding')} value={money(s.outstanding)}
          hint={t('rep.outstandingHint')} />
      </div>

      <div className="grid grid--wide">
        <Card title={t('rep.incomeByDay')} subtitle={t('rep.incomeByDayHint')}>
          <QueryBoundary query={series} empty={<EmptyState title={t('rep.noIncome')} />}>
            {(rows) => (
              <LineChart
                data={rows.map((r) => ({
                  label: r.day.slice(5), a: r.treatment + r.pharmacy, b: r.pharmacy,
                }))}
                labelA={t('rep.totalIncome')}
                labelB={t('rep.pharmacy')}
                height={250}
              />
            )}
          </QueryBoundary>
        </Card>

        <Card title={t('rep.incomeSplit')} subtitle={t('rep.incomeSplitHint')}>
          <DonutChart
            slices={[
              { label: t('rep.treatments'), value: Math.round(s.treatmentIncome), tone: 'brand' },
              { label: t('rep.pharmacy'), value: Math.round(s.pharmacyIncome), tone: 'ok' },
            ]}
            centerValue={money(s.grossIncome)}
            centerLabel={t('rep.gross')}
          />
          <div className="mt-16">
            <div className="row between text-sm"><span className="muted">{t('rep.expenses')}</span>
              <b>{money(s.expenses)}</b></div>
            <div className="row between text-sm mt-8"><span className="muted">{t('rep.net')}</span>
              <b className={s.net >= 0 ? 'ok-text' : 'danger-text'}>{money(s.net)}</b></div>
          </div>
        </Card>
      </div>

      <Card title={t('out.title')} subtitle={t('rep.topOutstanding')} padded={false} className="mt-16">
        <QueryBoundary
          query={{ ...outstanding, data: outstanding.data?.rows }}
          empty={<EmptyState title={t('out.empty')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('common.patient')}</th><th>{t('common.treatment')}</th>
                    <th className="right">{t('common.total')}</th>
                    <th className="right">{t('common.paid')}</th>
                    <th className="right">{t('common.balance')}</th><th>{t('common.status')}</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((r) => (
                    <tr key={r.treatment_id}>
                      <td><b>{r.full_name}</b><div className="text-2xs faint">{r.patient_code}</div></td>
                      <td>{r.treatment_name}</td>
                      <td className="right">{money(r.final_cost)}</td>
                      <td className="right">{money(r.amount_paid)}</td>
                      <td className="right bold danger-text">{money(r.balance)}</td>
                      <td>{label('status', r.payment_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>
      </Card>
    </>
  );
}

function PatientsReport({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const report = useQuery({ queryKey: ['patient-report', from, to], queryFn: () => patientReport(from, to) });
  if (report.isPending) return <Skeleton rows={5} />;
  const r = report.data!;

  return (
    <div className="grid grid--wide">
      <Card title={t('rep.newPatientsByAge')} subtitle={`${r.total} ${t('rep.registeredInPeriod')}`}>
        {r.total === 0
          ? <EmptyState title={t('rep.noNewPatients')} />
          : <BarChart data={r.ageGroups.map((g) => ({ label: g.label, value: g.value }))} height={230} />}
      </Card>
      <Card title={t('rep.genderSplit')}>
        {r.total === 0 ? <EmptyState title={t('rep.noData')} /> : (
          <DonutChart
            slices={[
              { label: t('rep.female'), value: r.female, tone: 'pink' },
              { label: t('rep.male'), value: r.male, tone: 'brand' },
            ]}
            centerValue={String(r.total)}
            centerLabel={t('rep.patients')}
          />
        )}
      </Card>
    </div>
  );
}

function TreatmentsReport({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const report = useQuery({ queryKey: ['treatment-report', from, to], queryFn: () => treatmentReport(from, to) });
  if (report.isPending) return <Skeleton rows={5} />;
  const r = report.data!;

  return (
    <>
      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label={t('rep.treatments')} value={r.total} />
        <StatCard tone="ok" label={t('rep.completed')} value={r.completed} />
        <StatCard tone="warn" label={t('rep.billed')} value={money(r.billed)} />
        <StatCard tone="teal" label={t('rep.collected')} value={money(r.collected)} />
      </div>
      <Card title={t('rep.commonTreatments')} subtitle={t('rep.commonTreatmentsHint')} padded={false}>
        {r.byTreatment.length === 0 ? (
          <EmptyState title={t('rep.noTreatments')} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>{t('common.treatment')}</th>
                <th className="right">{t('rep.count')}</th>
                <th className="right">{t('rep.collected')}</th></tr></thead>
              <tbody>
                {r.byTreatment.map((row) => (
                  <tr key={row.name}>
                    <td><b>{row.name}</b></td>
                    <td className="right">{row.count}</td>
                    <td className="right">{money(row.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function AppointmentsReport({ from, to }: { from: string; to: string }) {
  const { t } = useI18n();
  const report = useQuery({
    queryKey: ['appointment-report', from, to], queryFn: () => appointmentReport(from, to),
  });
  if (report.isPending) return <Skeleton rows={4} />;
  const r = report.data!;

  return (
    <div className="grid grid--wide">
      <Card title={t('rep.outcomes')} subtitle={`${r.total} ${t('rep.inPeriod')}`}>
        {r.total === 0 ? <EmptyState title={t('rep.noAppointments')} /> : (
          <BarChart
            data={[
              { label: t('rep.completed'), value: r.completed },
              { label: t('rep.scheduled'), value: r.scheduled },
              { label: t('rep.cancelled'), value: r.cancelled },
              { label: t('rep.noShow'), value: r.noShow },
            ]}
            height={230}
          />
        )}
      </Card>
      <Card title={t('rep.attendance')}>
        <div className="col" style={{ gap: 10 }}>
          <div className="row between text-sm"><span className="muted">{t('rep.completed')}</span><b>{r.completed}</b></div>
          <div className="row between text-sm"><span className="muted">{t('rep.cancelled')}</span><b>{r.cancelled}</b></div>
          <div className="row between text-sm"><span className="muted">{t('rep.noShow')}</span><b>{r.noShow}</b></div>
          <div className="row between text-sm"><span className="muted">{t('rep.showRate')}</span>
            <b className="ok-text">
              {r.total ? Math.round((r.completed / r.total) * 100) : 0}%
            </b>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PharmacyReport() {
  const { t, label } = useI18n();
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => listMedicineStock({}) });
  if (stock.isPending) return <Skeleton rows={6} />;
  const rows = stock.data ?? [];
  const low = rows.filter((m) => m.stock_status === 'low_stock' || m.stock_status === 'out_of_stock');
  const expiring = rows.filter((m) => m.stock_status === 'expiring_soon');
  const expired = rows.filter((m) => m.expired_quantity > 0);

  return (
    <>
      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label={t('rep.medicines')} value={rows.length} />
        <StatCard tone="warn" label={t('rep.lowOut')} value={low.length} />
        <StatCard tone="danger" label={t('rep.expiringSoon')} value={expiring.length} />
        <StatCard tone="ok" label={t('rep.stockValue')}
          value={money(rows.reduce((t, m) => t + m.usable_quantity * Number(m.purchase_price), 0))} />
      </div>

      <Card title={t('rep.stockAttention')} padded={false}>
        {low.length + expiring.length + expired.length === 0 ? (
          <EmptyState title={t('rep.stockHealthy')} description={t('rep.stockHealthyHint')} />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>{t('rx.medicine')}</th><th className="right">{t('rep.usable')}</th>
                  <th className="right">{t('rep.minimum')}</th>
                  <th className="right">{t('rep.expired')}</th>
                  <th>{t('rep.earliestExpiry')}</th><th>{t('common.status')}</th></tr>
              </thead>
              <tbody>
                {[...low, ...expiring, ...expired.filter((m) => !low.includes(m) && !expiring.includes(m))]
                  .map((m) => (
                    <tr key={m.medicine_id}>
                      <td><b>{m.name}</b> {m.strength}</td>
                      <td className="right">{m.usable_quantity}</td>
                      <td className="right">{m.minimum_stock}</td>
                      <td className="right danger-text">{m.expired_quantity || '—'}</td>
                      <td>{m.earliest_expiry ? dateOnly(m.earliest_expiry) : '—'}</td>
                      <td>{label('status', m.stock_status)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
