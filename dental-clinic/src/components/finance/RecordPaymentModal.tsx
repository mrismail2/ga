import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recordPayment } from '@/services/finance';
import { readableError } from '@/lib/supabase';
import { money } from '@/lib/format';
import type { PaymentMethod, TreatmentBalance } from '@/types/database';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import { useI18n } from '@/i18n';

const METHODS: PaymentMethod[] = ['cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other'];

/**
 * The installment ("hafto") entry point. The amount is validated against the
 * live balance here and again inside record_payment(), which also de-duplicates
 * repeat submissions using the client token generated below.
 */
export default function RecordPaymentModal({
  open, onClose, treatment, orthoCaseId, onRecorded,
}: {
  open: boolean;
  onClose: () => void;
  treatment: TreatmentBalance | null;
  orthoCaseId?: string | null;
  onRecorded?: (paymentId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t, label } = useI18n();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // One token per open dialog: resubmitting cannot create a second payment.
  const tokenRef = useRef<string>(crypto.randomUUID());
  const balance = Number(treatment?.balance ?? 0);
  const parsed = Number(amount);

  const remainingAfter = useMemo(
    () => (Number.isFinite(parsed) ? Math.max(balance - parsed, 0) : balance),
    [balance, parsed],
  );

  const mutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-balances'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding'] });
      queryClient.invalidateQueries({ queryKey: ['patient-balance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify(t('pay.recorded', { amount: money(payment.amount), receipt: payment.receipt_number }));
      tokenRef.current = crypto.randomUUID();
      setAmount(''); setReference(''); setNotes('');
      onRecorded?.(payment.id);
      onClose();
    },
    onError: (err) => setError(readableError(err)),
  });

  function submit() {
    setError(null);
    if (!treatment) return;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t('pay.errAmount'));
      return;
    }
    if (parsed > balance) {
      setError(t('pay.errTooMuch', { balance: money(balance) }));
      return;
    }
    mutation.mutate({
      treatment_id: treatment.treatment_id,
      amount: parsed,
      method,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      ortho_case_id: orthoCaseId ?? null,
      client_token: tokenRef.current,
    });
  }

  if (!treatment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('pay.title')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={submit}>
            {t('pay.title')}
          </Button>
        </>
      }
    >
      <div className="alert tone-brand mb-16" style={{ display: 'block' }}>
        <b>{treatment.treatment_name ?? t('common.treatment')}</b>
        <div className="row wrap mt-8 text-sm">
          <span>{t('common.total')} <b>{money(treatment.final_cost)}</b></span>
          <span>{t('common.paid')} <b>{money(treatment.amount_paid)}</b></span>
          <span>{t('ortho.remaining')} <b className="danger-text">{money(balance)}</b></span>
        </div>
      </div>

      {error && <div className="login__error" role="alert">{error}</div>}

      <div className="form-grid">
        <Field label={t('pay.amount')} required hint={t('pay.amountHint', { max: money(balance) })}>
          <Input
            type="number" min={0} step="0.01" value={amount} autoFocus
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </Field>
        <Field label={t('pay.methodLabel')} required>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => <option key={m} value={m}>{label('method', m)}</option>)}
          </Select>
        </Field>
        <Field label={t('common.reference')} hint={t('pay.referenceHint')}>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
        <Field label={t('pay.balanceAfter')}>
          <Input value={money(remainingAfter)} disabled />
        </Field>
        <div className="full">
          <Field label={t('common.notes')}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="row wrap mt-12" style={{ gap: 6 }}>
        {[0.25, 0.5, 1].map((fraction) => (
          <Button key={fraction} size="sm" type="button"
            onClick={() => setAmount(String(Math.round(balance * fraction * 100) / 100))}>
            {fraction === 1 ? t('pay.fullBalance') : `${fraction * 100}%`} · {money(balance * fraction)}
          </Button>
        ))}
      </div>
    </Modal>
  );
}
