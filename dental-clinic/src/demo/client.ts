/**
 * DEMO CLIENT — an in-memory stand-in for the Supabase client.
 *
 * `npm run demo` aliases `@/lib/supabase` to this file so every screen can be
 * used without a Supabase project. It supports only the query shapes the
 * services in `src/services` actually use. The real client in
 * `src/lib/supabase.ts` is untouched and is what `npm run build` ships.
 */
import * as demo from './data';

export { readableError } from '@/lib/errors';
export const isSupabaseConfigured = true;

type Row = Record<string, any>;

/* -------------------------------------------------------------------------- */
/* In-memory store                                                             */
/* -------------------------------------------------------------------------- */
const store: Record<string, Row[]> = {
  profiles: [...demo.profiles],
  patients: [...demo.patients],
  treatments: [...demo.treatments],
  treatment_types: [...demo.treatmentTypes],
  treatment_plans: [],
  payments: [...demo.payments],
  appointments: [...demo.appointments],
  tooth_records: [...demo.toothRecords],
  dental_examinations: [...demo.examinations],
  orthodontic_cases: [...demo.orthoCases],
  orthodontic_visits: [...demo.orthoVisits],
  prescriptions: [...demo.prescriptions],
  prescription_items: demo.prescriptions.flatMap((r) => r.items),
  medicines: [...demo.medicines],
  medicine_categories: [...demo.medicineCategories],
  pharmacy_stock: [...demo.stockBatches],
  stock_movements: [...demo.stockMovements],
  suppliers: [...demo.suppliers],
  pharmacy_purchases: [...demo.purchases],
  pharmacy_purchase_items: [],
  pharmacy_sales: [...demo.sales],
  pharmacy_sale_items: [],
  expenses: [...demo.expenses],
  documents: [...demo.documents],
  audit_logs: [...demo.auditLogs],
  clinic_settings: [demo.clinicSettings],
  user_permissions: [...demo.userPermissions],
};

/** Views are recomputed on every read, exactly like the SQL views. */
function view(name: string): Row[] {
  if (name === 'v_treatment_balances') return balances();
  if (name === 'v_medicine_stock') return demo.buildMedicineStock();
  if (name === 'v_outstanding_balances') {
    return balances()
      .filter((b) => b.balance > 0 && !b.is_waived)
      .map((b) => {
        const patient = store.patients.find((p) => p.id === b.patient_id)!;
        const ortho = store.orthodontic_cases.find((o) => o.treatment_id === b.treatment_id);
        const next = store.appointments
          .filter((a) => a.patient_id === b.patient_id
            && new Date(a.scheduled_at) >= new Date()
            && !['cancelled', 'no_show'].includes(a.status))
          .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
        return {
          ...b,
          patient_code: patient.patient_code,
          full_name: patient.full_name,
          phone: patient.phone,
          is_orthodontic: Boolean(ortho),
          ortho_case_id: ortho?.id ?? null,
          next_appointment_at: next?.scheduled_at ?? null,
        };
      })
      .sort((a: Row, b: Row) => b.balance - a.balance);
  }
  if (name === 'v_patient_balances') {
    return store.patients.map((p) => {
      const mine = balances().filter((b) => b.patient_id === p.id);
      return {
        patient_id: p.id, patient_code: p.patient_code, full_name: p.full_name,
        phone: p.phone, status: p.status,
        total_billed: mine.reduce((s, b) => s + b.final_cost, 0),
        total_paid: mine.reduce((s, b) => s + b.amount_paid, 0),
        total_balance: mine.reduce((s, b) => s + b.balance, 0),
        last_payment_at: mine.map((b) => b.last_payment_at).filter(Boolean).sort().pop() ?? null,
        unpaid_treatments: mine.filter((b) => b.balance > 0).length,
      };
    });
  }
  return store[name] ?? [];
}

