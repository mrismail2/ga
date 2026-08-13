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
  { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin', phone: '+252 63 4455001', email: 'amina@clinic.so', specialty: 'Qalinka ilkaha', photo_url: null, status: 'active', joined_date: '2021-03-01', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-2', full_name: 'Dr. Omar Jama', role: 'dentist', phone: '+252 63 4455002', email: 'omar@clinic.so', specialty: 'Xididka iliga', photo_url: null, status: 'active', joined_date: '2022-07-14', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-3', full_name: 'Dr. Hodan Ali', role: 'dentist', phone: '+252 63 4455003', email: 'hodan@clinic.so', specialty: 'Qalliinka afka', photo_url: null, status: 'active', joined_date: '2023-01-09', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist', phone: '+252 61 1112223', email: 'faisal@clinic.so', specialty: null, photo_url: null, status: 'active', joined_date: '2024-02-11', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-5', full_name: 'Nasra Ibrahim', role: 'pharmacist', phone: '+252 61 3334445', email: 'nasra@clinic.so', specialty: null, photo_url: null, status: 'active', joined_date: '2023-05-22', created_at: iso(today), updated_at: iso(today) },
  { id: 'u-6', full_name: 'Kaltun Osman', role: 'receptionist', phone: '+252 63 9990001', email: 'kaltun@clinic.so', specialty: null, photo_url: null, status: 'inactive', joined_date: '2025-02-17', created_at: iso(today), updated_at: iso(today) },
];

