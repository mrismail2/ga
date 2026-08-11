import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/services/admin';
import { listAppointments } from '@/services/appointments';
import { listPayments, listOutstanding } from '@/services/finance';
import { listMedicineStock } from '@/services/pharmacy';
import { money, isoDate, timeOnly, relative, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar, Badge, Card, EmptyState, PaymentBadge, QueryBoundary, StatCard,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const APPT_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  scheduled: 'muted', confirmed: 'info', checked_in: 'info', waiting: 'warn',
  in_treatment: 'info', completed: 'ok', cancelled: 'danger', no_show: 'danger',
};

export default function Dashboard() {
  const { profile, can } = useAuth();
  const navigate = useNavigate();
  const today = isoDate();

  const summary = useQuery({ queryKey: ['dashboard-summary'], queryFn: getDashboardSummary });
  const appointments = useQuery({
    queryKey: ['appointments', today],
    queryFn: () => listAppointments({ from: today, to: today }),
  });
  const payments = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: () => listPayments({ pageSize: 6 }),
    enabled: can('finance.read'),
  });
  const outstanding = useQuery({
    queryKey: ['outstanding', 'top'],
    queryFn: () => listOutstanding({ pageSize: 6 }),
    enabled: can('finance.read'),
  });
  const stock = useQuery({
    queryKey: ['stock', 'alerts'],
    queryFn: () => listMedicineStock({}),
    enabled: can('pharmacy.read'),
  });

  const s = summary.data;
  const alerts = buildAlerts(s);
  const lowStock = (stock.data ?? []).filter(
    (m) => m.is_active && (m.stock_status === 'low_stock' || m.stock_status === 'out_of_stock' || m.stock_status === 'expiring_soon'),
  );

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Good day, {profile?.full_name?.split(' ')[0]}</h1>
          <p>Everything happening in the clinic today, {new Date().toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.</p>
        </div>
        <div className="page__actions">
          <Link className="btn" to="/queue"><Icon name="queue" /> Patient queue</Link>
          <Link className="btn btn--primary" to="/patients/new"><Icon name="plus" /> Register patient</Link>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="col mb-16" style={{ gap: 8 }}>
          {alerts.map((a) => (
            <div key={a.text} className={`alert tone-${a.tone}`}>
              <Icon name={a.icon} />
              <span className="grow">{a.text}</span>
              {a.to && <Link className="btn btn--sm" to={a.to}>Open</Link>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" icon={<Icon name="patients" />} label="Registered patients"
          value={s ? s.patients_total.toLocaleString() : '—'}
          hint={s ? `${s.patients_today} registered today` : 'Loading…'}
          onClick={() => navigate('/patients')} />
        <StatCard tone="teal" icon={<Icon name="calendar" />} label="Appointments today"
          value={s ? s.appointments_today : '—'}
          hint={s ? `${s.appointments_done} completed · ${s.waiting_now} waiting` : 'Loading…'}
          onClick={() => navigate('/appointments')} />
        <StatCard tone="ok" icon={<Icon name="payment" />} label="Income today"
          value={s ? money(s.treatment_income + s.pharmacy_income) : '—'}
          hint={s ? `Treatments ${money(s.treatment_income)} · Pharmacy ${money(s.pharmacy_income)}` : 'Loading…'} />
        <StatCard tone="danger" icon={<Icon name="balance" />} label="Outstanding balances"
          value={s ? money(s.outstanding_total) : '—'}
          hint={s ? `${s.outstanding_patients} patients · ${s.partial_patients} partial` : 'Loading…'}
          onClick={() => navigate('/outstanding')} />
      </div>

      <div className="grid grid--wide mb-16">
        <Card
          title="Today's appointments"
          subtitle={`${appointments.data?.length ?? 0} scheduled`}
          padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/appointments">View all</Link>}
        >
          <QueryBoundary
            query={appointments}
            empty={<EmptyState title="No appointments today"
              description="Book an appointment or check a walk-in patient straight into the queue."
              action={<Link className="btn btn--sm btn--primary" to="/appointments">Book appointment</Link>} />}
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>Time</th><th>Patient</th><th>Dentist</th><th>Treatment</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => (
                      <tr key={a.id} className="clickable" onClick={() => navigate(`/patients/${a.patient_id}`)}>
                        <td className="bold">{timeOnly(a.scheduled_at)}</td>
                        <td>
                          <div className="cell-user">
                            <Avatar name={a.patient?.full_name ?? '?'} size="sm" />
                            <div>
                              <b>{a.patient?.full_name}</b>
                              <small>{a.patient?.patient_code}</small>
                            </div>
                          </div>
                        </td>
                        <td>{a.dentist?.full_name ?? <span className="faint">Unassigned</span>}</td>
                        <td>{a.treatment_type?.name ?? <span className="faint">—</span>}</td>
                        <td><Badge tone={APPT_TONE[a.status]}>{titleCase(a.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        </Card>

        <Card
          title="Outstanding balances"
          subtitle="Patients still owing money"
          padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/outstanding">View all</Link>}
        >
          {!can('finance.read') ? (
            <EmptyState title="Not available for your role" />
          ) : (
            <QueryBoundary
              query={{ ...outstanding, data: outstanding.data?.rows }}
              empty={<EmptyState title="Nothing outstanding" description="Every treatment is fully paid." />}
            >
              {(rows) => (
                <div className="col">
                  {rows.map((row) => (
                    <Link
                      key={row.treatment_id}
                      to={`/patients/${row.patient_id}`}
                      className="row"
                      style={{ padding: '11px 16px', borderBottom: '1px solid var(--line)' }}
                    >
                      <Avatar name={row.full_name} size="sm" />
                      <div className="grow truncate">
                        <b className="text-sm">{row.full_name}</b>
                        <div className="text-2xs faint truncate">
                          {row.treatment_name} · paid {money(row.amount_paid)} of {money(row.final_cost)}
                        </div>
                      </div>
                      <div className="right">
                        <b className="text-sm danger-text">{money(row.balance)}</b>
                        <div><PaymentBadge status={row.payment_status} /></div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </QueryBoundary>
          )}
        </Card>
      </div>

      <div className="grid grid--2">
        <Card title="Recent payments" subtitle="Latest receipts issued" padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/payments">View all</Link>}>
          {!can('finance.read') ? (
            <EmptyState title="Not available for your role" />
          ) : (
            <QueryBoundary
              query={{ ...payments, data: payments.data?.rows }}
              empty={<EmptyState title="No payments recorded yet" />}
            >
              {(rows) => (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>Receipt</th><th>Patient</th><th>Method</th><th className="right">Amount</th><th>When</th></tr></thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id}>
                          <td className="bold">{p.receipt_number}</td>
                          <td>{p.patient?.full_name}</td>
                          <td>{titleCase(p.method)}</td>
                          <td className="right bold">{money(p.amount)}</td>
                          <td className="faint text-xs">{relative(p.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </QueryBoundary>
          )}
        </Card>

        <Card title="Pharmacy alerts" subtitle="Stock needing attention" padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/pharmacy/medicines">Open pharmacy</Link>}>
          {!can('pharmacy.read') ? (
            <EmptyState title="Not available for your role" />
          ) : (
            <QueryBoundary
              query={{ ...stock, data: lowStock }}
              empty={<EmptyState title="Stock is healthy" description="No medicine is low, out of stock or expiring soon." />}
            >
              {(rows) => (
                <div className="col">
                  {rows.slice(0, 7).map((m) => (
                    <div key={m.medicine_id} className="row"
                      style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
                      <div className="grow truncate">
                        <b className="text-sm">{m.name} {m.strength}</b>
                        <div className="text-2xs faint">
                          {m.usable_quantity} in stock · minimum {m.minimum_stock}
                          {m.earliest_expiry ? ` · expires ${m.earliest_expiry}` : ''}
                        </div>
                      </div>
                      <Badge tone={m.stock_status === 'out_of_stock' ? 'danger'
                        : m.stock_status === 'expiring_soon' ? 'warn' : 'warn'}>
                        {titleCase(m.stock_status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </QueryBoundary>
          )}
        </Card>
      </div>
    </>
  );
}

function buildAlerts(s?: { outstanding_patients: number; outstanding_total: number;
  appointments_today: number; low_stock: number; expiring_soon: number }) {
  if (!s) return [];
  const alerts: { text: string; tone: string; icon: string; to?: string }[] = [];
  if (s.outstanding_patients > 0) {
    alerts.push({
      tone: 'danger', icon: 'balance', to: '/outstanding',
      text: `${s.outstanding_patients} patient${s.outstanding_patients === 1 ? ' has' : 's have'} outstanding balances totalling ${money(s.outstanding_total)}.`,
    });
  }
  if (s.appointments_today > 0) {
    alerts.push({ tone: 'brand', icon: 'calendar', to: '/appointments',
      text: `${s.appointments_today} appointment${s.appointments_today === 1 ? '' : 's'} scheduled today.` });
  }
  if (s.low_stock > 0) {
    alerts.push({ tone: 'warn', icon: 'inventory', to: '/pharmacy/medicines',
      text: `${s.low_stock} medicine${s.low_stock === 1 ? ' is' : 's are'} low or out of stock.` });
  }
  if (s.expiring_soon > 0) {
    alerts.push({ tone: 'warn', icon: 'clock', to: '/pharmacy/medicines',
      text: `${s.expiring_soon} medicine${s.expiring_soon === 1 ? '' : 's'} expiring soon.` });
  }
  return alerts;
}
