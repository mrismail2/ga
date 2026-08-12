import { useQuery } from '@tanstack/react-query';
import { getPatient } from '@/services/patients';
import { listTreatmentBalances } from '@/services/clinical';
import { listPayments } from '@/services/finance';
import { getSettings } from '@/services/admin';
import { dateOnly, dateTime, money } from '@/lib/format';
import { useI18n } from '@/i18n';
import { Button, Modal, Skeleton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/** Printable financial statement: every treatment, what was paid, what is owed. */
export default function PatientStatement({
  patientId, open, onClose,
}: { patientId: string; open: boolean; onClose: () => void }) {
  const { t, label } = useI18n();
  const patient = useQuery({ queryKey: ['patient', patientId], queryFn: () => getPatient(patientId), enabled: open });
  const treatments = useQuery({
    queryKey: ['treatment-balances', patientId], queryFn: () => listTreatmentBalances(patientId), enabled: open,
  });
  const payments = useQuery({
    queryKey: ['payments', patientId], queryFn: () => listPayments({ patientId, pageSize: 200 }), enabled: open,
  });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 300_000 });

  const rows = treatments.data ?? [];
  const totals = rows.reduce(
    (acc, t) => ({
      cost: acc.cost + Number(t.final_cost),
      paid: acc.paid + Number(t.amount_paid),
      balance: acc.balance + Number(t.balance),
    }),
    { cost: 0, paid: 0, balance: 0 },
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('statement.title')}
      wide
      footer={
        <>
          <Button onClick={onClose}>{t('common.close')}</Button>
          <Button variant="primary" onClick={() => window.print()}><Icon name="print" /> {t('common.print')}</Button>
        </>
      }
    >
      {patient.isPending || treatments.isPending ? (
        <Skeleton rows={8} />
      ) : (
        <div className="receipt">
          <div className="row between">
            <div>
              <h2>{settings.data?.clinic_name ?? 'Dental Clinic'}</h2>
              <div className="text-xs">{settings.data?.address}</div>
              <div className="text-xs">{settings.data?.phone}</div>
            </div>
            <div className="right">
              <b>{t('statement.title')}</b>
              <div className="text-xs">{t('statement.issued')} {dateOnly(new Date())}</div>
            </div>
          </div>

          <table>
            <tbody>
              <tr><th style={{ width: '30%' }}>{t('common.patient')}</th><td>{patient.data?.full_name}</td></tr>
              <tr><th>{t('receipt.patientId')}</th><td>{patient.data?.patient_code}</td></tr>
              <tr><th>{t('common.phone')}</th><td>{patient.data?.phone}</td></tr>
            </tbody>
          </table>

          <h3 className="text-sm bold mt-16">{t('statement.treatments')}</h3>
          <table>
            <thead>
              <tr><th>{t('common.treatment')}</th><th>{t('common.date')}</th><th>{t('common.cost')}</th>
                <th>{t('common.paid')}</th><th>{t('common.balance')}</th><th>{t('common.status')}</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}>{t('statement.noTreatments')}</td></tr>
              ) : rows.map((row) => (
                <tr key={row.treatment_id}>
                  <td>{row.treatment_name ?? t('common.treatment')}
                    {row.tooth_numbers?.length ? ` (${t('common.tooth')} ${row.tooth_numbers.join(', ')})` : ''}</td>
                  <td>{dateOnly(row.created_at)}</td>
                  <td>{money(row.final_cost)}</td>
                  <td>{money(row.amount_paid)}</td>
                  <td>{money(row.balance)}</td>
                  <td>{label('status', row.payment_status)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}>{t('statement.totals')}</td>
                <td>{money(totals.cost)}</td>
                <td>{money(totals.paid)}</td>
                <td>{money(totals.balance)}</td>
                <td />
              </tr>
            </tbody>
          </table>

          <h3 className="text-sm bold mt-16">{t('statement.paymentHistory')}</h3>
          <table>
            <thead><tr><th>{t('common.receipt')}</th><th>{t('common.date')}</th>
              <th>{t('common.method')}</th><th>{t('common.amount')}</th></tr></thead>
            <tbody>
              {(payments.data?.rows ?? []).filter((p) => !p.voided_at).length === 0 ? (
                <tr><td colSpan={4}>{t('statement.noPayments')}</td></tr>
              ) : (payments.data?.rows ?? []).filter((p) => !p.voided_at).map((p) => (
                <tr key={p.id}>
                  <td>{p.receipt_number}</td>
                  <td>{dateTime(p.paid_at)}</td>
                  <td>{label('method', p.method)}</td>
                  <td>{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs" style={{ marginTop: 14, textAlign: 'center' }}>
            {settings.data?.receipt_footer}
          </p>
        </div>
      )}
    </Modal>
  );
}