export const patients = [
  { id: 'p-1', patient_code: 'DNT-000001', full_name: 'Ahmed Mohamed Ali', gender: 'male', date_of_birth: null, age_years: 31, phone: '+252 63 4412200', alt_phone: null, address: 'Waddo 1-aad, Hargeysa', emergency_contact_name: 'Sagal Ahmed', emergency_contact_phone: '+252 63 4412201', photo_url: null, allergies: 'Penicillin', medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-420, 9), created_by: 'u-4', created_at: at(-420, 9), updated_at: at(-420, 9), archived_at: null },
  { id: 'p-2', patient_code: 'DNT-000002', full_name: 'Sagal Ibrahim', gender: 'female', date_of_birth: null, age_years: 24, phone: '+252 61 7788110', alt_phone: null, address: 'Gabiley', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-260, 10), created_by: 'u-4', created_at: at(-260, 10), updated_at: at(-260, 10), archived_at: null },
  { id: 'p-3', patient_code: 'DNT-000003', full_name: 'Hamza Sheikh Nur', gender: 'male', date_of_birth: null, age_years: 38, phone: '+252 63 5566778', alt_phone: null, address: 'Berbera', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Latex', medical_conditions: 'Dhiig-karka', current_medications: 'Amlodipine 5mg', notes: null, status: 'active', registered_at: at(-190, 11), created_by: 'u-4', created_at: at(-190, 11), updated_at: at(-190, 11), archived_at: null },
  { id: 'p-4', patient_code: 'DNT-000004', full_name: 'Zahra Abdi Yusuf', gender: 'female', date_of_birth: null, age_years: 19, phone: '+252 61 2233445', alt_phone: null, address: 'Hargeysa', emergency_contact_name: 'Abdi Yusuf', emergency_contact_phone: '+252 61 2233440', photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-150, 9), created_by: 'u-4', created_at: at(-150, 9), updated_at: at(-150, 9), archived_at: null },
  { id: 'p-5', patient_code: 'DNT-000005', full_name: 'Bashir Duale Farah', gender: 'male', date_of_birth: null, age_years: 57, phone: '+252 63 2211009', alt_phone: null, address: 'Hargeysa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: 'Sonkorow nooca 2-aad', current_medications: 'Metformin', notes: null, status: 'active', registered_at: at(-120, 14), created_by: 'u-4', created_at: at(-120, 14), updated_at: at(-120, 14), archived_at: null },
  { id: 'p-6', patient_code: 'DNT-000006', full_name: 'Khadra Hersi', gender: 'female', date_of_birth: null, age_years: 29, phone: '+252 61 3344556', alt_phone: null, address: 'Hargeysa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-95, 12), created_by: 'u-4', created_at: at(-95, 12), updated_at: at(-95, 12), archived_at: null },
  { id: 'p-7', patient_code: 'DNT-000007', full_name: 'Ismail Abdi Gele', gender: 'male', date_of_birth: null, age_years: 17, phone: '+252 63 6677889', alt_phone: null, address: 'Gabiley', emergency_contact_name: 'Abdi Gele', emergency_contact_phone: '+252 63 6677880', photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-40, 10), created_by: 'u-4', created_at: at(-40, 10), updated_at: at(-40, 10), archived_at: null },
  { id: 'p-8', patient_code: 'DNT-000008', full_name: 'Muna Yusuf Abdillahi', gender: 'female', date_of_birth: null, age_years: 44, phone: '+252 61 8899007', alt_phone: null, address: 'Burco', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Aspirin', medical_conditions: null, current_medications: null, notes: null, status: 'inactive', registered_at: at(-380, 15), created_by: 'u-4', created_at: at(-380, 15), updated_at: at(-380, 15), archived_at: null },
  { id: 'p-9', patient_code: 'DNT-000009', full_name: 'Amina Salah Jama', gender: 'female', date_of_birth: null, age_years: 26, phone: '+252 61 6677889', alt_phone: null, address: 'Berbera', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Codeine', medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-20, 9), created_by: 'u-4', created_at: at(-20, 9), updated_at: at(-20, 9), archived_at: null },
  { id: 'p-10', patient_code: 'DNT-000010', full_name: 'Yasin Warsame', gender: 'male', date_of_birth: null, age_years: 35, phone: '+252 63 1122334', alt_phone: null, address: 'Hargeysa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-4, 11), created_by: 'u-4', created_at: at(-4, 11), updated_at: at(-4, 11), archived_at: null },
  { id: 'p-11', patient_code: 'DNT-000011', full_name: 'Farhia Mohamud', gender: 'female', date_of_birth: null, age_years: 22, phone: '+252 61 4455663', alt_phone: null, address: 'Hargeysa', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: null, medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(-1, 10), created_by: 'u-4', created_at: at(-1, 10), updated_at: at(-1, 10), archived_at: null },
  { id: 'p-12', patient_code: 'DNT-000012', full_name: 'Cabdi Nuur Jibril', gender: 'male', date_of_birth: null, age_years: 61, phone: '+252 63 7788990', alt_phone: null, address: 'Borama', emergency_contact_name: null, emergency_contact_phone: null, photo_url: null, allergies: 'Ibuprofen', medical_conditions: null, current_medications: null, notes: null, status: 'active', registered_at: at(0, 8, 40), created_by: 'u-4', created_at: at(0, 8, 40), updated_at: at(0, 8, 40), archived_at: null },
];

export const treatmentTypes = [
  { id: 'tt-1', code: 'CONSULT', name: 'La-talin', category: 'general', default_price: 5, is_active: true, sort_order: 10 },
  { id: 'tt-2', code: 'SCALING', name: 'Nadiifin ilkeed', category: 'preventive', default_price: 20, is_active: true, sort_order: 30 },
  { id: 'tt-3', code: 'FILLING', name: 'Buuxin ilig', category: 'restorative', default_price: 25, is_active: true, sort_order: 40 },
  { id: 'tt-4', code: 'EXTRACT', name: 'Siibid ilig', category: 'surgical', default_price: 15, is_active: true, sort_order: 50 },
  { id: 'tt-5', code: 'RCT', name: 'Daaweynta xididka iliga', category: 'endodontic', default_price: 120, is_active: true, sort_order: 70 },
  { id: 'tt-6', code: 'CROWN', name: 'Koron (dhar ilig)', category: 'prosthetic', default_price: 150, is_active: true, sort_order: 80 },
  { id: 'tt-7', code: 'DENTURE', name: 'Ilko rakiban', category: 'prosthetic', default_price: 250, is_active: true, sort_order: 110 },
  { id: 'tt-8', code: 'ORTHO', name: 'Qalinka ilkaha', category: 'orthodontic', default_price: 500, is_active: true, sort_order: 130 },
  { id: 'tt-9', code: 'ORTHO_ADJ', name: 'Hagaajinta qalinka', category: 'orthodontic', default_price: 10, is_active: true, sort_order: 140 },
  { id: 'tt-10', code: 'GUM', name: 'Daaweynta xanjada', category: 'periodontal', default_price: 35, is_active: true, sort_order: 170 },
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
    status: 'active', notes: 'Class II qaybta 1-aad. Elastics laga bilaabo bisha 6-aad.',
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
  { id: 'ov-1', case_id: 'oc-1', visit_date: day(-90), dentist_id: 'u-1', adjustment: 'Silig sare waa la adkeeyay', archwire_change: '0.014 NiTi → 0.016 NiTi', elastics: null, observation: 'Isku-toosinta si fiican ayay u socotaa', compliance: 'Good', next_visit_date: day(-60), notes: null, created_at: at(-90, 11), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ov-2', case_id: 'oc-1', visit_date: day(-60), dentist_id: 'u-1', adjustment: 'Labada qaansho waa la adkeeyay', archwire_change: '0.016 NiTi → 0.018 SS', elastics: 'Class II, 3/16"', observation: 'Barar xanjo oo fudud, waa la siiyay talo nadaafadeed', compliance: 'Fair', next_visit_date: day(-30), notes: null, created_at: at(-60, 10), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ov-3', case_id: 'oc-1', visit_date: day(-30), dentist_id: 'u-1', adjustment: 'Elastics waa la sii wataa, bracket-ka 24 dib baa loo dhejiyay', archwire_change: null, elastics: 'Class II, 3/16"', observation: 'Overjet-ku wuxuu ku yaraaday 3mm', compliance: 'Good', next_visit_date: day(2), notes: 'Bukaanku elastics-ka wuu xidhaa sidii loo faray', created_at: at(-30, 9), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ov-4', case_id: 'oc-2', visit_date: day(-35), dentist_id: 'u-1', adjustment: 'Power chain baa la dhigay, sare 13-23', archwire_change: '0.018 SS', elastics: null, observation: 'Booskii si fiican ayuu isugu soo dhow yahay', compliance: 'Excellent', next_visit_date: day(5), notes: null, created_at: at(-35, 12), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
];

export const appointments = [
  { id: 'a-1', patient_id: 'p-12', dentist_id: 'u-2', treatment_type_id: 'tt-7', scheduled_at: at(0, 8, 30), duration_minutes: 45, status: 'completed', notes: 'Qaadista cabbirka ilkaha rakiban', queue_number: 1, queue_state: 'completed', checked_in_at: at(0, 8, 20), called_at: at(0, 8, 28), started_at: at(0, 8, 32), completed_at: at(0, 9, 10), created_at: at(-5, 10) },
  { id: 'a-2', patient_id: 'p-11', dentist_id: 'u-1', treatment_type_id: 'tt-1', scheduled_at: at(0, 9, 0), duration_minutes: 20, status: 'completed', notes: 'Booqashadii koowaad', queue_number: 2, queue_state: 'completed', checked_in_at: at(0, 8, 50), called_at: at(0, 8, 58), started_at: at(0, 9, 0), completed_at: at(0, 9, 20), created_at: at(-2, 9) },
  { id: 'a-3', patient_id: 'p-3', dentist_id: 'u-2', treatment_type_id: 'tt-5', scheduled_at: at(0, 10, 0), duration_minutes: 60, status: 'in_treatment', notes: 'Xididka iliga 26, kalfadhiga 2 ee 3', queue_number: 3, queue_state: 'in_treatment', checked_in_at: at(0, 9, 45), called_at: at(0, 9, 58), started_at: at(0, 10, 2), completed_at: null, created_at: at(-7, 11) },
  { id: 'a-4', patient_id: 'p-9', dentist_id: 'u-1', treatment_type_id: 'tt-10', scheduled_at: at(0, 11, 0), duration_minutes: 30, status: 'checked_in', notes: 'Dib u eegis daaweynta xanjada', queue_number: 4, queue_state: 'waiting', checked_in_at: at(0, 10, 40), called_at: null, started_at: null, completed_at: null, created_at: at(-3, 12) },
  { id: 'a-5', patient_id: 'p-5', dentist_id: 'u-2', treatment_type_id: 'tt-6', scheduled_at: at(0, 11, 30), duration_minutes: 45, status: 'checked_in', notes: 'Rakibidda koronka iliga 46', queue_number: 5, queue_state: 'waiting', checked_in_at: at(0, 11, 5), called_at: null, started_at: null, completed_at: null, created_at: at(-6, 9) },
  { id: 'a-6', patient_id: 'p-6', dentist_id: 'u-3', treatment_type_id: 'tt-2', scheduled_at: at(0, 13, 0), duration_minutes: 30, status: 'confirmed', notes: 'Nadiifinta lix biloodle ah', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-10, 10) },
  { id: 'a-7', patient_id: 'p-1', dentist_id: 'u-1', treatment_type_id: 'tt-9', scheduled_at: at(0, 14, 0), duration_minutes: 30, status: 'scheduled', notes: 'Hagaajinta qalinka', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-30, 9) },
  { id: 'a-8', patient_id: 'p-10', dentist_id: 'u-3', treatment_type_id: 'tt-3', scheduled_at: at(0, 15, 0), duration_minutes: 45, status: 'scheduled', notes: 'Buuxinta ilkaha 16, 17', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-2, 14) },
  { id: 'a-9', patient_id: 'p-7', dentist_id: 'u-3', treatment_type_id: 'tt-1', scheduled_at: at(0, 16, 0), duration_minutes: 20, status: 'scheduled', notes: 'Hubinta siibidda kadib', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-5, 15) },
  { id: 'a-10', patient_id: 'p-4', dentist_id: 'u-1', treatment_type_id: 'tt-9', scheduled_at: at(2, 9, 30), duration_minutes: 30, status: 'confirmed', notes: 'Hagaajinta qalinka', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-35, 12) },
  { id: 'a-11', patient_id: 'p-2', dentist_id: 'u-2', treatment_type_id: 'tt-2', scheduled_at: at(3, 11, 0), duration_minutes: 30, status: 'scheduled', notes: null, queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-1, 9) },
  { id: 'a-12', patient_id: 'p-8', dentist_id: 'u-1', treatment_type_id: 'tt-1', scheduled_at: at(-2, 10, 0), duration_minutes: 20, status: 'no_show', notes: null, queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-8, 10) },
  { id: 'a-13', patient_id: 'p-9', dentist_id: 'u-2', treatment_type_id: 'tt-4', scheduled_at: at(-3, 14, 0), duration_minutes: 30, status: 'cancelled', notes: 'Bukaanku ballanka wuu beddelay', queue_number: null, queue_state: null, checked_in_at: null, called_at: null, started_at: null, completed_at: null, created_at: at(-9, 11) },
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
  { id: 'tr-1', patient_id: 'p-1', tooth_number: 16, condition: 'filling', proposed_treatment: null, existing_treatment: 'Buuxin composite', surface: 'Occlusal', notes: null, examination_id: null, recorded_by: 'u-1', recorded_at: at(-118, 10), is_current: true, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-2', patient_id: 'p-1', tooth_number: 24, condition: 'caries', proposed_treatment: 'Buuxin composite', existing_treatment: null, surface: 'Mesial', notes: 'Nabar yar, la socoshada', examination_id: null, recorded_by: 'u-1', recorded_at: at(-30, 9), is_current: true, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-3', patient_id: 'p-1', tooth_number: 36, condition: 'root_canal', proposed_treatment: null, existing_treatment: 'Xididka la dhammeeyay 2024', surface: null, notes: null, examination_id: null, recorded_by: 'u-2', recorded_at: at(-118, 11), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'tr-4', patient_id: 'p-1', tooth_number: 48, condition: 'extracted', proposed_treatment: null, existing_treatment: 'Waa la siibay', surface: null, notes: null, examination_id: null, recorded_by: 'u-3', recorded_at: at(-118, 11, 10), is_current: true, recorded_by_profile: { id: 'u-3', full_name: 'Dr. Hodan Ali' } },
  { id: 'tr-5', patient_id: 'p-1', tooth_number: 46, condition: 'crown', proposed_treatment: null, existing_treatment: 'Koron zirconia ah', surface: null, notes: null, examination_id: null, recorded_by: 'u-2', recorded_at: at(-60, 10), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'tr-6', patient_id: 'p-1', tooth_number: 11, condition: 'sensitive', proposed_treatment: 'Varnish yaraynta dareenka', existing_treatment: null, surface: null, notes: 'Waxaa la sheegay dareen qabow', examination_id: null, recorded_by: 'u-1', recorded_at: at(-30, 9, 5), is_current: true, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-7', patient_id: 'p-1', tooth_number: 24, condition: 'healthy', proposed_treatment: null, existing_treatment: null, surface: null, notes: 'Diiwaangelintii hore', examination_id: null, recorded_by: 'u-1', recorded_at: at(-118, 10, 20), is_current: false, recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'tr-8', patient_id: 'p-3', tooth_number: 26, condition: 'root_canal', proposed_treatment: 'Koron xididka kadib', existing_treatment: 'Xididka waa socda', surface: null, notes: 'Kalfadhiga 2 ee 3', examination_id: null, recorded_by: 'u-2', recorded_at: at(-28, 9), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'tr-9', patient_id: 'p-3', tooth_number: 37, condition: 'filling', proposed_treatment: null, existing_treatment: 'Composite', surface: 'Occlusal', notes: null, examination_id: null, recorded_by: 'u-2', recorded_at: at(-40, 10), is_current: true, recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const examinations = [
  { id: 'ex-1', patient_id: 'p-1', dentist_id: 'u-1', exam_date: day(-120), chief_complaint: 'Ilkaha hore ee sare way isku cidhiidhi yihiin, muuqaalka kama qanacsana', medical_history: 'Xasaasiyad Penicillin', dental_history: 'Buuxin 16 sanadkii 2023, xidid 36 sanadkii 2024', findings: 'Malocclusion Class II qaybta 1, overjet 6mm, cidhiidhi dhexdhexaad ah oo sare', diagnosis: 'Class II qaybta 1 oo cidhiidhi leh', recommended_treatment: 'Qalin go’an, labada qaansho, 18 bilood', notes: 'Bukaanka waa lala taliyay nadaafadda iyo elastics-ka', created_at: at(-120, 10), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ex-2', patient_id: 'p-1', dentist_id: 'u-1', exam_date: day(-30), chief_complaint: 'Dib u eegis caadi ah oo qalinka', medical_history: null, dental_history: null, findings: 'Overjet 3mm ayuu ku yaraaday, barar xanjo fudud oo hore', diagnosis: 'Daaweyntu waxay u socotaa sidii la qorsheeyay', recommended_treatment: 'Sii wad elastics-ka, cadaadinta wanaaji', notes: null, created_at: at(-30, 9), dentist: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'ex-3', patient_id: 'p-3', dentist_id: 'u-2', exam_date: day(-28), chief_complaint: 'Xanuun daran oo bidix sare, habeenkii ka sii daran', medical_history: 'Dhiig-kar, wuxuu qaataa Amlodipine', dental_history: 'Buuxin 37', findings: 'Qudhun qoto dheer 26 oo gaadhay xididka, waa xanuunsan yahay marka la garaaco', diagnosis: 'Pulpitis aan laga soo noqon karin, iliga 26', recommended_treatment: 'Daaweynta xididka kadibna koron', notes: 'Xididka isla maalintii baa la bilaabay', created_at: at(-28, 9), dentist: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const medicalHistory = [
  { id: 'mh-1', patient_id: 'p-1', condition: 'Xasaasiyad Penicillin', notes: 'Waxaa la xaqiijiyay 2023, finan iyo neefta cidhiidhi', recorded_by: 'u-1', recorded_at: at(-120, 10), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'mh-2', patient_id: 'p-1', condition: 'Ilko-jiidasho habeenkii (bruxism)', notes: 'Waxaa la soo jeediyay hayaha habeenkii', recorded_by: 'u-1', recorded_at: at(-60, 10), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'mh-3', patient_id: 'p-3', condition: 'Dhiig-kar', notes: 'Wuxuu qaataa Amlodipine 5mg maalintii', recorded_by: 'u-2', recorded_at: at(-28, 9), recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
  { id: 'mh-4', patient_id: 'p-5', condition: 'Sonkorow nooca 2-aad', notes: 'Metformin; ka feejignow bogsashada qalliinka kadib', recorded_by: 'u-2', recorded_at: at(-118, 11), recorded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const treatmentPlans = [
  { id: 'pl-1', patient_id: 'p-1', dentist_id: 'u-1', title: 'Qorshaha qalinka — 18 bilood', status: 'in_progress', notes: 'Labada qaansho, elastics bisha 6-aad, hayaha kadib.', created_by: 'u-1', created_at: at(-120, 11), updated_at: at(-30, 9) },
  { id: 'pl-2', patient_id: 'p-3', dentist_id: 'u-2', title: 'Xididka 26 kadibna koron', status: 'in_progress', notes: 'Kalfadhi 2 ee 3 waa la dhammeeyay.', created_by: 'u-2', created_at: at(-28, 9), updated_at: at(-7, 11) },
  { id: 'pl-3', patient_id: 'p-5', dentist_id: 'u-2', title: 'Dayactirka qaanshaha hoose', status: 'planned', notes: null, created_by: 'u-2', created_at: at(-20, 10), updated_at: at(-20, 10) },
];

export const medicineCategories = [
  { id: 'mc-1', name: 'Antibiyootig' }, { id: 'mc-2', name: 'Xanuun-joojiye' },
  { id: 'mc-3', name: 'Suuxin' }, { id: 'mc-4', name: 'Barar-joojiye' },
  { id: 'mc-5', name: 'Antiseptig / af-dhaqe' }, { id: 'mc-6', name: 'Fluoride / ka-hortag' },
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
  { id: 'm-6', name: 'Af-dhaqe Chlorhexidine', generic: 'Chlorhexidine gluconate 0.2%', cat: 'mc-5', form: 'syrup', strength: '300ml', purchase: 2.4, selling: 4.5, min: 20, batches: [{ qty: 12, expiry: day(160) }] },
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
    prescribed_at: at(0, 10, 20), status: 'pending', notes: 'Maanta bilow, cunto kadib',
    patient: { id: 'p-3', full_name: 'Hamza Sheikh Nur', patient_code: 'DNT-000003', allergies: 'Latex' },
    dentist: { id: 'u-2', full_name: 'Dr. Omar Jama' },
    items: [
      { id: 'ri-1', prescription_id: 'rx-1', medicine_id: 'm-1', medicine_name: 'Amoxicillin', strength: '500mg', dose: '1 kabsuul', frequency: '3 jeer maalintii', duration: '5 maalmood', quantity: 15, dispensed_quantity: 0, instructions: 'Cunto kadib' },
      { id: 'ri-2', prescription_id: 'rx-1', medicine_id: 'm-4', medicine_name: 'Ibuprofen', strength: '400mg', dose: '1 kiniin', frequency: '8 saac kasta marka loo baahdo', duration: '3 maalmood', quantity: 9, dispensed_quantity: 0, instructions: 'Ha ka badin 3 maalintii' },
    ],
  },
  {
    id: 'rx-2', prescription_number: 'RX-000002', patient_id: 'p-12', dentist_id: 'u-2',
    prescribed_at: at(0, 9, 15), status: 'partially_dispensed', notes: null,
    patient: { id: 'p-12', full_name: 'Cabdi Nuur Jibril', patient_code: 'DNT-000012', allergies: 'Ibuprofen' },
    dentist: { id: 'u-2', full_name: 'Dr. Omar Jama' },
    items: [
      { id: 'ri-3', prescription_id: 'rx-2', medicine_id: 'm-3', medicine_name: 'Paracetamol', strength: '500mg', dose: '2 kiniin', frequency: '6 saac kasta', duration: '4 maalmood', quantity: 32, dispensed_quantity: 16, instructions: null },
      { id: 'ri-4', prescription_id: 'rx-2', medicine_id: 'm-6', medicine_name: 'Af-dhaqe Chlorhexidine', strength: '300ml', dose: '10ml af-dhaqid', frequency: 'Laba jeer maalintii', duration: '7 maalmood', quantity: 1, dispensed_quantity: 1, instructions: 'Ha liqin' },
    ],
  },
  {
    id: 'rx-3', prescription_number: 'RX-000003', patient_id: 'p-7', dentist_id: 'u-3',
    prescribed_at: at(-5, 15, 10), status: 'dispensed', notes: null,
    patient: { id: 'p-7', full_name: 'Ismail Abdi Gele', patient_code: 'DNT-000007', allergies: null },
    dentist: { id: 'u-3', full_name: 'Dr. Hodan Ali' },
    items: [
      { id: 'ri-5', prescription_id: 'rx-3', medicine_id: 'm-2', medicine_name: 'Metronidazole', strength: '400mg', dose: '1 kiniin', frequency: '3 jeer maalintii', duration: '5 maalmood', quantity: 15, dispensed_quantity: 15, instructions: 'Khamri ha cabbin' },
      { id: 'ri-6', prescription_id: 'rx-3', medicine_id: 'm-3', medicine_name: 'Paracetamol', strength: '500mg', dose: '2 kiniin', frequency: '6 saac kasta', duration: '3 maalmood', quantity: 24, dispensed_quantity: 24, instructions: null },
    ],
  },
];

export const suppliers = [
  { id: 'sup-1', name: 'Jumlada Caafimaadka Hargeysa', phone: '+252 63 4000110', address: 'Waddada Warshadaha, Hargeysa', notes: 'Alaab-qeybiyaha ugu weyn, mudo 14 maalmood', is_active: true },
  { id: 'sup-2', name: 'Berbera Pharma Imports', phone: '+252 63 4000220', address: 'Waddada Dekedda, Berbera', notes: null, is_active: true },
  { id: 'sup-3', name: 'SomDent Supplies', phone: '+252 61 4000330', address: 'Hargeysa', notes: 'Alaabta ilkaha', is_active: true },
];

export const purchases = [
  { id: 'pu-1', purchase_number: 'PUR-000001', supplier_id: 'sup-1', invoice_reference: 'INV-88120', purchase_date: day(-60), total_amount: 186.4, status: 'confirmed', confirmed_at: at(-60, 9), supplier: { id: 'sup-1', name: 'Jumlada Caafimaadka Hargeysa' } },
  { id: 'pu-2', purchase_number: 'PUR-000002', supplier_id: 'sup-2', invoice_reference: 'BPI-2211', purchase_date: day(-25), total_amount: 74.2, status: 'confirmed', confirmed_at: at(-25, 11), supplier: { id: 'sup-2', name: 'Berbera Pharma Imports' } },
  { id: 'pu-3', purchase_number: 'PUR-000003', supplier_id: 'sup-1', invoice_reference: 'INV-88431', purchase_date: day(0), total_amount: 0, status: 'draft', confirmed_at: null, supplier: { id: 'sup-1', name: 'Jumlada Caafimaadka Hargeysa' } },
];

export const sales = [
  { id: 'sa-1', sale_number: 'SAL-000001', patient_id: 'p-7', prescription_id: 'rx-3', total_amount: 8.1, payment_method: 'cash', sold_at: at(-5, 15, 30), voided_at: null, patient: { id: 'p-7', full_name: 'Ismail Abdi Gele' }, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sa-2', sale_number: 'SAL-000002', patient_id: null, prescription_id: null, total_amount: 4.5, payment_method: 'evc_plus', sold_at: at(-2, 12), voided_at: null, patient: null, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sa-3', sale_number: 'SAL-000003', patient_id: 'p-12', prescription_id: 'rx-2', total_amount: 6.9, payment_method: 'cash', sold_at: at(0, 9, 40), voided_at: null, patient: { id: 'p-12', full_name: 'Cabdi Nuur Jibril' }, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sa-4', sale_number: 'SAL-000004', patient_id: null, prescription_id: null, total_amount: 12, payment_method: 'zaad', sold_at: at(0, 11, 20), voided_at: null, patient: null, sold_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
];

export const stockMovements = [
  { id: 'sm-1', medicine_id: 'm-1', movement_type: 'purchase', quantity_before: 0, quantity_change: 420, quantity_after: 420, reason: 'Iibsi PUR-000001', created_at: at(-60, 9), medicine: { id: 'm-1', name: 'Amoxicillin' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-2', medicine_id: 'm-3', movement_type: 'purchase', quantity_before: 0, quantity_change: 620, quantity_after: 620, reason: 'Iibsi PUR-000001', created_at: at(-60, 9), medicine: { id: 'm-3', name: 'Paracetamol' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-3', medicine_id: 'm-2', movement_type: 'dispense', quantity_before: 255, quantity_change: -15, quantity_after: 240, reason: 'Daawo-qoraal RX-000003', created_at: at(-5, 15, 20), medicine: { id: 'm-2', name: 'Metronidazole' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-4', medicine_id: 'm-3', movement_type: 'dispense', quantity_before: 660, quantity_change: -24, quantity_after: 636, reason: 'Daawo-qoraal RX-000003', created_at: at(-5, 15, 22), medicine: { id: 'm-3', name: 'Paracetamol' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-5', medicine_id: 'm-5', movement_type: 'adjustment', quantity_before: 40, quantity_change: -2, quantity_after: 38, reason: 'Laba kartarij oo qaadista ku jabay', created_at: at(-12, 14), medicine: { id: 'm-5', name: 'Lidocaine' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-6', medicine_id: 'm-3', movement_type: 'dispense', quantity_before: 636, quantity_change: -16, quantity_after: 620, reason: 'Daawo-qoraal RX-000002', created_at: at(0, 9, 40), medicine: { id: 'm-3', name: 'Paracetamol' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'sm-7', medicine_id: 'm-7', movement_type: 'sale', quantity_before: 12, quantity_change: -12, quantity_after: 0, reason: 'Iib SAL-000004', created_at: at(0, 11, 20), medicine: { id: 'm-7', name: 'Fluoride varnish' }, performed_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
];

export const expenses = [
  { id: 'e-1', category: 'rent', description: 'Kirada rugta — bishan', amount: 800, expense_date: day(-8), payment_method: 'bank', receipt_url: null, notes: null, created_at: at(-8, 9), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'e-2', category: 'salaries', description: 'Mushaharka shaqaalaha', amount: 1450, expense_date: day(-8), payment_method: 'bank', receipt_url: null, notes: null, created_at: at(-8, 9, 30), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'e-3', category: 'dental_supplies', description: 'Composite resin, burs iyo alaabta cabbirka', amount: 320, expense_date: day(-14), payment_method: 'cash', receipt_url: null, notes: 'SomDent Supplies', created_at: at(-14, 11), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-4', category: 'pharmacy_purchases', description: 'Iibsi PUR-000002', amount: 74.2, expense_date: day(-25), payment_method: 'bank', receipt_url: null, notes: null, created_at: at(-25, 11), recorded_by_profile: { id: 'u-5', full_name: 'Nasra Ibrahim' } },
  { id: 'e-5', category: 'electricity', description: 'Biilka korontada', amount: 145, expense_date: day(-6), payment_method: 'evc_plus', receipt_url: null, notes: null, created_at: at(-6, 10), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-6', category: 'water', description: 'Biyaha', amount: 40, expense_date: day(-6), payment_method: 'cash', receipt_url: null, notes: null, created_at: at(-6, 10, 10), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-7', category: 'maintenance', description: 'Dayactirka kursiga ilkaha 2', amount: 180, expense_date: day(-3), payment_method: 'cash', receipt_url: null, notes: 'Kombaresarka waa la dayactiray', created_at: at(-3, 15), recorded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'e-8', category: 'internet', description: 'Internetka bisha', amount: 35, expense_date: day(0), payment_method: 'zaad', receipt_url: null, notes: null, created_at: at(0, 8, 30), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'e-9', category: 'cleaning', description: 'Alaabta nadaafadda iyo jeermis-dilka', amount: 62, expense_date: day(-1), payment_method: 'cash', receipt_url: null, notes: null, created_at: at(-1, 16), recorded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
];

export const documents = [
  { id: 'd-1', patient_id: 'p-1', title: 'Raajo guud — daaweynta ka hor', doc_type: 'xray', storage_path: 'p-1/opg-pre.jpg', mime_type: 'image/jpeg', size_bytes: 1_840_221, uploaded_at: at(-120, 10, 40), uploaded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'd-2', patient_id: 'p-1', title: 'Foomka oggolaanshaha qalinka (la saxiixay)', doc_type: 'consent', storage_path: 'p-1/consent.pdf', mime_type: 'application/pdf', size_bytes: 214_882, uploaded_at: at(-120, 11), uploaded_by_profile: { id: 'u-4', full_name: 'Faisal Ahmed' } },
  { id: 'd-3', patient_id: 'p-1', title: 'Sawirro afka gudihiisa — bisha 3-aad', doc_type: 'photo', storage_path: 'p-1/photos-m3.jpg', mime_type: 'image/jpeg', size_bytes: 962_004, uploaded_at: at(-30, 9, 30), uploaded_by_profile: { id: 'u-1', full_name: 'Dr. Amina Warsame' } },
  { id: 'd-4', patient_id: 'p-3', title: 'Raajo periapical — iliga 26', doc_type: 'xray', storage_path: 'p-3/pa-26.jpg', mime_type: 'image/jpeg', size_bytes: 421_770, uploaded_at: at(-28, 9, 20), uploaded_by_profile: { id: 'u-2', full_name: 'Dr. Omar Jama' } },
];

export const auditLogs = [
  { id: 'al-1', user_id: 'u-4', action: 'payment.record', entity: 'payments', entity_id: 'pay-16', details: { amount: 20, method: 'edahab', receipt_number: 'RCP-000016', balance_before: 35 }, created_at: at(0, 11, 5), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-2', user_id: 'u-4', action: 'payment.record', entity: 'payments', entity_id: 'pay-15', details: { amount: 75, method: 'cash', receipt_number: 'RCP-000015', balance_before: 225 }, created_at: at(0, 10, 15), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-3', user_id: 'u-2', action: 'prescriptions.insert', entity: 'prescriptions', entity_id: 'rx-1', details: { status: 'pending' }, created_at: at(0, 10, 20), user: { id: 'u-2', full_name: 'Dr. Omar Jama', role: 'dentist' } },
  { id: 'al-4', user_id: 'u-5', action: 'pharmacy.sale', entity: 'pharmacy_sales', entity_id: 'sa-4', details: { total: 12 }, created_at: at(0, 11, 20), user: { id: 'u-5', full_name: 'Nasra Ibrahim', role: 'pharmacist' } },
  { id: 'al-5', user_id: 'u-4', action: 'appointment.check_in', entity: 'appointments', entity_id: 'a-5', details: { queue_number: 5 }, created_at: at(0, 11, 5), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-6', user_id: 'u-1', action: 'tooth.record', entity: 'tooth_records', entity_id: 'tr-2', details: { tooth: 24, condition: 'caries' }, created_at: at(-30, 9), user: { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin' } },
  { id: 'al-7', user_id: 'u-4', action: 'patients.insert', entity: 'patients', entity_id: 'p-12', details: { full_name: 'Cabdi Nuur Jibril', patient_code: 'DNT-000012' }, created_at: at(0, 8, 40), user: { id: 'u-4', full_name: 'Faisal Ahmed', role: 'receptionist' } },
  { id: 'al-8', user_id: 'u-1', action: 'payment.void', entity: 'payments', entity_id: 'pay-old', details: { reason: 'Laba jeer ayaa khalad lagu geliyay', amount: 25 }, created_at: at(-4, 14), user: { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin' } },
  { id: 'al-9', user_id: 'u-5', action: 'pharmacy.purchase_confirm', entity: 'pharmacy_purchases', entity_id: 'pu-2', details: { total: 74.2 }, created_at: at(-25, 11), user: { id: 'u-5', full_name: 'Nasra Ibrahim', role: 'pharmacist' } },
  { id: 'al-10', user_id: 'u-1', action: 'user_permissions.insert', entity: 'user_permissions', entity_id: 'up-1', details: { permission: 'finance.write', granted: true }, created_at: at(-20, 9), user: { id: 'u-1', full_name: 'Dr. Amina Warsame', role: 'admin' } },
];

export const clinicSettings = {
  id: true,
  clinic_name: 'Rugta Ilkaha Hargeysa',
  logo_url: null,
  phone: '+252 63 4455000',
  address: 'Waddo 1-aad, Hargeysa, Somaliland',
  email: 'info@hargeisadental.so',
  currency: 'USD',
  currency_symbol: '$',
  receipt_footer: 'Waad ku mahadsan tahay booqashada Rugta Ilkaha Hargeysa. Mahadsanid!',
  low_stock_threshold: 10,
  expiry_warning_days: EXPIRY_WARNING_DAYS,
};

export const userPermissions = [
  { id: 'up-1', user_id: 'u-2', permission: 'finance.write', granted: true },
];
