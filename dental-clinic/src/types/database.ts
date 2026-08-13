/**
 * Types mirroring the SQL schema in supabase/migrations.
 * Kept hand-written (rather than generated) so the app compiles without a live
 * project; regenerate with `supabase gen types typescript` once linked.
 */

export type UserRole = 'admin' | 'dentist' | 'receptionist' | 'pharmacist';
export type StaffStatus = 'active' | 'inactive';
export type Gender = 'male' | 'female';
export type PatientStatus = 'active' | 'inactive';

export type AppointmentStatus =
  | 'scheduled' | 'confirmed' | 'checked_in' | 'waiting'
  | 'in_treatment' | 'completed' | 'cancelled' | 'no_show';
export type QueueStatus = 'waiting' | 'called' | 'in_treatment' | 'completed';

export type TreatmentStatus = 'planned' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
export type TreatmentPriority = 'low' | 'normal' | 'high' | 'urgent';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'waived';
export type PaymentMethod = 'cash' | 'evc_plus' | 'zaad' | 'edahab' | 'bank' | 'other';

export type ToothCondition =
  | 'healthy' | 'caries' | 'filling' | 'crown' | 'missing' | 'extraction_planned'
  | 'extracted' | 'root_canal' | 'implant' | 'bridge' | 'fractured' | 'sensitive' | 'other';

export type PrescriptionStatus = 'pending' | 'partially_dispensed' | 'dispensed' | 'cancelled';
export type StockMovementType =
  | 'purchase' | 'sale' | 'dispense' | 'adjustment' | 'damaged' | 'expired' | 'returned';
export type PurchaseStatus = 'draft' | 'confirmed' | 'cancelled';
export type OrthoStatus = 'active' | 'completed' | 'cancelled';
export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon';
export type ExpenseCategory =
  | 'rent' | 'electricity' | 'water' | 'salaries' | 'dental_supplies' | 'pharmacy_purchases'
  | 'equipment' | 'maintenance' | 'internet' | 'cleaning' | 'transport' | 'other';
export type DocumentType = 'xray' | 'photo' | 'scan' | 'consent' | 'lab_result' | 'pdf' | 'other';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  email: string | null;
  specialty: string | null;
  photo_url: string | null;
  status: StaffStatus;
  joined_date: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  patient_code: string;
  full_name: string;
  gender: Gender;
  date_of_birth: string | null;
  age_years: number | null;
  phone: string;
  alt_phone: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  allergies: string | null;
  medical_conditions: string | null;
  current_medications: string | null;
  notes: string | null;
  status: PatientStatus;
  registered_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export type PatientInput = Omit<
  Patient,
  'id' | 'patient_code' | 'registered_at' | 'created_at' | 'updated_at' | 'archived_at' | 'created_by'
>;

