/**
 * DEMO DATA — not used by the real application.
 *
 * `npm run demo` builds the app with `@/lib/supabase` aliased to the in-memory
 * client in this folder, so the screens can be explored (and screenshotted)
 * without a Supabase project. Nothing here is loaded by `npm run dev` or
 * `npm run build`.
 */

const today = new Date();
const iso = (d: Date) => d.toISOString();
const day = (offset: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (offset: number, hour: number, minute = 0) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, minute, 0, 0);
  return iso(d);
};

export const profiles = [
  { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin', phone: '+252 63 4455001', email: 'amina@clinic.so', specialty: 'Orthodontics', photo_url: null, status: 'active', joined_date: '2021-03-01', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-2', full_name: 'Dr. Omar Jama', role: 'dentist', phone: '+252 63 4455002', email: 'omar@clinic.so', specialty: 'Endodontics', photo_url: null, status: 'active', joined_date: '2022-07-14', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-3', full_name: 'Dr. Hodan Ali', role: 'dentist', phone: '+252 63 4455003', email: 'hodan@clinic.so', specialty: 'Oral surgery', photo_url: null, status: 'active', joined_date: '2023-01-09', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist', phone: '+252 61 1112223', email: 'faisal@clinic.so', specialty: null, photo_url: null, status: 'active', joined_date: '2024-02-11', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-5', full_name: 'Nasra Ibrahim', role: 'pharmacist', phone: '+252 61 3334445', email: 'nasra@clinic.so', specialty: null, photo_url: null, status: 'active', joined_date: '2023-05-22', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-6', full_name: 'Kaltun Osman', role: 'receptionist', phone: '+252 63 9990001', email: 'kaltun@clinic.so', specialty: null, photo_url: null, status: 'inactive', joined_date: '2025-02-17', created_at: iso(today), updated_at: iso(today) },
];