function balances(): Row[] {
  return store.treatments.map((t) => {
    const mine = store.payments.filter((p) => p.treatment_id === t.id && !p.voided_at);
    const paid = mine.reduce((s, p) => s + Number(p.amount), 0);
    const balance = Math.max(t.final_cost - paid, 0);
    const type = store.treatment_types.find((x) => x.id === t.treatment_type_id);
    return {
      treatment_id: t.id, patient_id: t.patient_id, plan_id: t.plan_id,
      dentist_id: t.dentist_id, treatment_type_id: t.treatment_type_id,
      treatment_name: type?.name ?? 'Treatment', treatment_category: type?.category ?? null,
      tooth_numbers: t.tooth_numbers, status: t.status, is_waived: t.is_waived,
      planned_date: t.planned_date, completed_at: t.completed_at, created_at: t.created_at,
      estimated_cost: t.estimated_cost, discount: t.discount, final_cost: t.final_cost,
      amount_paid: paid, balance,
      last_payment_at: mine.length ? mine[mine.length - 1].paid_at : null,
      payment_count: mine.length,
      payment_status: t.is_waived ? 'waived' : balance === 0 ? 'paid' : paid === 0 ? 'unpaid' : 'partial',
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Query builder — thenable, mirrors the PostgREST chain the services use      */
/* -------------------------------------------------------------------------- */
type Filter = (row: Row) => boolean;

class Query implements PromiseLike<{ data: any; error: null; count: number | null }> {
  private filters: Filter[] = [];
  private sorts: { col: string; asc: boolean }[] = [];
  private from = 0;
  private to = Infinity;
  private one: 'single' | 'maybe' | null = null;
  private wantCount = false;
  private payload: Row[] | null = null;
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string }) {
    if (opts?.count) this.wantCount = true;
    return this;
  }

  insert(rows: Row | Row[]) { this.mode = 'insert'; this.payload = ([] as Row[]).concat(rows); return this; }
  update(patch: Row) { this.mode = 'update'; this.payload = [patch]; return this; }
  upsert(rows: Row | Row[]) { this.mode = 'upsert'; this.payload = ([] as Row[]).concat(rows); return this; }
  delete() { this.mode = 'delete'; return this; }

  eq(col: string, val: unknown) { this.filters.push((r) => String(r[col]) === String(val)); return this; }
  neq(col: string, val: unknown) { this.filters.push((r) => String(r[col]) !== String(val)); return this; }
  is(col: string, val: unknown) { this.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return this; }
  gt(col: string, val: string) { this.filters.push((r) => String(r[col] ?? '') > val); return this; }
  gte(col: string, val: string) { this.filters.push((r) => String(r[col] ?? '') >= val); return this; }
  lt(col: string, val: string) { this.filters.push((r) => String(r[col] ?? '') < val); return this; }
  lte(col: string, val: string) { this.filters.push((r) => String(r[col] ?? '') <= val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.map(String).includes(String(r[col]))); return this; }
  limit(n: number) { this.to = this.from + n - 1; return this; }
  range(from: number, to: number) { this.from = from; this.to = to; return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }

  /** `not('status','in','("a","b")')` and `not('col','is',null)` */
  not(col: string, op: string, val: unknown) {
    if (op === 'in') {
      const list = String(val).replace(/[()"']/g, '').split(',').map((s) => s.trim());
      this.filters.push((r) => !list.includes(String(r[col])));
    } else if (op === 'is') {
      this.filters.push((r) => r[col] != null);
    }
    return this;
  }

  /** `or('a.ilike.%x%,b.eq.y,c.lt.z')` */
  or(expression: string) {
    const clauses = expression.split(',').map((clause) => {
      const [col, op, ...rest] = clause.split('.');
      const raw = rest.join('.');
      if (op === 'ilike') {
        const needle = raw.replace(/%/g, '').toLowerCase();
        return (r: Row) => String(r[col] ?? '').toLowerCase().includes(needle);
      }
      if (op === 'is') return (r: Row) => r[col] == null;
      if (op === 'lt') return (r: Row) => String(r[col] ?? '') < raw;
      return (r: Row) => String(r[col] ?? '') === raw;
    });
    this.filters.push((r) => clauses.some((c) => c(r)));
    return this;
  }

  private run() {
    const source = this.table.startsWith('v_') ? view(this.table) : (store[this.table] ??= []);
    let rows = source.filter((r) => this.filters.every((f) => f(r)));

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const created = this.payload!.map((row) => ({
        id: row.id ?? `new-${Math.random().toString(36).slice(2, 9)}`,
        created_at: new Date().toISOString(),
        ...row,
      }));
      store[this.table] = [...created, ...(store[this.table] ?? [])];
      return { rows: created, total: created.length };
    }
    if (this.mode === 'update') {
      rows.forEach((row) => Object.assign(row, this.payload![0]));
      return { rows, total: rows.length };
    }
    if (this.mode === 'delete') {
      store[this.table] = source.filter((r) => !rows.includes(r));
      return { rows, total: rows.length };
    }

    for (const sort of [...this.sorts].reverse()) {
      rows = [...rows].sort((a, b) => {
        const x = a[sort.col] ?? '';
        const y = b[sort.col] ?? '';
        const cmp = typeof x === 'number' && typeof y === 'number'
          ? x - y : String(x).localeCompare(String(y));
        return sort.asc ? cmp : -cmp;
      });
    }
    const total = rows.length;
    return { rows: rows.slice(this.from, this.to + 1), total };
  }

  then<R1 = any, R2 = never>(
    onfulfilled?: ((value: { data: any; error: null; count: number | null }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return new Promise<{ data: any; error: null; count: number | null }>((resolve) => {
      const { rows, total } = this.run();
      const data = this.one ? (rows[0] ?? null) : rows;
      // A small delay so loading skeletons are visible while clicking around.
      setTimeout(() => resolve({ data, error: null, count: this.wantCount ? total : null }), 60);
    }).then(onfulfilled, onrejected);
  }
}

/* -------------------------------------------------------------------------- */
/* RPCs                                                                        */
/* -------------------------------------------------------------------------- */
const RPCS: Record<string, (args: Row) => unknown> = {
  dashboard_summary() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const out = view('v_outstanding_balances');
    const stock = demo.buildMedicineStock();
    const isToday = (v?: string | null) => Boolean(v && v.slice(0, 10) === todayStr);
    return {
      patients_total: store.patients.filter((p) => !p.archived_at).length,
      patients_today: store.patients.filter((p) => isToday(p.registered_at)).length,
      appointments_today: store.appointments.filter((a) => isToday(a.scheduled_at)).length,
      appointments_done: store.appointments.filter((a) => isToday(a.scheduled_at) && a.status === 'completed').length,
      waiting_now: store.appointments.filter((a) => ['waiting', 'called'].includes(a.queue_state ?? '')).length,
      treatments_today: store.treatments.filter((t) => isToday(t.created_at)).length,
      treatment_income: store.payments
        .filter((p) => isToday(p.paid_at) && !p.voided_at).reduce((s, p) => s + Number(p.amount), 0),
      pharmacy_income: store.pharmacy_sales
        .filter((s) => isToday(s.sold_at) && !s.voided_at).reduce((s, x) => s + Number(x.total_amount), 0),
      expenses_today: store.expenses
        .filter((e) => e.expense_date === todayStr).reduce((s, e) => s + Number(e.amount), 0),
      outstanding_total: out.reduce((s, r) => s + r.balance, 0),
      outstanding_patients: new Set(out.map((r) => r.patient_id)).size,
      partial_patients: out.filter((r) => r.payment_status === 'partial').length,
      unpaid_patients: out.filter((r) => r.payment_status === 'unpaid').length,
      low_stock: stock.filter((m) => ['low_stock', 'out_of_stock'].includes(m.stock_status)).length,
      expiring_soon: stock.filter((m) => m.stock_status === 'expiring_soon').length,
    };
  },

  record_payment(args) {
    const treatment = store.treatments.find((t) => t.id === args.p_treatment_id)!;
    const existing = store.payments.find((p) => p.client_token && p.client_token === args.p_client_token);
    if (existing) return existing;

    const paid = store.payments
      .filter((p) => p.treatment_id === treatment.id && !p.voided_at)
      .reduce((s, p) => s + Number(p.amount), 0);
    const balance = treatment.final_cost - paid;
    if (Number(args.p_amount) > balance) {
      throw Object.assign(new Error(`Payment of ${args.p_amount} exceeds the remaining balance of ${balance}`), { code: '22003' });
    }

    const patient = store.patients.find((p) => p.id === treatment.patient_id)!;
    const type = store.treatment_types.find((t) => t.id === treatment.treatment_type_id);
    const payment = {
      id: `pay-${Math.random().toString(36).slice(2, 9)}`,
      receipt_number: `RCP-${String(store.payments.length + 1).padStart(6, '0')}`,
      patient_id: patient.id, treatment_id: treatment.id,
      ortho_case_id: args.p_ortho_case_id ?? null, pharmacy_sale_id: null,
      amount: Number(args.p_amount), method: args.p_method,
      paid_at: args.p_paid_at ?? new Date().toISOString(),
      reference: args.p_reference ?? null, notes: args.p_notes ?? null,
      client_token: args.p_client_token ?? null,
      received_by: 'u-1', created_at: new Date().toISOString(),
      voided_at: null, void_reason: null,
      patient: { id: patient.id, full_name: patient.full_name, patient_code: patient.patient_code },
      treatment: { id: treatment.id, description: null, treatment_type: { name: type?.name ?? 'Treatment' } },
      received_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' },
    };
    store.payments.unshift(payment);
    return payment;
  },

  void_payment(args) {
    const payment = store.payments.find((p) => p.id === args.p_payment_id)!;
    payment.voided_at = new Date().toISOString();
    payment.void_reason = args.p_reason;
    return payment;
  },

  record_tooth_condition(args) {
    store.tooth_records
      .filter((r) => r.patient_id === args.p_patient_id && r.tooth_number === args.p_tooth_number)
      .forEach((r) => { r.is_current = false; });
    const record = {
      id: `tr-${Math.random().toString(36).slice(2, 9)}`,
      patient_id: args.p_patient_id, tooth_number: args.p_tooth_number,
      condition: args.p_condition, proposed_treatment: args.p_proposed_treatment ?? null,
      existing_treatment: args.p_existing_treatment ?? null, surface: args.p_surface ?? null,
      notes: args.p_notes ?? null, examination_id: null, recorded_by: 'u-1',
      recorded_at: new Date().toISOString(), is_current: true,
      recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' },
    };
    store.tooth_records.unshift(record);
    return record;
  },

  check_in_appointment(args) {
    const appt = store.appointments.find((a) => a.id === args.p_appointment_id)!;
    const next = Math.max(0, ...store.appointments.map((a) => a.queue_number ?? 0)) + 1;
    Object.assign(appt, {
      status: 'checked_in', queue_state: 'waiting',
      queue_number: appt.queue_number ?? next, checked_in_at: new Date().toISOString(),
    });
    return appt;
  },

  create_orthodontic_case(args) {
    const treatment = {
      id: `t-${Math.random().toString(36).slice(2, 9)}`,
      patient_id: args.p_patient_id, plan_id: null,
      treatment_type_id: 'tt-8', dentist_id: args.p_dentist_id,
      tooth_numbers: [], description: args.p_braces_type,
      estimated_cost: Number(args.p_total_cost), discount: Number(args.p_discount ?? 0),
      final_cost: Number(args.p_total_cost) - Number(args.p_discount ?? 0),
      priority: 'normal', planned_date: args.p_start_date,
      started_at: new Date().toISOString(), completed_at: null,
      status: 'in_progress', is_waived: false, notes: null,
      created_at: new Date().toISOString(), archived_at: null,
    };
    store.treatments.unshift(treatment);
    const patient = store.patients.find((p) => p.id === args.p_patient_id)!;
    const dentist = store.profiles.find((p) => p.id === args.p_dentist_id);
    const orthoCase = {
      id: `oc-${Math.random().toString(36).slice(2, 9)}`,
      patient_id: patient.id, treatment_id: treatment.id, dentist_id: args.p_dentist_id,
      braces_type: args.p_braces_type, upper_arch: args.p_upper_arch, lower_arch: args.p_lower_arch,
      start_date: args.p_start_date, estimated_months: args.p_estimated_months,
      current_stage: null, status: 'active', notes: args.p_notes ?? null,
      created_at: new Date().toISOString(),
      patient: { id: patient.id, full_name: patient.full_name, patient_code: patient.patient_code, phone: patient.phone, allergies: patient.allergies },
      dentist: dentist ? { id: dentist.id, full_name: dentist.full_name } : null,
    };
    store.orthodontic_cases.unshift(orthoCase);
    return orthoCase;
  },

  dispense_prescription(args) {
    const rx = store.prescriptions.find((r) => r.id === args.p_prescription_id)!;
    for (const line of args.p_items as { item_id: string; quantity: number }[]) {
      const item = rx.items.find((i: Row) => i.id === line.item_id);
      if (item) item.dispensed_quantity += line.quantity;
    }
    const pending = rx.items.some((i: Row) => i.dispensed_quantity < i.quantity);
    const started = rx.items.some((i: Row) => i.dispensed_quantity > 0);
    rx.status = pending ? (started ? 'partially_dispensed' : 'pending') : 'dispensed';
    return rx;
  },

  create_pharmacy_sale(args) {
    const items = args.p_items as { medicine_id: string; quantity: number; unit_price: number }[];
    const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const patient = store.patients.find((p) => p.id === args.p_patient_id);
    const sale = {
      id: `sa-${Math.random().toString(36).slice(2, 9)}`,
      sale_number: `SAL-${String(store.pharmacy_sales.length + 1).padStart(6, '0')}`,
      patient_id: args.p_patient_id ?? null, prescription_id: args.p_prescription_id ?? null,
      total_amount: total, payment_method: args.p_method,
      sold_at: new Date().toISOString(), voided_at: null,
      patient: patient ? { id: patient.id, full_name: patient.full_name } : null,
      sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' },
    };
    store.pharmacy_sales.unshift(sale);
    return sale;
  },

  confirm_purchase(args) {
    const purchase = store.pharmacy_purchases.find((p) => p.id === args.p_purchase_id)!;
    purchase.status = 'confirmed';
    purchase.confirmed_at = new Date().toISOString();
    return purchase;
  },

  adjust_stock(args) {
    const batch = store.pharmacy_stock.find((b) => b.id === args.p_stock_id)!;
    batch.quantity += Number(args.p_change);
    return batch;
  },
};

/* -------------------------------------------------------------------------- */
/* Client                                                                      */
/* -------------------------------------------------------------------------- */
const signedOut = () => new URLSearchParams(window.location.search).has('signedout');

const SESSION = {
  access_token: 'demo', token_type: 'bearer', expires_in: 3600,
  refresh_token: 'demo', user: { id: 'u-1', email: 'amina@clinic.so' },
};

export const supabase = {
  from: (table: string) => new Query(table),

  rpc: async (name: string, args: Row = {}) => {
    await new Promise((r) => setTimeout(r, 60));
    try {
      const handler = RPCS[name];
      if (!handler) return { data: null, error: { message: `Unknown demo RPC: ${name}` } };
      return { data: handler(args), error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  auth: {
    // ?signedout lets the screenshot run reach the sign-in screen, which is
    // otherwise unreachable because the demo session never expires.
    getSession: async () => ({ data: { session: signedOut() ? null : SESSION }, error: null }),
    getUser: async () => ({ data: { user: signedOut() ? null : SESSION.user }, error: null }),
    onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
      setTimeout(() => (signedOut() ? cb('SIGNED_OUT', null) : cb('SIGNED_IN', SESSION)), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signInWithPassword: async () => ({ data: { session: SESSION }, error: null }),
    signUp: async () => ({ data: { user: SESSION.user }, error: null }),
    signOut: async () => ({ error: null }),
    resetPasswordForEmail: async () => ({ error: null }),
  },

  storage: {
    from: () => ({
      upload: async () => ({ data: { path: 'demo' }, error: null }),
      createSignedUrl: async () => ({ data: { signedUrl: '#demo-document' }, error: null }),
    }),
  },
} as any;
