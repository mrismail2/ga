import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { appointmentReport, patientReport, treatmentReport } from '@/services/admin';
import { financialSummary, incomeByDay, listOutstanding } from '@/services/finance';
import { listMedicineStock } from '@/services/pharmacy';
import { dateOnly, isoDate, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Button, Card, EmptyState, Input, QueryBoundary, Skeleton, StatCard, Tabs,
} from '@/components/ui';
import { BarChart, DonutChart, LineChart } from '@/components/ui/Charts';
import { Icon } from '@/components/ui/Icon';

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' },
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
          <h1>Reports</h1>
          <p>Clinical and financial analysis for {dateOnly(from)} – {dateOnly(to)}.</p>
        </div>
        <div className="page__actions">
          <Button onClick={() => window.print()}><Icon name="print" /> Print</Button>
        </div>
      </div>

      <Card padded={false} className="mb-16">
        <div className="toolbar">
          <div className="segmented">
            {PRESETS.map((p) => (
              <button key={p.id} className={preset === p.id ? 'is-active' : undefined}
                onClick={() => applyPreset(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Tabs
          tabs={[
            { id: 'financial', label: 'Financial' },
            { id: 'patients', label: 'Patients' },
            { id: 'treatments', label: 'Treatments' },
            { id: 'appointments', label: 'Appointments' },
            { id: 'pharmacy', label: 'Pharmacy' },
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
        : <EmptyState title="Pharmacy reports are not available for your role" />)}
    </>
  );
}

function FinancialReport({ from, to }: { from: string; to: string }) {
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
        <StatCard tone="ok" label="Gross income" value={money(s.grossIncome)}
          hint={`Treatments ${money(s.treatmentIncome)} · Pharmacy ${money(s.pharmacyIncome)}`} />
        <StatCard tone="warn" label="Expenses" value={money(s.expenses)} />
        <StatCard tone="brand" label="Net" value={money(s.net)} hint="Income minus expenses" />
        <StatCard tone="danger" label="Outstanding" value={money(s.outstanding)}
          hint="Still owed by patients" />
      </div>

      <div className="grid grid--wide">
        <Card title="Income by day" subtitle="Treatment payments and pharmacy sales">
          <QueryBoundary query={series} empty={<EmptyState title="No income in this period" />}>
            {(rows) => (
              <LineChart
                data={rows.map((r) => ({
                  label: r.day.slice(5), a: r.treatment + r.pharmacy, b: r.pharmacy,
                }))}
                labelA="Total income"
                labelB="Pharmacy"
                height={250}
              />
            )}
          </QueryBoundary>
        </Card>

        <Card title="Income split" subtitle="Where the money came from">
          <DonutChart
            slices={[
              { label: 'Treatments', value: Math.round(s.treatmentIncome), tone: 'brand' },
              { label: 'Pharmacy', value: Math.round(s.pharmacyIncome), tone: 'ok' },
            ]}
            centerValue={money(s.grossIncome)}
            centerLabel="Gross"
          />
          <div className="mt-16">
            <div className="row between text-sm"><span className="muted">Expenses</span>
              <b>{money(s.expenses)}</b></div>
            <div className="row between text-sm mt-8"><span className="muted">Net</span>
              <b className={s.net >= 0 ? 'ok-text' : 'danger-text'}>{money(s.net)}</b></div>
          </div>
        </Card>
      </div>

      <Card title="Outstanding balances" subtitle="Top unpaid treatments" padded={false} className="mt-16">
        <QueryBoundary
          query={{ ...outstanding, data: outstanding.data?.rows }}
          empty={<EmptyState title="Nothing outstanding" />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Patient</th><th>Treatment</th><th className="right">Total</th>
                    <th className="right">Paid</th><th className="right">Balance</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((r) => (
                    <tr key={r.treatment_id}>
                      <td><b>{r.full_name}</b><div className="text-2xs faint">{r.patient_code}</div></td>
                      <td>{r.treatment_name}</td>
                      <td className="right">{money(r.final_cost)}</td>
                      <td className="right">{money(r.amount_paid)}</td>
                      <td className="right bold danger-text">{money(r.balance)}</td>
                      <td>{titleCase(r.payment_status)}</td>
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
  const report = useQuery({ queryKey: ['patient-report', from, to], queryFn: () => patientReport(from, to) });
  if (report.isPending) return <Skeleton rows={5} />;
  const r = report.data!;

  return (
    <div className="grid grid--wide">
      <Card title="New patients by age" subtitle={`${r.total} registered in this period`}>
        {r.total === 0
          ? <EmptyState title="No new patients in this period" />
          : <BarChart data={r.ageGroups.map((g) => ({ label: g.label, value: g.value }))} height={230} />}
      </Card>
      <Card title="Gender split">
        {r.total === 0 ? <EmptyState title="No data" /> : (
          <DonutChart
            slices={[
              { label: 'Female', value: r.female, tone: 'pink' },
              { label: 'Male', value: r.male, tone: 'brand' },
            ]}
            centerValue={String(r.total)}
            centerLabel="Patients"
          />
        )}
      </Card>
    </div>
  );
}

function TreatmentsReport({ from, to }: { from: string; to: string }) {
  const report = useQuery({ queryKey: ['treatment-report', from, to], queryFn: () => treatmentReport(from, to) });
  if (report.isPending) return <Skeleton rows={5} />;
  const r = report.data!;

  return (
    <>
      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label="Treatments" value={r.total} />
        <StatCard tone="ok" label="Completed" value={r.completed} />
        <StatCard tone="warn" label="Billed" value={money(r.billed)} />
        <StatCard tone="teal" label="Collected" value={money(r.collected)} />
      </div>
      <Card title="Most common treatments" subtitle="By number performed" padded={false}>
        {r.byTreatment.length === 0 ? (
          <EmptyState title="No treatments in this period" />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Treatment</th><th className="right">Count</th><th className="right">Collected</th></tr></thead>
              <tbody>
                {r.byTreatment.map((t) => (
                  <tr key={t.name}>
                    <td><b>{t.name}</b></td>
                    <td className="right">{t.count}</td>
                    <td className="right">{money(t.revenue)}</td>
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
  const report = useQuery({
    queryKey: ['appointment-report', from, to], queryFn: () => appointmentReport(from, to),
  });
  if (report.isPending) return <Skeleton rows={4} />;
  const r = report.data!;

  return (
    <div className="grid grid--wide">
      <Card title="Appointment outcomes" subtitle={`${r.total} appointments in this period`}>
        {r.total === 0 ? <EmptyState title="No appointments in this period" /> : (
          <BarChart
            data={[
              { label: 'Completed', value: r.completed },
              { label: 'Scheduled', value: r.scheduled },
              { label: 'Cancelled', value: r.cancelled },
              { label: 'No show', value: r.noShow },
            ]}
            height={230}
          />
        )}
      </Card>
      <Card title="Attendance">
        <div className="col" style={{ gap: 10 }}>
          <div className="row between text-sm"><span className="muted">Completed</span><b>{r.completed}</b></div>
          <div className="row between text-sm"><span className="muted">Cancelled</span><b>{r.cancelled}</b></div>
          <div className="row between text-sm"><span className="muted">No show</span><b>{r.noShow}</b></div>
          <div className="row between text-sm"><span className="muted">Show rate</span>
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
  const stock = useQuery({ queryKey: ['stock'], queryFn: () => listMedicineStock({}) });
  if (stock.isPending) return <Skeleton rows={6} />;
  const rows = stock.data ?? [];
  const low = rows.filter((m) => m.stock_status === 'low_stock' || m.stock_status === 'out_of_stock');
  const expiring = rows.filter((m) => m.stock_status === 'expiring_soon');
  const expired = rows.filter((m) => m.expired_quantity > 0);

  return (
    <>
      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" label="Medicines" value={rows.length} />
        <StatCard tone="warn" label="Low / out of stock" value={low.length} />
        <StatCard tone="danger" label="Expiring soon" value={expiring.length} />
        <StatCard tone="ok" label="Stock value"
          value={money(rows.reduce((t, m) => t + m.usable_quantity * Number(m.purchase_price), 0))} />
      </div>

      <Card title="Stock needing attention" padded={false}>
        {low.length + expiring.length + expired.length === 0 ? (
          <EmptyState title="Stock is healthy" description="Nothing is low, expiring or expired." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Medicine</th><th className="right">Usable</th><th className="right">Minimum</th>
                  <th className="right">Expired</th><th>Earliest expiry</th><th>Status</th></tr>
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
                      <td>{titleCase(m.stock_status)}</td>
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
