import { useQuery } from '@tanstack/react-query';
import { getPatient } from '@/services/patients';
import { listTreatmentBalances } from '@/services/clinical';
import { listPayments } from '@/services/finance';
import { getSettings } from '@/services/admin';
import { dateOnly, dateTime, money, titleCase } from '@/lib/format';
import { Button, Modal, Skeleton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/** Printable financial statement: every treatment, what was paid, what is owed. */
export default function PatientStatement({
  patientId, open, onClose,
}: { patientId: string; open: boolean; onClose: () => void }) {
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
      title="Patient statement"
      wide
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => window.print()}><Icon name="print" /> Print</Button>
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
              <b>Patient statement</b>
              <div className="text-xs">Issued {dateOnly(new Date())}</div>
            </div>
          </div>

          <table>
            <tbody>
              <tr><th style={{ width: '30%' }}>Patient</th><td>{patient.data?.full_name}</td></tr>
              <tr><th>Patient ID</th><td>{patient.data?.patient_code}</td></tr>
              <tr><th>Phone</th><td>{patient.data?.phone}</td></tr>
            </tbody>
          </table>

          <h3 className="text-sm bold mt-16">Treatments</h3>
          <table>
            <thead>
              <tr><th>Treatment</th><th>Date</th><th>Cost</th><th>Paid</th><th>Balance</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}>No treatments recorded.</td></tr>
              ) : rows.map((t) => (
                <tr key={t.treatment_id}>
                  <td>{t.treatment_name ?? 'Treatment'}
                    {t.tooth_numbers?.length ? ` (tooth ${t.tooth_numbers.join(', ')})` : ''}</td>
                  <td>{dateOnly(t.created_at)}</td>
                  <td>{money(t.final_cost)}</td>
                  <td>{money(t.amount_paid)}</td>
                  <td>{money(t.balance)}</td>
                  <td>{titleCase(t.payment_status)}</td>
                </tr>
              ))}
              <tr className="total-row">
                <td colSpan={2}>Totals</td>
                <td>{money(totals.cost)}</td>
                <td>{money(totals.paid)}</td>
                <td>{money(totals.balance)}</td>
                <td />
              </tr>
            </tbody>
          </table>

          <h3 className="text-sm bold mt-16">Payment history</h3>
          <table>
            <thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Amount</th></tr></thead>
            <tbody>
              {(payments.data?.rows ?? []).filter((p) => !p.voided_at).length === 0 ? (
                <tr><td colSpan={4}>No payments recorded.</td></tr>
              ) : (payments.data?.rows ?? []).filter((p) => !p.voided_at).map((p) => (
                <tr key={p.id}>
                  <td>{p.receipt_number}</td>
                  <td>{dateTime(p.paid_at)}</td>
                  <td>{titleCase(p.method)}</td>
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
