import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createExpense, financialSummary, listExpenses } from '@/services/finance';
import { readableError } from '@/lib/supabase';
import { dateOnly, isoDate, money, titleCase } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import type { ExpenseCategory, PaymentMethod } from '@/types/database';
import {
  Button, Card, EmptyState, Field, Input, Modal, Pagination, QueryBoundary,
  Select, StatCard, Textarea, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const CATEGORIES: ExpenseCategory[] = [
  'rent', 'electricity', 'water', 'salaries', 'dental_supplies', 'pharmacy_purchases',
  'equipment', 'maintenance', 'internet', 'cleaning', 'transport', 'other',
];
const METHODS: PaymentMethod[] = ['cash', 'evc_plus', 'zaad', 'edahab', 'bank', 'other'];
const PAGE_SIZE = 25;

export default function Expenses() {
  const { can } = useAuth();
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
          <h1>Expenses</h1>
          <p>Everything the clinic spends — rent, salaries, supplies and pharmacy purchases.</p>
        </div>
        {can('finance.write') && (
          <div className="page__actions">
            <Button variant="primary" onClick={() => setAdding(true)}><Icon name="plus" /> Record expense</Button>
          </div>
        )}
      </div>

      <div className="grid grid--4 mb-16">
        <StatCard tone="ok" label="Income" value={summary.data ? money(summary.data.grossIncome) : '…'}
          hint="Treatments + pharmacy" />
        <StatCard tone="warn" label="Expenses" value={summary.data ? money(summary.data.expenses) : '…'} />
        <StatCard tone="brand" label="Net" value={summary.data ? money(summary.data.net) : '…'}
          hint="Income minus expenses" />
        <StatCard tone="danger" label="Outstanding" value={summary.data ? money(summary.data.outstanding) : '…'}
          hint="Owed by patients" />
      </div>

      <Card padded={false}>
        <div className="toolbar">
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          <Select value={category} style={{ width: 190 }}
            onChange={(e) => { setCategory(e.target.value as ExpenseCategory | 'all'); setPage(1); }}>
            <option value="all">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
          </Select>
        </div>

        <QueryBoundary
          query={{ ...query, data: query.data?.rows }}
          skeletonRows={7}
          empty={<EmptyState title="No expenses in this period"
            description="Record rent, salaries, supplies and other clinic costs to see the true net income." />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th>
                    <th>Recorded by</th><th className="right">Amount</th></tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id}>
                      <td>{dateOnly(e.expense_date)}</td>
                      <td>{titleCase(e.category)}</td>
                      <td><b>{e.description}</b>{e.notes && <div className="text-2xs faint">{e.notes}</div>}</td>
                      <td>{titleCase(e.payment_method)}</td>
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
      notify('Expense recorded');
      setDescription(''); setAmount(''); setNotes('');
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  function submit() {
    setError(null);
    const value = Number(amount);
    if (!description.trim()) { setError('Describe what the money was spent on.'); return; }
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return; }
    create.mutate({
      category, description: description.trim(), amount: value,
      expense_date: date, payment_method: method, notes: notes.trim() || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record expense"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={submit}>Save expense</Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Category" required>
          <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
          </Select>
        </Field>
        <Field label="Amount" required>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Date" required>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Payment method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => <option key={m} value={m}>{titleCase(m)}</option>)}
          </Select>
        </Field>
        <div className="full">
          <Field label="Description" required>
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Composite resin order" />
          </Field>
        </div>
        <div className="full">
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
