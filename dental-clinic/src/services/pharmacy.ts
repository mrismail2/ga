import { supabase } from '@/lib/supabase';
import type {
  Medicine, MedicineStock, PaymentMethod, PharmacyPurchase, PharmacySale,
  Prescription, StockBatch, StockMovement, Supplier,
} from '@/types/database';

// --- Medicines & stock ------------------------------------------------------
export async function listMedicineStock(params: {
  search?: string; status?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon';
} = {}) {
  const { search = '', status = 'all' } = params;
  let query = supabase.from('v_medicine_stock').select('*').order('name');
  if (status !== 'all') query = query.eq('stock_status', status);
  const term = search.trim();
  if (term) {
    const escaped = term.replace(/[,%()]/g, ' ');
    query = query.or(`name.ilike.%${escaped}%,generic_name.ilike.%${escaped}%,barcode.ilike.%${escaped}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MedicineStock[];
}

export async function listMedicineCategories() {
  const { data, error } = await supabase.from('medicine_categories').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

export async function upsertMedicine(input: Partial<Medicine> & { name: string }) {
  const { data, error } = await supabase
    .from('medicines').upsert(input).select('*').single();
  if (error) throw error;
  return data as Medicine;
}

export async function listBatches(medicineId?: string) {
  let query = supabase
    .from('pharmacy_stock')
    .select('*, medicine:medicines(id, name, strength, dosage_form)')
    .order('expiry_date', { ascending: true, nullsFirst: false });
  if (medicineId) query = query.eq('medicine_id', medicineId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as StockBatch[];
}

export async function adjustStock(
  stockId: string,
  change: number,
  type: StockMovement['movement_type'],
  reason: string,
) {
  const { data, error } = await supabase.rpc('adjust_stock', {
    p_stock_id: stockId, p_change: change, p_type: type, p_reason: reason,
  });
  if (error) throw error;
  return data as StockBatch;
}

export async function listStockMovements(medicineId?: string, limit = 100) {
  let query = supabase
    .from('stock_movements')
    .select('*, medicine:medicines(id, name), performed_by_profile:profiles!stock_movements_performed_by_fkey(id, full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (medicineId) query = query.eq('medicine_id', medicineId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as StockMovement[];
}

// --- Prescriptions ----------------------------------------------------------
const RX_SELECT = `
  *,
  patient:patients(id, full_name, patient_code, allergies),
  dentist:profiles!prescriptions_dentist_id_fkey(id, full_name),
  items:prescription_items(*)
`;

export async function listPrescriptions(params: {
  patientId?: string; status?: Prescription['status'] | 'all' | 'open';
} = {}) {
  const { patientId, status = 'all' } = params;
  let query = supabase.from('prescriptions').select(RX_SELECT)
    .order('prescribed_at', { ascending: false });
  if (patientId) query = query.eq('patient_id', patientId);
  if (status === 'open') query = query.in('status', ['pending', 'partially_dispensed']);
  else if (status !== 'all') query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as Prescription[];
}

/**
 * A prescription is cancelled, never deleted, and only while nothing has been
 * dispensed against it — the database enforces both.
 */
export async function cancelPrescription(id: string, reason: string) {
  const { data, error } = await supabase
    .from('prescriptions')
    .update({ status: 'cancelled', cancel_reason: reason.trim() })
    .eq('id', id).select('*').single();
  if (error) throw error;
  return data as unknown as Prescription;
}

export async function getPrescription(id: string) {
  const { data, error } = await supabase.from('prescriptions').select(RX_SELECT).eq('id', id).single();
  if (error) throw error;
  return data as unknown as Prescription;
}

export interface PrescriptionDraftItem {
  medicine_id: string | null;
  medicine_name: string;
  strength?: string | null;
  dose?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity: number;
  instructions?: string | null;
}

export async function createPrescription(input: {
  patient_id: string;
  dentist_id: string | null;
  notes?: string | null;
  items: PrescriptionDraftItem[];
}) {
  const { data: rx, error } = await supabase
    .from('prescriptions')
    .insert({ patient_id: input.patient_id, dentist_id: input.dentist_id, notes: input.notes ?? null })
    .select('*').single();
  if (error) throw error;

  const { error: itemError } = await supabase
    .from('prescription_items')
    .insert(input.items.map((item) => ({ ...item, prescription_id: rx.id })));
  if (itemError) throw itemError;

  return rx as Prescription;
}

/** Server checks stock and expiry, deducts first-expiring batches, updates status. */
export async function dispensePrescription(
  prescriptionId: string,
  items: { item_id: string; quantity: number }[],
) {
  const { data, error } = await supabase.rpc('dispense_prescription', {
    p_prescription_id: prescriptionId,
    p_items: items,
  });
  if (error) throw error;
  return data as Prescription;
}

// --- Sales ------------------------------------------------------------------
export async function listSales(params: { from?: string; to?: string } = {}) {
  let query = supabase
    .from('pharmacy_sales')
    .select('*, patient:patients(id, full_name), sold_by_profile:profiles!pharmacy_sales_sold_by_fkey(id, full_name)')
    .order('sold_at', { ascending: false })
    .limit(100);
  if (params.from) query = query.gte('sold_at', `${params.from}T00:00:00`);
  if (params.to) query = query.lte('sold_at', `${params.to}T23:59:59`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PharmacySale[];
}

export async function createSale(input: {
  items: { medicine_id: string; quantity: number; unit_price: number }[];
  patient_id?: string | null;
  prescription_id?: string | null;
  method: PaymentMethod;
  notes?: string | null;
  client_token: string;
}) {
  const { data, error } = await supabase.rpc('create_pharmacy_sale', {
    p_items: input.items,
    p_patient_id: input.patient_id ?? null,
    p_prescription_id: input.prescription_id ?? null,
    p_method: input.method,
    p_notes: input.notes ?? null,
    p_client_token: input.client_token,
  });
  if (error) throw error;
  return data as PharmacySale;
}

// --- Suppliers & purchases --------------------------------------------------
export async function listSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Supplier[];
}

export async function upsertSupplier(input: Partial<Supplier> & { name: string }) {
  const { data, error } = await supabase.from('suppliers').upsert(input).select('*').single();
  if (error) throw error;
  return data as Supplier;
}

export async function listPurchases() {
  const { data, error } = await supabase
    .from('pharmacy_purchases')
    .select('*, supplier:suppliers(id, name)')
    .order('purchase_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PharmacyPurchase[];
}

export async function createPurchase(input: {
  supplier_id: string | null;
  invoice_reference: string | null;
  purchase_date: string;
  items: {
    medicine_id: string; batch_number: string; expiry_date: string | null;
    quantity: number; purchase_price: number;
  }[];
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data: purchase, error } = await supabase
    .from('pharmacy_purchases')
    .insert({
      supplier_id: input.supplier_id,
      invoice_reference: input.invoice_reference,
      purchase_date: input.purchase_date,
      created_by: auth.user?.id ?? null,
    })
    .select('*').single();
  if (error) throw error;

  const { error: itemError } = await supabase
    .from('pharmacy_purchase_items')
    .insert(input.items.map((i) => ({ ...i, purchase_id: purchase.id })));
  if (itemError) throw itemError;

  return purchase as PharmacyPurchase;
}

/** Stock only moves when a purchase is confirmed. */
export async function confirmPurchase(purchaseId: string) {
  const { data, error } = await supabase.rpc('confirm_purchase', { p_purchase_id: purchaseId });
  if (error) throw error;
  return data as PharmacyPurchase;
}