export interface MedicalHistoryEntry {
  id: string;
  patient_id: string;
  condition: string;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  recorded_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface DentalExamination {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  exam_date: string;
  chief_complaint: string | null;
  medical_history: string | null;
  dental_history: string | null;
  findings: string | null;
  diagnosis: string | null;
  recommended_treatment: string | null;
  notes: string | null;
  created_at: string;
  dentist?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface ToothRecord {
  id: string;
  patient_id: string;
  tooth_number: number;
  condition: ToothCondition;
  proposed_treatment: string | null;
  existing_treatment: string | null;
  surface: string | null;
  notes: string | null;
  examination_id: string | null;
  recorded_by: string | null;
  recorded_at: string;
  is_current: boolean;
  recorded_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface TreatmentType {
  id: string;
  code: string;
  name: string;
  category: string;
  default_price: number;
  is_active: boolean;
  sort_order: number;
}

export interface TreatmentPlan {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  title: string;
  status: TreatmentStatus;
  notes: string | null;
  created_at: string;
}

export interface Treatment {
  id: string;
  patient_id: string;
  plan_id: string | null;
  treatment_type_id: string | null;
  dentist_id: string | null;
  tooth_numbers: number[];
  description: string | null;
  estimated_cost: number;
  discount: number;
  final_cost: number;
  priority: TreatmentPriority;
  planned_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: TreatmentStatus;
  is_waived: boolean;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
}

/** v_treatment_balances — cost and payments joined, balance always derived. */
export interface TreatmentBalance {
  treatment_id: string;
  patient_id: string;
  plan_id: string | null;
  dentist_id: string | null;
  treatment_type_id: string | null;
  treatment_name: string | null;
  treatment_category: string | null;
  tooth_numbers: number[];
  status: TreatmentStatus;
  is_waived: boolean;
  planned_date: string | null;
  completed_at: string | null;
  created_at: string;
  estimated_cost: number;
  discount: number;
  final_cost: number;
  amount_paid: number;
  balance: number;
  last_payment_at: string | null;
  payment_count: number | null;
  payment_status: PaymentStatus;
}

export interface PatientBalance {
  patient_id: string;
  patient_code: string;
  full_name: string;
  phone: string;
  status: PatientStatus;
  total_billed: number;
  total_paid: number;
  total_balance: number;
  last_payment_at: string | null;
  unpaid_treatments: number;
}

export interface OutstandingBalance {
  treatment_id: string;
  patient_id: string;
  patient_code: string;
  full_name: string;
  phone: string;
  treatment_name: string | null;
  treatment_category: string | null;
  final_cost: number;
  amount_paid: number;
  balance: number;
  payment_status: PaymentStatus;
  last_payment_at: string | null;
  created_at: string;
  is_orthodontic: boolean;
  ortho_case_id: string | null;
  next_appointment_at: string | null;
}

export interface OrthodonticCase {
  id: string;
  patient_id: string;
  treatment_id: string;
  dentist_id: string | null;
  braces_type: string;
  upper_arch: boolean;
  lower_arch: boolean;
  start_date: string;
  estimated_months: number | null;
  current_stage: string | null;
  status: OrthoStatus;
  notes: string | null;
  created_at: string;
}

export interface OrthodonticVisit {
  id: string;
  case_id: string;
  visit_date: string;
  dentist_id: string | null;
  adjustment: string | null;
  archwire_change: string | null;
  elastics: string | null;
  observation: string | null;
  compliance: string | null;
  next_visit_date: string | null;
  notes: string | null;
  created_at: string;
  dentist?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface Appointment {
  id: string;
  patient_id: string;
  dentist_id: string | null;
  treatment_type_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  queue_number: number | null;
  queue_state: QueueStatus | null;
  checked_in_at: string | null;
  called_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  cancel_reason: string | null;
  patient?: Pick<Patient, 'id' | 'full_name' | 'patient_code' | 'phone'> | null;
  dentist?: Pick<Profile, 'id' | 'full_name'> | null;
  treatment_type?: Pick<TreatmentType, 'id' | 'name'> | null;
}

export interface Payment {
  id: string;
  receipt_number: string;
  patient_id: string | null;
  treatment_id: string | null;
  ortho_case_id: string | null;
  pharmacy_sale_id: string | null;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  reference: string | null;
  notes: string | null;
  received_by: string | null;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
  patient?: Pick<Patient, 'id' | 'full_name' | 'patient_code'> | null;
  treatment?: { id: string; description: string | null; treatment_type: { name: string } | null } | null;
  received_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface Prescription {
  id: string;
  prescription_number: string;
  patient_id: string;
  dentist_id: string | null;
  prescribed_at: string;
  status: PrescriptionStatus;
  notes: string | null;
  cancel_reason: string | null;
  patient?: Pick<Patient, 'id' | 'full_name' | 'patient_code' | 'allergies'> | null;
  dentist?: Pick<Profile, 'id' | 'full_name'> | null;
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medicine_id: string | null;
  medicine_name: string;
  strength: string | null;
  dose: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number;
  dispensed_quantity: number;
  instructions: string | null;
}

export interface Medicine {
  id: string;
  name: string;
  generic_name: string | null;
  category_id: string | null;
  dosage_form: string;
  strength: string | null;
  barcode: string | null;
  purchase_price: number;
  selling_price: number;
  minimum_stock: number;
  is_active: boolean;
}

/** v_medicine_stock — live quantities with expiry-aware status. */
export interface MedicineStock extends Omit<Medicine, 'id'> {
  medicine_id: string;
  category_name: string | null;
  total_quantity: number;
  usable_quantity: number;
  expired_quantity: number;
  earliest_expiry: string | null;
  stock_status: StockStatus;
}

export interface StockBatch {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string | null;
  quantity: number;
  purchase_price: number;
  supplier_id: string | null;
  received_at: string;
  medicine?: Pick<Medicine, 'id' | 'name' | 'strength' | 'dosage_form'> | null;
}

export interface StockMovement {
  id: string;
  medicine_id: string;
  movement_type: StockMovementType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason: string | null;
  created_at: string;
  medicine?: Pick<Medicine, 'id' | 'name'> | null;
  performed_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface PharmacyPurchase {
  id: string;
  purchase_number: string;
  supplier_id: string | null;
  invoice_reference: string | null;
  purchase_date: string;
  total_amount: number;
  status: PurchaseStatus;
  confirmed_at: string | null;
  supplier?: Pick<Supplier, 'id' | 'name'> | null;
}

export interface PharmacySale {
  id: string;
  sale_number: string;
  patient_id: string | null;
  prescription_id: string | null;
  total_amount: number;
  payment_method: PaymentMethod;
  sold_at: string;
  voided_at: string | null;
  patient?: Pick<Patient, 'id' | 'full_name'> | null;
  sold_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  payment_method: PaymentMethod;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  recorded_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface PatientDocument {
  id: string;
  patient_id: string;
  title: string;
  doc_type: DocumentType;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  uploaded_by_profile?: Pick<Profile, 'id' | 'full_name'> | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  user?: Pick<Profile, 'id' | 'full_name' | 'role'> | null;
}

export interface ClinicSettings {
  id: boolean;
  clinic_name: string;
  logo_url: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  currency: string;
  currency_symbol: string;
  receipt_footer: string | null;
  low_stock_threshold: number;
  expiry_warning_days: number;
}

export interface DashboardSummary {
  patients_total: number;
  patients_today: number;
  appointments_today: number;
  appointments_done: number;
  waiting_now: number;
  treatments_today: number;
  treatment_income: number;
  pharmacy_income: number;
  expenses_today: number;
  outstanding_total: number;
  outstanding_patients: number;
  partial_patients: number;
  unpaid_patients: number;
  low_stock: number;
  expiring_soon: number;
}