export const patients = [
  { id: 'p-1', patient_code: 'DNT-000001', full_name: 'Ahmed Mohamed Ali', gender: 'male', date_of_birth: null, age_years: 31, phone: '+252 63 4412200', alt_phone: null, address: 'Road No. 1, Hargeisa', emergency_contact_name: 'Sagal Ahmed', emergency_contact_phone: '+252 63 4412201', photo_url: null, allergies: 'Penicillin', medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-420, 9), created_by: 'u-4', created_at: at(-420, 9), updated_at: at(-420, 9), archived_at: null },
  { id: 'p-2', patient_code: 'DNT-000002', full_name: 'Sagal Ibrahim', gender: 'female', date_of_birth: null, age_years: 24, phone: '+252 61 7788110', alt_phone: null, address: 'Gabiley', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-260, 10), created_by: 'u-4', created_at: at(-260, 10), updated_at: at(-260, 10), archived_at: null },
  { id: 'p-3', patient_code: 'DNT-000003', full_name: 'Hamza Sheikh Nur', gender: 'male', date_of_birth: null, age_years: 38, phone: '+252 63 5566778', alt_phone: null, address: 'Berbera', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Latex', medical_conditions: 'Hypertension', current_medications: 'Amlodipine 5mg', notes: null, status: 'active', registered_at: at(-190, 11), created_by: 'u-4', created_at: at(-190, 11), updated_at: at(-190, 11), archived_at: null },
  { id: 'p-4', patient_code: 'DNT-000004', full_name: 'Zahra Abdi Yusuf', gender: 'female', date_of_birth: null, age_years: 19, phone: '+252 61 2233445', alt_phone: null, address: 'Hargeisa', emergency_contact_name: 'Abdi Yusuf', emergency_contact_phone: '+252 61 2233440', photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-150, 9), created_by: 'u-4', created_at: at(-150, 9), updated_at: at(-150, 9), archived_at: null },
  { id: 'p-5', patient_code: 'DNT-000005', full_name: 'Bashir Duale Farah', gender: 'male', date_of_birth: null, age_years: 57, phone: '+252 63 2211009', alt_phone: null, address: 'Hargeisa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: 'Diabetes type 2', current_medications: 'Metformin', notes: null, status: 'active', registered_at: at(-120, 14), created_by: 'u-4', created_at: at(-120, 14), updated_at: at(-120, 14), archived_at: null },
  { id: 'p-6', patient_code: 'DNT-000006', full_name: 'Khadra Hersi', gender: 'female', date_of_birth: null, age_years: 29, phone: '+252 61 3344556', alt_phone: null, address: 'Hargeisa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-95, 12), created_by: 'u-4', created_at: at(-95, 12), updated_at: at(-95, 12), archived_at: null },
  { id: 'p-7', patient_code: 'DNT-000007', full_name: 'Ismail Abdi Gele', gender: 'male', date_of_birth: null, age_years: 17, phone: '+252 63 6677889', alt_phone: null, address: 'Gabiley', emergency_contact_name: 'Abdi Gele', emergency_contact_phone: '+252 63 6677880', photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-40, 10), created_by: 'u-4', created_at: at(-40, 10), updated_at: at(-40, 10), archived_at: null },
  { id: 'p-8', patient_code: 'DNT-000008', full_name: 'Muna Yusuf Abdillahi', gender: 'female', date_of_birth: null, age_years: 44, phone: '+252 61 8899007', alt_phone: null, address: 'Burco', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Aspirin', medical_conditions: null, current_medications: null, notes: null, status: 'inactive', registered_at: at(-380, 15), created_by: 'u-4', created_at: at(-380, 15), updated_at: at(-380, 15), archived_at: null },
  { id: 'p-9', patient_code: 'DNT-000009', full_name: 'Amina Salah Jama', gender: 'female', date_of_birth: null, age_years: 26, phone: '+252 61 6677889', alt_phone: null, address: 'Berbera', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Codeine', medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-20, 9), created_by: 'u-4', created_at: at(-20, 9), updated_at: at(-20, 9), archived_at: null },
  { id: 'p-10', patient_code: 'DNT-000010', full_name: 'Yasin Warsame', gender: 'male', date_of_birth: null, age_years: 35, phone: '+252 63 1122334', alt_phone: null, address: 'Hargeisa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-4, 11), created_by: 'u-4', created_at: at(-4, 11), updated_at: at(-4, 11), archived_at: null },
  { id: 'p-11', patient_code: 'DNT-000011', full_name: 'Farhia Mohamud', gender: 'female', date_of_birth: null, age_years: 22, phone: '+252 61 4455663', alt_phone: null, address: 'Hargeisa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-1, 10), created_by: 'u-4', created_at: at(-1, 10), updated_at: at(-1, 10), archived_at: null },
  { id: 'p-12', patient_code: 'DNT-000012', full_name: 'Cabdi Nuur Jibril', gender: 'male', date_of_birth: null, age_years: 61, phone: '+252 63 7788990', alt_phone: null, address: 'Borama', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Ibuprofen', medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(0, 8, 40), created_by: 'u-4', created_at: at(0, 8, 40), updated_at: at(0, 8, 40), archived_at: null },
];

export const treatmentTypes = [
  { id: 'tt-1', code: 'CONSULT', name: 'Consultation', category: 'general', default_price: 5, is_active: true, sort_order: 10 },
  { id: 'tt-2', code: 'SCALING', name: 'Scaling / cleaning', category: 'preventive', default_price: 20, is_active: true, sort_order: 30 },
  { id: 'tt-3', code: 'FILLING', name: 'Filling', category: 'restorative', default_price: 25, is_active: true, sort_order: 40 },
  { id: 'tt-4', code: 'EXTRACT', name: 'Tooth extraction', category: 'surgical', default_price: 15, is_active: true, sort_order: 50 },
  { id: 'tt-5', code: 'RCT', name: 'Root canal treatment', category: 'endodontic', default_price: 120, is_active: true, sort_order: 70 },
  { id: 'tt-6', code: 'CROWN', name: 'Crown', category: 'prosthetic', default_price: 150, is_active: true, sort_order: 80 },
  { id: 'tt-7', code: 'DENTURE', name: 'Denture', category: 'prosthetic', default_price: 250, is_active: true, sort_order: 110 },
  { id: 'tt-8', code: 'ORTHO', name: 'Orthodontics / braces', category: 'orthodontic', default_price: 500, is_active: true, sort_order: 130 },
  { id: 'tt-9', code: 'ORTHO_ADJ', name: 'Braces adjustment', category: 'orthodontic', default_price: 10, is_active: true, sort_order: 140 },
  { id: 'tt-10', code: 'GUM', name: 'Gum treatment', category: 'periodontal', default_price: 35, is_active: true, sort_order: 170 },
];

interface RawTreatment {
  id: string; patient_id: string; type: string; dentist_id: string;
  tooth_numbers: number[]; cost: number; discount: number;
  status: string; created: string; completed?: string | null;
}

const rawTreatments: RawTreatment[] = [
  { id: 't-1', patient_id: 'p-1', type: 'tt-8', dentist_id: 'u-1', tooth_numbers: [], cost: 500, discount: 0, status: 'in_progress', created: at(-120, 10) },
  { id: 't-2', patient_id: 'p-4', type: 'tt-8', dentist_id: 'u-1', tooth_numbers: [], cost: 600, discount: 50, status: 'in_progress', created: at(-75, 11) },
  { id: 't-3', patient_id: 'p-3', type: 'tt-5', dentist_id: 'u-2', tooth_numbers: [26], cost: 120, discount: 0, status: 'in_progress', created: at(-28, 9) },
  { id: 't-4', patient_id: 'p-5', type: 'tt-6', dentist_id: 'u-2', tooth_numbers: [46], cost: 150, discount: 0, status: 'in_progress', created: at(-14, 12) },
  { id: 't-5', patient_id: 'p-2', type: 'tt-3', dentist_id: 'u-3', tooth_numbers: [36], cost: 25, discount: 0, status: 'completed', created: at(-9, 10), completed: at(-9, 11) },
  { id: 't-6', patient_id: 'p-6', type: 'tt-2', dentist_id: 'u-1', tooth_numbers: [], cost: 20, discount: 0, status: 'completed', created: at(-7, 9), completed: at(-7, 10) },
  { id: 't-7', patient_id: 'p-7', type: 'tt-4', dentist_id: 'u-3', tooth_numbers: [48], cost: 15, discount: 0, status: 'completed', created: at(-5, 14), completed: at(-5, 15) },
  { id: 't-8', patient_id: 'p-9', type: 'tt-10', dentist_id: 'u-1', tooth_numbers: [], cost: 35, discount: 0, status: 'in_progress', created: at(-3, 11) },
  { id: 't-9', patient_id: 'p-12', type: 'tt-7', dentist_id: 'u-2', tooth_numbers: [], cost: 250, discount: 25, status: 'in_progress', created: at(-2, 10) },
  { id: 't-10', patient_id: 'p-10', type: 'tt-3', dentist_id: 'u-3', tooth_numbers: [16, 17], cost: 50, discount: 0, status: 'completed', created: at(-1, 15), completed: at(-1, 16) },
  { id: 't-11', patient_id: 'p-11', type: 'tt-1', dentist_id: 'u-1', tooth_numbers: [], cost: 5, discount: 0, status: 'completed', created: at(0, 9), completed: at(0, 9, 20) },
  { id: 't-12', patient_id: 'p-3', type: 'tt-3', dentist_id: 'u-2', tooth_numbers: [37], cost: 25, discount: 0, status: 'completed', created: at(-40, 10), completed: at(-40, 11) },
];

interface RawPayment {
  id: string; treatment_id: string; amount: number; method: string; when: string; ref?: string | null;
}

/** Installment histories — the "hafto" the paper book could not track. */
const rawPayments: RawPayment[] = [
  { id: 'pay-1', treatment_id: 't-1', amount: 100, method: 'cash', when: at(-120, 10, 30) },
  { id: 'pay-2', treatment_id: 't-1', amount: 50, method: 'zaad', when: at(-90, 11), ref: 'ZAAD-88213' },
  { id: 'pay-3', treatment_id: 't-1', amount: 100, method: 'evc_plus', when: at(-60, 10), ref: 'EVC-40021' },
  { id: 'pay-4', treatment_id: 't-1', amount: 50, method: 'cash', when: at(-30, 9) },
  { id: 'pay-5', treatment_id: 't-2', amount: 200, method: 'bank', when: at(-75, 11, 30), ref: 'DAH-77120' },
  { id: 'pay-6', treatment_id: 't-2', amount: 100, method: 'edahab', when: at(-35, 12), ref: 'EDH-55418' },
  { id: 'pay-7', treatment_id: 't-3', amount: 60, method: 'cash', when: at(-28, 9, 40) },
  { id: 'pay-8', treatment_id: 't-4', amount: 50, method: 'cash', when: at(-14, 12, 30) },
  { id: 'pay-9', treatment_id: 't-5', amount: 25, method: 'cash', when: at(-9, 11) },
  { id: 'pay-10', treatment_id: 't-6', amount: 20, method: 'evc_plus', when: at(-7, 10), ref: 'EVC-40188' },
  { id: 'pay-11', treatment_id: 't-7', amount: 15, method: 'cash', when: at(-5, 15) },
  { id: 'pay-12', treatment_id: 't-12', amount: 25, method: 'cash', when: at(-40, 11) },
  { id: 'pay-13', treatment_id: 't-10', amount: 50, method: 'zaad', when: at(-1, 16), ref: 'ZAAD-88990' },
  { id: 'pay-14', treatment_id: 't-11', amount: 5, method: 'cash', when: at(0, 9, 25) },
  { id: 'pay-15', treatment_id: 't-9', amount: 75, method: 'cash', when: at(0, 10, 15) },
  { id: 'pay-16', treatment_id: 't-8', amount: 20, method: 'edahab', when: at(0, 11, 5), ref: 'EDH-55990' },
];

const patientById = (id: string) => patients.find((p) => p.id === id)!;
const profileById = (id: string) => profiles.find((p) => p.id === id)!;
const typeById = (id: string) => treatmentTypes.find((t) => t.id === id)!;

export const payments = rawPayments.map((p, i) => {
  const treatment = rawTreatments.find((t) => t.id === p.treatment_id)!;
  const patient = patientById(treatment.patient_id);
  return {
    id: p.id,
    receipt_number: `RCP-${String(i + 1).padStart(6, '0')}`,
    patient_id: patient.id,
    treatment_id: treatment.id,
    ortho_case_id: null,
    pharmacy_sale_id: null,
    amount: p.amount,
    method: p.method,
    paid_at: p.when,
    reference: p.ref ?? null,
    notes: null,
    received_by: 'u-4',
    created_at: p.when,
    voided_at: null,
    void_reason: null,
    patient: { id: patient.id, full_name: patient.full_name, patient_code: patient.patient_code },
    treatment: { id: treatment.id, description: null, treatment_type: { name: typeById(treatment.type).name } },
    received_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' },
  };
});

export const treatments = rawTreatments.map((t) => ({
  id: t.id,
  patient_id: t.patient_id,
  plan_id: null,
  treatment_type_id: t.type,
  dentist_id: t.dentist_id,
  tooth_numbers: t.tooth_numbers,
  description: null,
  estimated_cost: t.cost,
  discount: t.discount,
  final_cost: t.cost - t.discount,
  priority: 'normal',
  planned_date: null,
  started_at: t.created,
  completed_at: t.completed ?? null,
  status: t.status,
  is_waived: false,
  notes: null,
  created_at: t.created,
  archived_at: null,
}));

/** Mirrors v_treatment_balances: paid and balance derived from payments. */
export function buildTreatmentBalances() {
  return treatments.map((t) => {
    const mine = payments.filter((p) => p.treatment_id === t.id && !p.voided_at);
    const paid = mine.reduce((sum, p) => sum + p.amount, 0);
    const balance = Math.max(t.final_cost - paid, 0);
    return {
      treatment_id: t.id,
      patient_id: t.patient_id,
      plan_id: null,
      dentist_id: t.dentist_id,
      treatment_type_id: t.treatment_type_id,
      treatment_name: typeById(t.treatment_type_id!).name,
      treatment_category: typeById(t.treatment_type_id!).category,
      tooth_numbers: t.tooth_numbers,
      status: t.status,
      is_waived: false,
      planned_date: null,
      completed_at: t.completed_at,
      created_at: t.created_at,
      estimated_cost: t.estimated_cost,
      discount: t.discount,
      final_cost: t.final_cost,
      amount_paid: paid,
      balance,
      last_payment_at: mine.length ? mine[mine.length - 1].paid_at : null,
      payment_count: mine.length,
      payment_status: balance === 0 ? 'paid' : paid === 0 ? 'unpaid' : 'partial',
    };
  });
}

export const orthoCases = [
  {
    id: 'oc-1', patient_id: 'p-1', treatment_id: 't-1', dentist_id: 'u-1',
    braces_type: 'Metal fixed', upper_arch: true, lower_arch: true,
    start_date: day(-120), estimated_months: 18, current_stage: 'Levelling and aligning',
    status: 'active', notes: 'Class II division 1. Elastics from month 6.',
    created_at: at(-120, 10),
    patient: { id: 'p-1', full_name: 'Ahmed Mohamed Ali', patient_code: 'DNT-000001', phone: '+252 63 4412200', allergies: 'Penicillin' },
    dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' },
  },
  {
    id: 'oc-2', patient_id: 'p-4', treatment_id: 't-2', dentist_id: 'u-1',
    braces_type: 'Ceramic fixed', upper_arch: true, lower_arch: false,
    start_date: day(-75), estimated_months: 14, current_stage: 'Space closure',
    status: 'active', notes: null,
    created_at: at(-75, 11),
    patient: { id: 'p-4', full_name: 'Zahra Abdi Yusuf', patient_code: 'DNT-000004', phone: '+252 61 2233445', allergies: null },
    dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' },
  },
];

export const orthoVisits = [
  { id: 'ov-1', case_id: 'oc-1', visit_date: day(-90), dentist_id: 'u-1', adjustment: 'Archwire tightened, upper', archwire_change: '0.014 NiTi → 0.016 NiTi', elastics: null, observation: 'Good alignment progress', compliance: 'Good', next_visit_date: day(-60), notes: null, created_at: at(-90, 11), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ov-2', case_id: 'oc-1', visit_date: day(-60), dentist_id: 'u-1', adjustment: 'Both arches tightened', archwire_change: '0.016 NiTi → 0.018 SS', elastics: 'Class II, 3/16"', observation: 'Mild gingival inflammation, oral hygiene advice given', compliance: 'Fair', next_visit_date: day(-30), notes: null, created_at: at(-60, 10), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ov-3', case_id: 'oc-1', visit_date: day(-30), dentist_id: 'u-1', adjustment: 'Elastics continued, bracket rebonded on 24', archwire_change: null, elastics: 'Class II, 3/16"', observation: 'Overjet reduced to 3mm', compliance: 'Good', next_visit_date: day(2), notes: 'Patient wearing elastics as instructed', created_at: at(-30, 9), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ov-4', case_id: 'oc-2', visit_date: day(-35), dentist_id: 'u-1', adjustment: 'Power chain placed, upper 13-23', archwire_change: '0.018 SS', elastics: null, observation: 'Space closing well', compliance: 'Excellent', next_visit_date: day(5), notes: null, created_at: at(-35, 12), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
];

export const appointments = [
  { id: 'a-1', patient_id: 'p-12', dentist_id: 'u-2', treatment_type_id: 'tt-7', scheduled_at: at(0, 8, 30), duration_minutes: 45, status: 'completed', notes: 'Denture impression', queue_number: 1, queue_state: 'completed', checked_in_at: at(0, 8, 20), called_at: at(0, 8, 28), started_at: at(0, 8, 32), completed_at: at(0, 9, 10), created_at: at(-5, 10) },
  { id: 'a-2', patient_id: 'p-11', dentist_id: 'u-1', treatment_type_id: 'tt-1', scheduled_at: at(0, 9, 0), duration_minutes: 20, status: 'completed', notes: 'First visit', queue_number: 2, queue_state: 'completed', checked_in_at: at(0, 8, 50), called_at: at(0, 8, 58), started_at: at(0, 9, 0), completed_at: at(0, 9, 20), created_at: at(-2, 9) },
  { id: 'a-3', patient_id: 'p-3', dentist_id: 'u-2', treatment_type_id: 'tt-5', scheduled_at: at(0, 10, 0), duration_minutes: 60, status: 'in_treatment', notes: 'Root canal tooth 26, session 2 of 3', queue_number: 3, queue_state: 'in_treatment', checked_in_at: at(0, 9, 45), called_at: at(0, 9, 58), started_at: at(0, 10, 2), completed_at: null, created_at: at(-7, 11) },
  { id: 'a-4', patient_id: 'p-9', dentist_id: 'u-1', treatment_type_id: 'tt-10', scheduled_at: at(0, 11, 0), duration_minutes: 30, status: 'checked_in', notes: 'Gum treatment review', queue_number: 4, queue_state: 'waiting', checked_in_at: at(0, 10, 40), called_at: null, started_at: null, completed_at: null, created_at: at(-3, 12) },
  { id: 'a-5', patient_id: 'p-5', dentist_id: 'u-2', treatment_type_id: 'tt-6', scheduled_at: at(0, 11, 30), duration_minutes: 45, status: 'checked_in', notes: 'Crown fitting tooth 46', queue_number: 5, queue_state: 'waiting', checked_in_at: at(0, 11, 5), called_at: null, started_at: null, completed_at: null, created_at: at(-6, 9) },
  { id: 'a-6', patient_id: 'p-6', dentist_id: 'u-3', treatment_type_id: 'tt-2', scheduled_at: at(0, 13, 0), duration_minutes: 30, status: 'confirmed', notes: 'Six-month cleaning', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-10, 10) },
  { id: 'a-7', patient_id: 'p-1', dentist_id: 'u-1', treatment_type_id: 'tt-9', scheduled_at: at(0, 14, 0), duration_minutes: 30, status: 'scheduled', notes: 'Braces adjustment', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-30, 9) },
  { id: 'a-8', patient_id: 'p-10', dentist_id: 'u-3', treatment_type_id: 'tt-3', scheduled_at: at(0, 15, 0), duration_minutes: 45, status: 'scheduled', notes: 'Filling teeth 16, 17', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-2, 14) },
  { id: 'a-9', patient_id: 'p-7', dentist_id: 'u-3', treatment_type_id: 'tt-1', scheduled_at: at(0, 16, 0), duration_minutes: 20, status: 'scheduled', notes: 'Post-extraction check', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-5, 15) },
  { id: 'a-10', patient_id: 'p-4', dentist_id: 'u-1', treatment_type_id: 'tt-9', scheduled_at: at(2, 9, 30), duration_minutes: 30, status: 'confirmed', notes: 'Braces adjustment', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-35, 12) },
  { id: 'a-11', patient_id: 'p-2', dentist_id: 'u-2', treatment_type_id: 'tt-2', scheduled_at: at(3, 11, 0), duration_minutes: 30, status: 'scheduled', notes: null, queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-1, 9) },
  { id: 'a-12', patient_id: 'p-8', dentist_id: 'u-1', treatment_type_id: 'tt-1', scheduled_at: at(-2, 10, 0), duration_minutes: 20, status: 'no_show', notes: null, queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-8, 10) },
  { id: 'a-13', patient_id: 'p-9', dentist_id: 'u-2', treatment_type_id: 'tt-4', scheduled_at: at(-3, 14, 0), duration_minutes: 30, status: 'cancelled', notes: 'Patient rescheduled', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-9, 11) },
].map((a) => {
  const patient = patientById(a.patient_id);
  const dentist = a.dentist_id ? profileById(a.dentist_id) : null;
  const type = a.treatment_type_id ? typeById(a.treatment_type_id) : null;
  return {
    ...a,
    patient: { id: patient.id, full_name: patient.full_name, patient_code: patient.patient_code, phone: patient.phone },
    dentist: dentist ? { id: dentist.id, full_name: dentist.full_name } : null,
    treatment_type: type ? { id: type.id, name: type.name } : null,
  };
});

