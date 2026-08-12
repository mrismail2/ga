import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboardSummary } from '@/services/admin';
import { listAppointments } from '@/services/appointments';
import { listPayments, listOutstanding } from '@/services/finance';
import { listMedicineStock } from '@/services/pharmacy';
import { money, isoDate, timeOnly, relative, firstName, longDate } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  Avatar, Badge, Card, EmptyState, PaymentBadge, QueryBoundary, StatCard,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n';

const APPT_TONE: Record<string, 'ok' | 'warn' | 'danger' | 'info' | 'muted'> = {
  scheduled: 'muted', confirmed: 'info', checked_in: 'info', waiting: 'warn',
  in_treatment: 'info', completed: 'ok', cancelled: 'danger', no_show: 'danger',
};

export default function Dashboard() {
  const { profile, can } = useAuth();
  const { t, label } = useI18n();
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
  const alerts = buildAlerts(t, s);
  const lowStock = (stock.data ?? []).filter(
    (m) => m.is_active && (m.stock_status === 'low_stock' || m.stock_status === 'out_of_stock' || m.stock_status === 'expiring_soon'),
  );

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('dash.greeting')}, {firstName(profile?.full_name)}</h1>
          <p>{t('dash.subtitle')}, {longDate(new Date())}.</p>
        </div>
        <div className="page__actions">
          <Link className="btn" to="/queue"><Icon name="queue" /> {t('nav.queue')}</Link>
          <Link className="btn btn--primary" to="/patients/new"><Icon name="plus" /> {t('dash.registerPatient')}</Link>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="col mb-16" style={{ gap: 8 }}>
          {alerts.map((a) => (
            <div key={a.text} className={`alert tone-${a.tone}`}>
              <Icon name={a.icon} />
              <span className="grow">{a.text}</span>
              {a.to && <Link className="btn btn--sm" to={a.to}>{t('common.open')}</Link>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid--4 mb-16">
        <StatCard tone="brand" icon={<Icon name="patients" />} label={t('dash.statPatients')}
          value={s ? s.patients_total.toLocaleString() : '—'}
          hint={s ? `${s.patients_today} ${t('dash.statPatientsHint')}` : t('common.loading')}
          onClick={() => navigate('/patients')} />
        <StatCard tone="teal" icon={<Icon name="calendar" />} label={t('dash.statAppointments')}
          value={s ? s.appointments_today : '—'}
          hint={s ? `${s.appointments_done} ${t('dash.statAppointmentsHint')} · ${s.waiting_now} ${t('dash.statWaiting')}` : t('common.loading')}
          onClick={() => navigate('/appointments')} />
        <StatCard tone="ok" icon={<Icon name="payment" />} label={t('dash.statIncome')}
          value={s ? money(s.treatment_income + s.pharmacy_income) : '—'}
          hint={s ? `${t('dash.statTreatments')} ${money(s.treatment_income)} · ${t('dash.statPharmacy')} ${money(s.pharmacy_income)}` : t('common.loading')} />
        <StatCard tone="danger" icon={<Icon name="balance" />} label={t('dash.statOutstanding')}
          value={s ? money(s.outstanding_total) : '—'}
          hint={s ? `${s.outstanding_patients} ${t('dash.statOutstandingHint')} · ${s.partial_patients} ${t('dash.statPartial')}` : t('common.loading')}
          onClick={() => navigate('/outstanding')} />
      </div>

      <div className="grid grid--wide mb-16">
        <Card
          title={t('dash.todayAppointments')}
          subtitle={`${appointments.data?.length ?? 0} ${t('dash.scheduled')}`}
          padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/appointments">{t('common.viewAll')}</Link>}
        >
          <QueryBoundary
            query={appointments}
            empty={<EmptyState title={t('dash.noAppointments')}
              description={t('dash.noAppointmentsHint')}
              action={<Link className="btn btn--sm btn--primary" to="/appointments">{t('dash.bookAppointment')}</Link>} />}
          >
            {(rows) => (
              <div className="table-wrap">
                <table className="tbl">
                  <thead>
                    <tr><th>{t('common.time')}</th><th>{t('common.patient')}</th><th>{t('common.dentist')}</th>
                      <th>{t('common.treatment')}</th><th>{t('common.status')}</th></tr>
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
                        <td>{a.dentist?.full_name ?? <span className="faint">{t('common.unassigned')}</span>}</td>
                        <td>{a.treatment_type?.name ?? <span className="faint">—</span>}</td>
                        <td><Badge tone={APPT_TONE[a.status]}>{label('status', a.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryBoundary>
        </Card>

        <Card
          title={t('dash.outstanding')}
          subtitle={t('dash.outstandingHint')}
          padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/outstanding">{t('common.viewAll')}</Link>}
        >
          {!can('finance.read') ? (
            <EmptyState title={t('access.notForRole')} />
          ) : (
            <QueryBoundary
              query={{ ...outstanding, data: outstanding.data?.rows }}
              empty={<EmptyState title={t('dash.nothingOutstanding')} description={t('dash.nothingOutstandingHint')} />}
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
                          {row.treatment_name} · {money(row.amount_paid)} / {money(row.final_cost)}
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
        <Card title={t('dash.recentPayments')} subtitle={t('dash.recentPaymentsHint')} padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/payments">{t('common.viewAll')}</Link>}>
          {!can('finance.read') ? (
            <EmptyState title={t('access.notForRole')} />
          ) : (
            <QueryBoundary
              query={{ ...payments, data: payments.data?.rows }}
              empty={<EmptyState title={t('dash.noPayments')} />}
            >
              {(rows) => (
                <div className="table-wrap">
                  <table className="tbl">
                    <thead><tr><th>{t('common.receipt')}</th><th>{t('common.patient')}</th><th>{t('common.method')}</th>
                      <th className="right">{t('common.amount')}</th><th>{t('common.when')}</th></tr></thead>
                    <tbody>
                      {rows.map((p) => (
                        <tr key={p.id}>
                          <td className="bold">{p.receipt_number}</td>
                          <td>{p.patient?.full_name}</td>
                          <td>{label('method', p.method)}</td>
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

        <Card title={t('dash.pharmacyAlerts')} subtitle={t('dash.pharmacyAlertsHint')} padded={false}
          actions={<Link className="btn btn--sm btn--ghost" to="/pharmacy/medicines">{t('dash.openPharmacy')}</Link>}>
          {!can('pharmacy.read') ? (
            <EmptyState title={t('access.notForRole')} />
          ) : (
            <QueryBoundary
              query={{ ...stock, data: lowStock }}
              empty={<EmptyState title={t('dash.stockHealthy')} description={t('dash.stockHealthyHint')} />}
            >
              {(rows) => (
                <div className="col">
                  {rows.slice(0, 7).map((m) => (
                    <div key={m.medicine_id} className="row"
                      style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
                      <div className="grow truncate">
                        <b className="text-sm">{m.name} {m.strength}</b>
                        <div className="text-2xs faint">
                          {m.usable_quantity} {t('dash.inStock')} · {t('dash.minimum')} {m.minimum_stock}
                          {m.earliest_expiry ? ` · ${t('dash.expires')} ${m.earliest_expiry}` : ''}
                        </div>
                      </div>
                      <Badge tone={m.stock_status === 'out_of_stock' ? 'danger'
                        : m.stock_status === 'expiring_soon' ? 'warn' : 'warn'}>
                        {label('status', m.stock_status)}
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

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

function buildAlerts(t: Translate, s?: { outstanding_patients: number; outstanding_total: number;
  appointments_today: number; low_stock: number; expiring_soon: number }) {
  if (!s) return [];
  const alerts: { text: string; tone: string; icon: string; to?: string }[] = [];
  const one = (n: number, singular: TranslationKey, plural: TranslationKey) =>
    t(n === 1 ? singular : plural);

  if (s.outstanding_patients > 0) {
    alerts.push({
      tone: 'danger', icon: 'balance', to: '/outstanding',
      text: `${s.outstanding_patients} ${one(s.outstanding_patients, 'dash.alertOutstandingOne', 'dash.alertOutstanding')} ${money(s.outstanding_total)}.`,
    });
  }
  if (s.appointments_today > 0) {
    alerts.push({ tone: 'brand', icon: 'calendar', to: '/appointments',
      text: `${s.appointments_today} ${one(s.appointments_today, 'dash.alertAppointmentsOne', 'dash.alertAppointments')}` });
  }
  if (s.low_stock > 0) {
    alerts.push({ tone: 'warn', icon: 'inventory', to: '/pharmacy/medicines',
      text: `${s.low_stock} ${one(s.low_stock, 'dash.alertLowStockOne', 'dash.alertLowStock')}` });
  }
  if (s.expiring_soon > 0) {
    alerts.push({ tone: 'warn', icon: 'clock', to: '/pharmacy/medicines',
      text: `${s.expiring_soon} ${one(s.expiring_soon, 'dash.alertExpiringOne', 'dash.alertExpiring')}` });
  }
  return alerts;
}
