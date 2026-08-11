import { supabase } from '@/lib/supabase';
import type {
  Expense, ExpenseCategory, OutstandingBalance, Payment, PaymentMethod,
} from '@/types/database';

const PAYMENT_SELECT = `
  *,
  patient:patients(id, full_name, patient_code),
  treatment:treatments(id, description, treatment_type:treatment_types(name)),
  received_by_profile:profiles!payments_received_by_fkey(id, full_name)
`;

export interface PaymentListParams {
  patientId?: string;
  from?: string;
  to?: string;
  method?: PaymentMethod | 'all';
  page?: number;
  pageSize?: number;
}

export async function listPayments({
  patientId, from, to, method = 'all', page = 1, pageSize = 25,
}: PaymentListParams) {
  let query = supabase
    .from('payments')
    .select(PAYMENT_SELECT, { count: 'exact' })
    .order('paid_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (patientId) query = query.eq('patient_id', patientId);
  if (method !== 'all') query = query.eq('method', method);
  if (from) query = query.gte('paid_at', from);
  if (to) query = query.lte('paid_at', `${to}T23:59:59`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as Payment[], total: count ?? 0 };
}

export async function getPayment(id: string) {
  const { data, error } = await supabase
    .from('payments').select(PAYMENT_SELECT).eq('id', id).single();
  if (error) throw error;
  return data as unknown as Payment;
}

export interface RecordPaymentInput {
  treatment_id: string;
  amount: number;
  method: PaymentMethod;
  paid_at?: string;
  reference?: string | null;
  notes?: string | null;
  ortho_case_id?: string | null;
  /** Idempotency key — the same token can only ever create one payment. */
  client_token: string;
  allow_overpay?: boolean;
}

/**
 * All payment writing goes through this RPC. It locks the treatment, rejects
 * amounts above the remaining balance, and de-duplicates repeat submissions.
 */
export async function recordPayment(input: RecordPaymentInput) {
  const { data, error } = await supabase.rpc('record_payment', {
    p_treatment_id: input.treatment_id,
    p_amount: input.amount,
    p_method: input.method,
    p_paid_at: input.paid_at ?? new Date().toISOString(),
    p_reference: input.reference ?? null,
    p_notes: input.notes ?? null,
    p_ortho_case_id: input.ortho_case_id ?? null,
    p_client_token: input.client_token,
    p_allow_overpay: input.allow_overpay ?? false,
  });
  if (error) throw error;
  return data as Payment;
}

export async function voidPayment(paymentId: string, reason: string) {
  const { data, error } = await supabase.rpc('void_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data as Payment;
}

// --- Outstanding balances ---------------------------------------------------
export interface OutstandingParams {
  search?: string;
  filter?: 'all' | 'unpaid' | 'partial' | 'overdue' | 'braces' | 'other';
  page?: number;
  pageSize?: number;
}

export async function listOutstanding({
  search = '', filter = 'all', page = 1, pageSize = 25,
}: OutstandingParams) {
  let query = supabase
    .from('v_outstanding_balances')
    .select('*', { count: 'exact' })
    .order('balance', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (filter === 'unpaid' || filter === 'partial') query = query.eq('payment_status', filter);
  if (filter === 'braces') query = query.eq('is_orthodontic', true);
  if (filter === 'other') query = query.eq('is_orthodontic', false);
  if (filter === 'overdue') {
    // Nothing has moved on the account for 30 days and money is still owed.
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
    query = query.or(`last_payment_at.lt.${cutoff},last_payment_at.is.null`);
  }

  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[,%()]/g, ' ');
    query = query.or(
      `full_name.ilike.%${escaped}%,patient_code.ilike.%${escaped}%,phone.ilike.%${escaped}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as OutstandingBalance[], total: count ?? 0 };
}

export async function outstandingTotals() {
  const { data, error } = await supabase
    .from('v_outstanding_balances').select('final_cost, amount_paid, balance');
  if (error) throw error;
  const rows = (data ?? []) as { final_cost: number; amount_paid: number; balance: number }[];
  return rows.reduce(
    (acc, r) => ({
      billed: acc.billed + Number(r.final_cost),
      collected: acc.collected + Number(r.amount_paid),
      outstanding: acc.outstanding + Number(r.balance),
      count: acc.count + 1,
    }),
    { billed: 0, collected: 0, outstanding: 0, count: 0 },
  );
}

// --- Expenses ---------------------------------------------------------------
export async function listExpenses(params: {
  from?: string; to?: string; category?: ExpenseCategory | 'all';
  page?: number; pageSize?: number;
} = {}) {
  const { from, to, category = 'all', page = 1, pageSize = 25 } = params;
  let query = supabase
    .from('expenses')
    .select('*, recorded_by_profile:profiles!expenses_recorded_by_fkey(id, full_name)', { count: 'exact' })
    .order('expense_date', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (category !== 'all') query = query.eq('category', category);
  if (from) query = query.gte('expense_date', from);
  if (to) query = query.lte('expense_date', to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as unknown as Expense[], total: count ?? 0 };
}

export async function createExpense(input: {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  notes?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, recorded_by: auth.user?.id ?? null })
    .select('*').single();
  if (error) throw error;
  return data as Expense;
}

// --- Financial summary ------------------------------------------------------
export interface FinancialSummary {
  treatmentIncome: number;
  pharmacyIncome: number;
  expenses: number;
  outstanding: number;
  grossIncome: number;
  net: number;
}

export async function financialSummary(from: string, to: string): Promise<FinancialSummary> {
  const [payments, sales, expenses, outstanding] = await Promise.all([
    supabase.from('payments').select('amount')
      .is('voided_at', null).not('treatment_id', 'is', null)
      .gte('paid_at', from).lte('paid_at', `${to}T23:59:59`),
    supabase.from('pharmacy_sales').select('total_amount')
      .is('voided_at', null)
      .gte('sold_at', from).lte('sold_at', `${to}T23:59:59`),
    supabase.from('expenses').select('amount').gte('expense_date', from).lte('expense_date', to),
    supabase.from('v_outstanding_balances').select('balance'),
  ]);

  const err = payments.error ?? sales.error ?? expenses.error ?? outstanding.error;
  if (err) throw err;

  const sum = (rows: { [k: string]: unknown }[] | null, key: string) =>
    (rows ?? []).reduce((t, r) => t + Number(r[key] ?? 0), 0);

  const treatmentIncome = sum(payments.data, 'amount');
  const pharmacyIncome = sum(sales.data, 'total_amount');
  const expenseTotal = sum(expenses.data, 'amount');
  const grossIncome = treatmentIncome + pharmacyIncome;

  return {
    treatmentIncome,
    pharmacyIncome,
    expenses: expenseTotal,
    outstanding: sum(outstanding.data, 'balance'),
    grossIncome,
    net: grossIncome - expenseTotal,
  };
}

/** Daily income series for the reports chart. */
export async function incomeByDay(from: string, to: string) {
  const [payments, sales] = await Promise.all([
    supabase.from('payments').select('amount, paid_at')
      .is('voided_at', null).gte('paid_at', from).lte('paid_at', `${to}T23:59:59`),
    supabase.from('pharmacy_sales').select('total_amount, sold_at')
      .is('voided_at', null).gte('sold_at', from).lte('sold_at', `${to}T23:59:59`),
  ]);
  if (payments.error) throw payments.error;
  if (sales.error) throw sales.error;

  const buckets = new Map<string, { day: string; treatment: number; pharmacy: number }>();
  const bucket = (day: string) => {
    if (!buckets.has(day)) buckets.set(day, { day, treatment: 0, pharmacy: 0 });
    return buckets.get(day)!;
  };
  for (const p of payments.data ?? []) bucket(String(p.paid_at).slice(0, 10)).treatment += Number(p.amount);
  for (const s of sales.data ?? []) bucket(String(s.sold_at).slice(0, 10)).pharmacy += Number(s.total_amount);

  return [...buckets.values()].sort((a, b) => a.day.localeCompare(b.day));
}