export const toothRecords = [
  { id: 'tr-1', patient_id: 'p-1', tooth_number: 16, condition: 'filling', proposed_treatment: null, existing_treatment: 'Composite filling', surface: 'Occlusal', notes: null, examination_id: null, recorded_by: 'u-1', recorded_at: at(-118, 10), is_current: true, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-2', patient_id: 'p-1', tooth_number: 24, condition: 'caries', proposed_treatment: 'Composite filling', existing_treatment: null, surface: 'Mesial', notes: 'Small lesion, monitor', examination_id: null, recorded_by: 'u-1', recorded_at: at(-30, 9), is_current: true, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-3', patient_id: 'p-1', tooth_number: 36, condition: 'root_canal', proposed_treatment: null, existing_treatment: 'RCT completed 2024', surface: null, notes: null, examination_id: null, recorded_by: 'u-2', recorded_at: at(-118, 11), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'tr-4', patient_id: 'p-1', tooth_number: 48, condition: 'extracted', proposed_treatment: null, existing_treatment: 'Extracted', surface: null, notes: null, examination_id: null, recorded_by: 'u-3', recorded_at: at(-118, 11, 10), is_current: true, recorded_by_profile: { id: 'u-3', full_name: 'Dr. Hodan Ali' } },
  { id: 'tr-5', patient_id: 'p-1', tooth_number: 46, condition: 'crown', proposed_treatment: null, existing_treatment: 'Zirconia crown', surface: null, notes: null, examination_id: null, recorded_by: 'u-2', recorded_at: at(-60, 10), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'tr-6', patient_id: 'p-1', tooth_number: 11, condition: 'sensitive', proposed_treatment: 'Desensitising varnish', existing_treatment: null, surface: null, notes: 'Cold sensitivity reported', examination_id: null, recorded_by: 'u-1', recorded_at: at(-30, 9, 5), is_current: true, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-7', patient_id: 'p-1', tooth_number: 24, condition: 'healthy', proposed_treatment: null, existing_treatment: null, surface: null, notes: 'Initial charting', examination_id: null, recorded_by: 'u-1', recorded_at: at(-118, 10, 20), is_current: false, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-8', patient_id: 'p-3', tooth_number: 26, condition: 'root_canal', proposed_treatment: 'Crown after RCT', existing_treatment: 'RCT in progress', surface: null, notes: 'Session 2 of 3', examination_id: null, recorded_by: 'u-2', recorded_at: at(-28, 9), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'tr-9', patient_id: 'p-3', tooth_number: 37, condition: 'filling', proposed_treatment: null, existing_treatment: 'Composite', surface: 'Occlusal', notes: null, examination_id: null, recorded_by: 'u-2', recorded_at: at(-40, 10), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const examinations = [
  { id: 'ex-1', patient_id: 'p-1', dentist_id: 'u-1', exam_date: day(-120), chief_complaint: 'Crowded upper front teeth, unhappy with appearance', medical_history: 'Penicillin allergy', dental_history: 'Filling on 16 in 2023, RCT on 36 in 2024', findings: 'Class II division 1 malocclusion, overjet 6mm, moderate upper crowding', diagnosis: 'Class II division 1 with crowding', recommended_treatment: 'Fixed orthodontic appliance, both arches, 18 months', notes: 'Patient counselled on hygiene and elastics', created_at: at(-120, 10), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ex-2', patient_id: 'p-1', dentist_id: 'u-1', exam_date: day(-30), chief_complaint: 'Routine braces review', medical_history: null, dental_history: null, findings: 'Overjet reduced to 3mm, mild gingivitis upper anterior', diagnosis: 'Treatment progressing as planned', recommended_treatment: 'Continue elastics, improve brushing', notes: null, created_at: at(-30, 9), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ex-3', patient_id: 'p-3', dentist_id: 'u-2', exam_date: day(-28), chief_complaint: 'Severe pain upper left, worse at night', medical_history: 'Hypertension, on Amlodipine', dental_history: 'Filling on 37', findings: 'Deep caries 26 with pulpal involvement, tender to percussion', diagnosis: 'Irreversible pulpitis, tooth 26', recommended_treatment: 'Root canal treatment then crown', notes: 'Started RCT same day', created_at: at(-28, 9), dentist: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const medicineCategories = [
  { id: 'mc-1', name: 'Antibiotic' }, { id: 'mc-2', name: 'Analgesic' },
  { id: 'mc-3', name: 'Anaesthetic' }, { id: 'mc-4', name: 'Anti-inflammatory' },
  { id: 'mc-5', name: 'Antiseptic / mouthwash' }, { id: 'mc-6', name: 'Fluoride / preventive' },
];

interface RawMedicine {
  id: string; name: string; generic: string | null; cat: string; form: string;
  strength: string; purchase: number; selling: number; min: number;
  batches: { qty: number; expiry: string | null }[];
}

const rawMedicines: RawMedicine[] = [
  { id: 'm-1', name: 'Amoxicillin', generic: 'Amoxicillin trihydrate', cat: 'mc-1', form: 'capsule', strength: '500mg', purchase: 0.18, selling: 0.4, min: 100, batches: [{ qty: 420, expiry: day(400) }, { qty: 60, expiry: day(-15) }] },
  { id: 'm-2', name: 'Metronidazole', generic: 'Metronidazole', cat: 'mc-1', form: 'tablet', strength: '400mg', purchase: 0.12, selling: 0.3, min: 80, batches: [{ qty: 240, expiry: day(300) }] },
  { id: 'm-3', name: 'Paracetamol', generic: 'Acetaminophen', cat: 'mc-2', form: 'tablet', strength: '500mg', purchase: 0.05, selling: 0.15, min: 200, batches: [{ qty: 620, expiry: day(500) }] },
  { id: 'm-4', name: 'Ibuprofen', generic: 'Ibuprofen', cat: 'mc-4', form: 'tablet', strength: '400mg', purchase: 0.08, selling: 0.2, min: 150, batches: [{ qty: 95, expiry: day(210) }] },
  { id: 'm-5', name: 'Lidocaine', generic: 'Lidocaine HCl 2% with adrenaline', cat: 'mc-3', form: 'cartridge', strength: '1.8ml', purchase: 0.9, selling: 1.5, min: 50, batches: [{ qty: 38, expiry: day(25) }] },
  { id: 'm-6', name: 'Chlorhexidine mouthwash', generic: 'Chlorhexidine gluconate 0.2%', cat: 'mc-5', form: 'syrup', strength: '300ml', purchase: 2.4, selling: 4.5, min: 20, batches: [{ qty: 12, expiry: day(160) }] },
  { id: 'm-7', name: 'Fluoride varnish', generic: 'Sodium fluoride 5%', cat: 'mc-6', form: 'gel', strength: '10ml', purchase: 6.5, selling: 12, min: 15, batches: [{ qty: 0, expiry: null }] },
  { id: 'm-8', name: 'Diclofenac', generic: 'Diclofenac sodium', cat: 'mc-4', form: 'tablet', strength: '50mg', purchase: 0.1, selling: 0.25, min: 60, batches: [{ qty: 180, expiry: day(340) }] },
];

export const medicines = rawMedicines.map((m) => ({
  id: m.id, name: m.name, generic_name: m.generic, category_id: m.cat,
  dosage_form: m.form, strength: m.strength, barcode: null,
  purchase_price: m.purchase, selling_price: m.selling, minimum_stock: m.min, is_active: true,
}));

export const stockBatches = rawMedicines.flatMap((m, mi) =>
  m.batches.map((b, bi) => ({
    id: `sb-${mi}-${bi}`,
    medicine_id: m.id,
    batch_number: `B-${String(mi + 1).padStart(2, '0')}${bi ? 'B' : 'A'}`,
    expiry_date: b.expiry,
    quantity: b.qty,
    purchase_price: m.purchase,
    supplier_id: 'sup-1',
    received_at: at(-60, 9),
    medicine: { id: m.id, name: m.name, strength: m.strength, dosage_form: m.form },
  })),
);

const EXPIRY_WARNING_DAYS = 30;

/** Mirrors v_medicine_stock, including the expiry-aware status. */
export function buildMedicineStock() {
  return rawMedicines.map((m) => {
    const batches = stockBatches.filter((b) => b.medicine_id === m.id);
    const usable = batches.filter((b) => !b.expiry_date || new Date(b.expiry_date) > today);
    const expired = batches.filter((b) => b.expiry_date && new Date(b.expiry_date) <= today);
    const usableQty = usable.reduce((s, b) => s + b.quantity, 0);
    const expiredQty = expired.reduce((s, b) => s + b.quantity, 0);
    const earliest = usable.filter((b) => b.quantity > 0 && b.expiry_date)
      .map((b) => b.expiry_date!)
      .sort()[0] ?? null;
    const warnBy = new Date(today);
    warnBy.setDate(warnBy.getDate() + EXPIRY_WARNING_DAYS);

    const status = usableQty === 0 ? 'out_of_stock'
      : usableQty <= m.min ? 'low_stock'
      : earliest && new Date(earliest) <= warnBy ? 'expiring_soon'
      : 'in_stock';

    return {
      medicine_id: m.id, name: m.name, generic_name: m.generic,
      dosage_form: m.form, strength: m.strength, barcode: null,
      category_id: m.cat,
      category_name: medicineCategories.find((c) => c.id === m.cat)?.name ?? null,
      purchase_price: m.purchase, selling_price: m.selling,
      minimum_stock: m.min, is_active: true,
      total_quantity: usableQty + expiredQty,
      usable_quantity: usableQty,
      expired_quantity: expiredQty,
      earliest_expiry: earliest,
      stock_status: status,
    };
  });
}

export const prescriptions = [
  {
    id: 'rx-1', prescription_number: 'RX-000001', patient_id: 'p-3', dentist_id: 'u-2',
    prescribed_at: at(0, 10, 20), status: 'pending', notes: 'Start today, after food',
    patient: { id: 'p-3', full_name: 'Hamza Sheikh Nur', patient_code: 'DNT-000003', allergies: 'Latex' },
    dentist: { id: 'u-2', full_name: 'Dr. Omar Jama' },
    items: [
      { id: 'ri-1', prescription_id: 'rx-1', medicine_id: 'm-1', medicine_name: 'Amoxicillin', strength: '500mg', dose: '1 capsule', frequency: '3 times a day', duration: '5 days', quantity: 15, dispensed_quantity: 0, instructions: 'After food' },
      { id: 'ri-2', prescription_id: 'rx-1', medicine_id: 'm-4', medicine_name: 'Ibuprofen', strength: '400mg', dose: '1 tablet', frequency: 'Every 8 hours as needed', duration: '3 days', quantity: 9, dispensed_quantity: 0, instructions: 'Do not exceed 3 a day' },
    ],
  },
  {
    id: 'rx-2', prescription_number: 'RX-000002', patient_id: 'p-12', dentist_id: 'u-2',
    prescribed_at: at(0, 9, 15), status: 'partially_dispensed', notes: null,
    patient: { id: 'p-12', full_name: 'Cabdi Nuur Jibril', patient_code: 'DNT-000012', allergies: 'Ibuprofen' },
    dentist: { id: 'u-2', full_name: 'Dr. Omar Jama' },
    items: [
      { id: 'ri-3', prescription_id: 'rx-2', medicine_id: 'm-3', medicine_name: 'Paracetamol', strength: '500mg', dose: '2 tablets', frequency: 'Every 6 hours', duration: '4 days', quantity: 32, dispensed_quantity: 16, instructions: null },
      { id: 'ri-4', prescription_id: 'rx-2', medicine_id: 'm-6', medicine_name: 'Chlorhexidine mouthwash', strength: '300ml', dose: '10ml rinse', frequency: 'Twice a day', duration: '7 days', quantity: 1, dispensed_quantity: 1, instructions: 'Do not swallow' },
    ],
  },
  {
    id: 'rx-3', prescription_number: 'RX-000003', patient_id: 'p-7', dentist_id: 'u-3',
    prescribed_at: at(-5, 15, 10), status: 'dispensed', notes: null,
    patient: { id: 'p-7', full_name: 'Ismail Abdi Gele', patient_code: 'DNT-000007', allergies: null },
    dentist: { id: 'u-3', full_name: 'Dr. Hodan Ali' },
    items: [
      { id: 'ri-5', prescription_id: 'rx-3', medicine_id: 'm-2', medicine_name: 'Metronidazole', strength: '400mg', dose: '1 tablet', frequency: '3 times a day', duration: '5 days', quantity: 15, dispensed_quantity: 15, instructions: 'No alcohol' },
      { id: 'ri-6', prescription_id: 'rx-3', medicine_id: 'm-3', medicine_name: 'Paracetamol', strength: '500mg', dose: '2 tablets', frequency: 'Every 6 hours', duration: '3 days', quantity: 24, dispensed_quantity: 24, instructions: null },
    ],
  },
];

export const suppliers = [
  { id: 'sup-1', name: 'Hargeisa Medical Wholesale', phone: '+252 63 4000110', address: 'Industrial Road, Hargeisa', notes: 'Main supplier, 14-day terms', is_active: true },
  { id: 'sup-2', name: 'Berbera Pharma Imports', phone: '+252 63 4000220', address: 'Port Road, Berbera', notes: null, is_active: true },
  { id: 'sup-3', name: 'SomDent Supplies', phone: '+252 61 4000330', address: 'Hargeisa', notes: 'Dental consumables', is_active: true },
];

export const purchases = [
  { id: 'pu-1', purchase_number: 'PUR-000001', supplier_id: 'sup-1', invoice_reference: 'INV-88120', purchase_date: day(-60), total_amount: 186.4, status: 'confirmed', confirmed_at: at(-60, 9), supplier: { id: 'sup-1', name: 'Hargeisa Medical Wholesale' } },
  { id: 'pu-2', purchase_number: 'PUR-000002', supplier_id: 'sup-2', invoice_reference: 'BPI-2211', purchase_date: day(-25), total_amount: 74.2, status: 'confirmed', confirmed_at: at(-25, 11), supplier: { id: 'sup-2', name: 'Berbera Pharma Imports' } },
  { id: 'pu-3', purchase_number: 'PUR-000003', supplier_id: 'sup-1', invoice_reference: 'INV-88431', purchase_date: day(0), total_amount: 0, status: 'draft', confirmed_at: null, supplier: { id: 'sup-1', name: 'Hargeisa Medical Wholesale' } },
];

export const sales = [
  { id: 'sa-1', sale_number: 'SAL-000001', patient_id: 'p-7', prescription_id: 'rx-3', total_amount: 8.1, payment_method: 'cash', sold_at: at(-5, 15, 30), voided_at: null, patient: { id: 'p-7', full_name: 'Ismail Abdi Gele' }, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sa-2', sale_number: 'SAL-000002', patient_id: null, prescription_id: null, total_amount: 4.5, payment_method: 'evc_plus', sold_at: at(-2, 12), voided_at: null, patient: null, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sa-3', sale_number: 'SAL-000003', patient_id: 'p-12', prescription_id: 'rx-2', total_amount: 6.9, payment_method: 'cash', sold_at: at(0, 9, 40), voided_at: null, patient: { id: 'p-12', full_name: 'Cabdi Nuur Jibril' }, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sa-4', sale_number: 'SAL-000004', patient_id: null, prescription_id: null, total_amount: 12, payment_method: 'zaad', sold_at: at(0, 11, 20), voided_at: null, patient: null, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
];

export const stockMovements = [
  { id: 'sm-1', medicine_id: 'm-1', movement_type: 'purchase', quantity_before: 0, quantity_change: 420, quantity_after: 420, reason: 'Purchase PUR-000001', created_at: at(-60, 9), medicine: { id: 'm-1', name: 'Amoxicillin' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-2', medicine_id: 'm-3', movement_type: 'purchase', quantity_before: 0, quantity_change: 620, quantity_after: 620, reason: 'Purchase PUR-000001', created_at: at(-60, 9), medicine: { id: 'm-3', name: 'Paracetamol' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-3', medicine_id: 'm-2', movement_type: 'dispense', quantity_before: 255, quantity_change: -15, quantity_after: 240, reason: 'Prescription RX-000003', created_at: at(-5, 15, 20), medicine: { id: 'm-2', name: 'Metronidazole' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-4', medicine_id: 'm-3', movement_type: 'dispense', quantity_before: 660, quantity_change: -24, quantity_after: 636, reason: 'Prescription RX-000003', created_at: at(-5, 15, 22), medicine: { id: 'm-3', name: 'Paracetamol' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-5', medicine_id: 'm-5', movement_type: 'adjustment', quantity_before: 40, quantity_change: -2, quantity_after: 38, reason: 'Two cartridges broken during handling', created_at: at(-12, 14), medicine: { id: 'm-5', name: 'Lidocaine' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-6', medicine_id: 'm-3', movement_type: 'dispense', quantity_before: 636, quantity_change: -16, quantity_after: 620, reason: 'Prescription RX-000002', created_at: at(0, 9, 40), medicine: { id: 'm-3', name: 'Paracetamol' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-7', medicine_id: 'm-7', movement_type: 'sale', quantity_before: 12, quantity_change: -12, quantity_after: 0, reason: 'Sale SAL-000004', created_at: at(0, 11, 20), medicine: { id: 'm-7', name: 'Fluoride varnish' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
];

export const expenses = [
  { id: 'e-1', category: 'rent', description: 'Clinic rent — this month', amount: 800, expense_date: day(-8), payment_method: 'bank', receipt_url: null, notes: null, created_at: at(-8, 9), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'e-2', category: 'salaries', description: 'Staff salaries', amount: 1450, expense_date: day(-8), payment_method: 'bank', receipt_url: null, notes: null, created_at: at(-8, 9, 30), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'e-3', category: 'dental_supplies', description: 'Composite resin, burs and impression material', amount: 320, expense_date: day(-14), payment_method: 'cash', receipt_url: null, notes: 'SomDent Supplies', created_at: at(-14, 11), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-4', category: 'pharmacy_purchases', description: 'Purchase PUR-000002', amount: 74.2, expense_date: day(-25), payment_method: 'bank', receipt_url: null, notes: null, created_at: at(-25, 11), recorded_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'e-5', category: 'electricity', description: 'Electricity bill', amount: 145, expense_date: day(-6), payment_method: 'evc_plus', receipt_url: null, notes: null, created_at: at(-6, 10), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-6', category: 'water', description: 'Water supply', amount: 40, expense_date: day(-6), payment_method: 'cash', receipt_url: null, notes: null, created_at: at(-6, 10, 10), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-7', category: 'maintenance', description: 'Dental chair 2 servicing', amount: 180, expense_date: day(-3), payment_method: 'cash', receipt_url: null, notes: 'Compressor serviced', created_at: at(-3, 15), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'e-8', category: 'internet', description: 'Monthly internet', amount: 35, expense_date: day(0), payment_method: 'zaad', receipt_url: null, notes: null, created_at: at(0, 8, 30), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-9', category: 'cleaning', description: 'Cleaning and sterilisation supplies', amount: 62, expense_date: day(-1), payment_method: 'cash', receipt_url: null, notes: null, created_at: at(-1, 16), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
];

export const documents = [
  { id: 'd-1', patient_id: 'p-1', title: 'Panoramic X-ray — pre-treatment', doc_type: 'xray', storage_path: 'p-1/opg-pre.jpg', mime_type: 'image/jpeg', size_bytes: 1_840_221, uploaded_at: at(-120, 10, 40), uploaded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'd-2', patient_id: 'p-1', title: 'Orthodontic consent form (signed)', doc_type: 'consent', storage_path: 'p-1/consent.pdf', mime_type: 'application/pdf', size_bytes: 214_882, uploaded_at: at(-120, 11), uploaded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'd-3', patient_id: 'p-1', title: 'Intra-oral photos — month 3', doc_type: 'photo', storage_path: 'p-1/photos-m3.jpg', mime_type: 'image/jpeg', size_bytes: 962_004, uploaded_at: at(-30, 9, 30), uploaded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'd-4', patient_id: 'p-3', title: 'Periapical X-ray — tooth 26', doc_type: 'xray', storage_path: 'p-3/pa-26.jpg', mime_type: 'image/jpeg', size_bytes: 421_770, uploaded_at: at(-28, 9, 20), uploaded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const auditLogs = [
  { id: 'al-1', user_id: 'u-4', action: 'payment.record', entity: 'payments', entity_id: 'pay-16', details: { amount: 20, method: 'edahab', receipt_number: 'RCP-000016', balance_before: 35 }, created_at: at(0, 11, 5), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-2', user_id: 'u-4', action: 'payment.record', entity: 'payments', entity_id: 'pay-15', details: { amount: 75, method: 'cash', receipt_number: 'RCP-000015', balance_before: 225 }, created_at: at(0, 10, 15), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-3', user_id: 'u-2', action: 'prescriptions.insert', entity: 'prescriptions', entity_id: 'rx-1', details: { status: 'pending' }, created_at: at(0, 10, 20), user: { id: 'u-2', full_name: 'Dr. Omar Jama', role: 'dentist' } },
  { id: 'al-4', user_id: 'u-5', action: 'pharmacy.sale', entity: 'pharmacy_sales', entity_id: 'sa-4', details: { total: 12 }, created_at: at(0, 11, 20), user: { id: 'u-5', full_name: 'Nasra Ibrahim', role: 'pharmacist' } },
  { id: 'al-5', user_id: 'u-4', action: 'appointment.check_in', entity: 'appointments', entity_id: 'a-5', details: { queue_number: 5 }, created_at: at(0, 11, 5), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-6', user_id: 'u-1', action: 'tooth.record', entity: 'tooth_records', entity_id: 'tr-2', details: { tooth: 24, condition: 'caries' }, created_at: at(-30, 9), user: { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin' } },
  { id: 'al-7', user_id: 'u-4', action: 'patients.insert', entity: 'patients', entity_id: 'p-12', details: { full_name: 'Cabdi Nuur Jibril', patient_code: 'DNT-000012' }, created_at: at(0, 8, 40), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-8', user_id: 'u-1', action: 'payment.void', entity: 'payments', entity_id: 'pay-old', details: { reason: 'Entered twice by mistake', amount: 25 }, created_at: at(-4, 14), user: { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin' } },
  { id: 'al-9', user_id: 'u-5', action: 'pharmacy.purchase_confirm', entity: 'pharmacy_purchases', entity_id: 'pu-2', details: { total: 74.2 }, created_at: at(-25, 11), user: { id: 'u-5', full_name: 'Nasra Ibrahim', role: 'pharmacist' } },
  { id: 'al-10', user_id: 'u-1', action: 'user_permissions.insert', entity: 'user_permissions', entity_id: 'up-1', details: { permission: 'finance.write', granted: true }, created_at: at(-20, 9), user: { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin' } },
];

export const clinicSettings = {
  id: true,
  clinic_name: 'Hargeisa Dental Clinic',
  logo_url: null,
  phone: '+252 63 4455000',
  address: 'Road No. 1, Hargeisa, Somaliland',
  email: 'info@hargeisadental.so',
  currency: 'USD',
  currency_symbol: '$',
  receipt_footer: 'Thank you for visiting Hargeisa Dental Clinic. Mahadsanid!',
  low_stock_threshold: 10,
  expiry_warning_days: EXPIRY_WARNING_DAYS,
};

export const userPermissions = [
  { id: 'up-1', user_id: 'u-2', permission: 'finance.write', granted: true },
];
