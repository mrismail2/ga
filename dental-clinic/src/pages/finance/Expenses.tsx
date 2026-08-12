import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createExpense, financialSummary, listExpenses } from '@/services/finance';
import { readableError } from '@/lib/supabase';
import { dateOnly, isoDate, money } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { ExpenseCategory, PaymentMethod } from '@/types/database';
import {
  Button, Card, EmptyState, Field, Input, Modal, Pagination, QueryBoundary,
  Select, StatCard, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const CATEGORIES: ExpenseCategory[] = [
  'rent', 'electricity', 'water', 'salaries', 'dental_supplies', 'pharmacy_purchases',
  'equipment', 'maintenance', 'internet', 'cleaning', 'transport', 'other',
];
const METHODS: PaymentMethod[] = ['cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other'];
const PAGE_SIZE = 25;

export default function Expenses() {
  const { can } = useAuth();
  const { t, label } = useI18n();
  const [from, setFrom] = useState(isoDate(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(isoDate());
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);

  const query = useQuery({
    queryKey: ['expenses', from, to, category, page],
    queryFn: () => listExpenses({ from, to, category, page, pageSize: PAGE_SIZE }),
  });
  const summary = useQuery({
    queryKey: ['financial-summary', from, to],
    queryFn: () => financialSummary(from, to),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('exp.title')}</h1>
          <p>{t('exp.subtitle')}</p>
        </div>
        {can('finance.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setAdding(true)}><Icon name="plus" /> {t('exp.record')}</Button>
          </div>
        )}
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="ok" label={t('exp.income')} value={summary.data ? money(summary.data.grossIncome) : '…'}
          hint={t('exp.incomeHint')} />
        <StatCard tone="warn" label={t('exp.expenses')} value={summary.data ? money(summary.data.expenses) : '…'} />
        <StatCard tone="brand" label={t('exp.net')} value={summary.data ? money(summary.data.net) : '…'}
          hint={t('exp.netHint')} />
        <StatCard tone="danger" label={t('exp.outstanding')} value={summary.data ? money(summary.data.outstanding) : '…'}
          hint={t('exp.outstandingHint')} />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          <Select value={category} style={{ width: 190 }}
            onChange={(e) => { setCategory(e.target.value as ExpenseCategory | 'all'); setPage(1); }}>
            <option value="all">{t('exp.allCategories')}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{label('expcat', c)}</option>)}
          </Select>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={7}
          empty={<EmptyState title={t('exp.empty')}
            description={t('exp.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('common.date')}</th><th>{t('common.category')}</th>
                    <th>{t('exp.description')}</th><th>{t('common.method')}</th>
                    <th>{t('common.recordedBy')}</th><th className="right">{t('common.amount')}</th></tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>{dateOnly(e.expense_date)}</td>
                      <td>{label('expcat', e.category)}</td>
                      <td><b>{e.description}</b>{e.notes && <div className="text-2xs faint">{e.notes}</div>}</td>
                      <td>{label('method', e.payment_method)}</td>
                      <td>{e.recorded_by_profile?.full_name ?? '—'}</td>
                      <td className="right bold">{money(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>

        <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onChange={setPage} />
      </Card>

      <ExpenseModal open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function ExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t, label } = useI18n();
  const [category, setCategory] = useState<ExpenseCategory>('dental_supplies');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(isoDate());
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['financial-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      notify(t('exp.saved'));
      setDescription(''); setAmount(''); setNotes('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function submit() {
    setError(null);
    const value = Number(amount);
    if (!description.trim()) { setError(t('exp.errDescription')); return; }
    if (!Number.isFinite(value) || value <= 0) { setError(t('exp.errAmount')); return; }
    create.mutate({
      category, description: description.trim(), amount: value,
      expense_date: date, payment_method: method, notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('exp.record')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>{t('exp.save')}</Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label={t('common.category')} required>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{label('expcat', c)}</option>)}
          </Select>
        </Field>
        <Field label={t('common.amount')} required>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label={t('common.date')} required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label={t('pay.methodLabel')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => <option key={m} value={m}>{label('method', m)}</option>)}
          </Select>
        </Field>
        <div className="full">
          <Field label={t('exp.description')} required>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={t('exp.descriptionPlaceholder')} />
          </Field>
        </div>
        <div className="full">
          <Field label={t('common.notes')}>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
