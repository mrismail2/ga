import { useQuery } from '@tanstack/react-query';
import { getPayment } from '@/services/finance';
import { getSettings } from '@/services/admin';
import { listTreatmentBalances } from '@/services/clinical';
import { dateTime, money, titleCase } from '@/lib/format';
import { Button, Modal, Skeleton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

/**
 * Printable receipt. Shows the balance before and after so the patient can see
 * exactly what is still owed on an installment plan.
 */
export default function Receipt({
  paymentId, open, onClose,
}: { paymentId: string | null; open: boolean; onClose: () => void }) {
  const payment = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => getPayment(paymentId!),
    enabled: Boolean(paymentId) && open,
  });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 300_000 });
  const balances = useQuery({
    queryKey: ['treatment-balances', payment.data?.patient_id],
    queryFn: () => listTreatmentBalances(payment.data!.patient_id!),
    enabled: Boolean(payment.data?.patient_id),
  });

  const treatment = balances.data?.find((b) => b.treatment_id === payment.data?.treatment_id);
  const amount = Number(payment.data?.amount ?? 0);
  const balanceAfter = Number(treatment?.balance ?? 0);
  const balanceBefore = balanceAfter + amount;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Payment receipt"
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => window.print()}>
            <Icon name="print" /> Print
          </Button>
        </>
      }
    >
      {payment.isPending ? (
        <Skeleton rows={6} />
      ) : payment.isError ? (
        <p className="text-sm danger-text">Could not load this receipt.</p>
      ) : payment.data ? (
        <div className="receipt" id="receipt-print">
          <div className="row between">
            <div>
              <h2>{settings.data?.clinic_name ?? 'Dental Clinic'}</h2>
              <div className="text-xs">{settings.data?.address}</div>
              <div className="text-xs">{settings.data?.phone}</div>
            </div>
            <div className="right">
              <div className="text-xs">Receipt</div>
              <b>{payment.data.receipt_number}</b>
              <div className="text-xs">{dateTime(payment.data.paid_at)}</div>
            </div>
          </div>

          <table>
            <tbody>
              <tr>
                <th style={{ width: '40%' }}>Patient</th>
                <td>{payment.data.patient?.full_name}</td>
              </tr>
              <tr><th>Patient ID</th><td>{payment.data.patient?.patient_code}</td></tr>
              <tr>
                <th>Treatment</th>
                <td>
                  {payment.data.treatment?.treatment_type?.name
                    ?? payment.data.treatment?.description
                    ?? 'Treatment'}
                </td>
              </tr>
              <tr><th>Payment method</th><td>{titleCase(payment.data.method)}</td></tr>
              {payment.data.reference && (
                <tr><th>Reference</th><td>{payment.data.reference}</td></tr>
              )}
              <tr><th>Previous balance</th><td>{money(balanceBefore)}</td></tr>
              <tr><th>Amount received</th><td><b>{money(amount)}</b></td></tr>
              <tr className="total-row">
                <td>Remaining balance</td>
                <td><b>{money(balanceAfter)}</b></td>
              </tr>
            </tbody>
          </table>

          <div className="row between text-xs">
            <span>Received by: {payment.data.received_by_profile?.full_name ?? '—'}</span>
            <span>Signature: ____________________</span>
          </div>
          <p className="text-xs" style={{ marginTop: 14, textAlign: 'center' }}>
            {settings.data?.receipt_footer}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}
