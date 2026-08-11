/* DentalFlow Pro — demo dataset
   Dhammaan xogtu waa muunad (mock) si UI-ga loo tuso. */

const DF_DATA = (() => {
  const dentists = [
    { id: 'D-01', name: 'Dr. Ayesha Khan', role: 'Clinic Admin', spec: 'Orthodontics', color: '#2563eb', initials: 'AK', phone: '+252 63 4455001', rating: 4.9, patients: 412, room: 'Chair 1' },
    { id: 'D-02', name: 'Dr. Omar Jama', role: 'Senior Dentist', spec: 'Endodontics', color: '#0ea5e9', initials: 'OJ', phone: '+252 63 4455002', rating: 4.8, patients: 356, room: 'Chair 2' },
    { id: 'D-03', name: 'Dr. Hodan Ali', role: 'Dentist', spec: 'Pedodontics', color: '#8b5cf6', initials: 'HA', phone: '+252 63 4455003', rating: 4.7, patients: 289, room: 'Chair 3' },
    { id: 'D-04', name: 'Dr. Yusuf Warsame', role: 'Dentist', spec: 'Oral Surgery', color: '#10b981', initials: 'YW', phone: '+252 63 4455004', rating: 4.6, patients: 231, room: 'Chair 4' },
    { id: 'D-05', name: 'Dr. Leyla Farah', role: 'Hygienist', spec: 'Periodontics', color: '#f59e0b', initials: 'LF', phone: '+252 63 4455005', rating: 4.8, patients: 174, room: 'Chair 5' }
  ];

  const patients = [
    { id: 'P-1001', name: 'Sara Fatima', gender: 'Female', age: 28, phone: '+252 61 2233445', email: 'sara.f@mail.com', city: 'Hargeisa', blood: 'O+', allergy: 'Penicillin', insurance: 'MedPlus', status: 'Active', balance: 0, lastVisit: '2026-08-04', joined: '2024-02-11', avatar: 'SF', color: '#ec4899' },
    { id: 'P-1002', name: 'Ali Raza', gender: 'Male', age: 41, phone: '+252 61 9988776', email: 'ali.raza@mail.com', city: 'Gabiley', blood: 'A-', allergy: 'None', insurance: 'Takaful', status: 'Active', balance: 120, lastVisit: '2026-08-06', joined: '2023-11-02', avatar: 'AR', color: '#3b82f6' },
    { id: 'P-1003', name: 'Hamza Sheikh', gender: 'Male', age: 35, phone: '+252 63 1122334', email: 'hamza.s@mail.com', city: 'Berbera', blood: 'B+', allergy: 'Latex', insurance: 'None', status: 'Active', balance: 340, lastVisit: '2026-08-09', joined: '2025-01-19', avatar: 'HS', color: '#14b8a6' },
    { id: 'P-1004', name: 'Zara Malik', gender: 'Female', age: 23, phone: '+252 61 4455663', email: 'zara.m@mail.com', city: 'Hargeisa', blood: 'AB+', allergy: 'None', insurance: 'MedPlus', status: 'Active', balance: 0, lastVisit: '2026-08-10', joined: '2025-06-30', avatar: 'ZM', color: '#8b5cf6' },
    { id: 'P-1005', name: 'Ahmed Nour', gender: 'Male', age: 52, phone: '+252 63 7788990', email: 'a.nour@mail.com', city: 'Borama', blood: 'O-', allergy: 'Ibuprofen', insurance: 'Takaful', status: 'Follow-up', balance: 75, lastVisit: '2026-07-28', joined: '2022-09-14', avatar: 'AN', color: '#f97316' },
    { id: 'P-1006', name: 'Khadra Hersi', gender: 'Female', age: 31, phone: '+252 61 3344556', email: 'khadra.h@mail.com', city: 'Hargeisa', blood: 'A+', allergy: 'None', insurance: 'MedPlus', status: 'Active', balance: 0, lastVisit: '2026-08-02', joined: '2024-07-21', avatar: 'KH', color: '#06b6d4' },
    { id: 'P-1007', name: 'Ismail Abdi', gender: 'Male', age: 19, phone: '+252 63 5566778', email: 'ismail.a@mail.com', city: 'Gabiley', blood: 'B-', allergy: 'None', insurance: 'None', status: 'New', balance: 210, lastVisit: '2026-08-11', joined: '2026-08-11', avatar: 'IA', color: '#22c55e' },
    { id: 'P-1008', name: 'Muna Yusuf', gender: 'Female', age: 44, phone: '+252 61 8899007', email: 'muna.y@mail.com', city: 'Burco', blood: 'O+', allergy: 'Aspirin', insurance: 'Takaful', status: 'Inactive', balance: 0, lastVisit: '2026-05-17', joined: '2021-03-05', avatar: 'MY', color: '#a855f7' },
    { id: 'P-1009', name: 'Bashir Duale', gender: 'Male', age: 60, phone: '+252 63 2211009', email: 'b.duale@mail.com', city: 'Hargeisa', blood: 'A+', allergy: 'None', insurance: 'MedPlus', status: 'Active', balance: 560, lastVisit: '2026-08-08', joined: '2020-12-01', avatar: 'BD', color: '#0ea5e9' },
    { id: 'P-1010', name: 'Amina Salah', gender: 'Female', age: 26, phone: '+252 61 6677889', email: 'amina.s@mail.com', city: 'Berbera', blood: 'AB-', allergy: 'Codeine', insurance: 'None', status: 'Active', balance: 0, lastVisit: '2026-08-07', joined: '2025-10-12', avatar: 'AS', color: '#ef4444' }
  ];

  const appointments = [
    { id: 'A-5001', time: '09:30 AM', date: '2026-08-11', patient: 'P-1001', dentist: 'D-01', type: 'Teeth Cleaning', chair: 'Chair 1', status: 'Confirmed', duration: 30, note: 'Routine scaling + polish' },
    { id: 'A-5002', time: '11:00 AM', date: '2026-08-11', patient: 'P-1002', dentist: 'D-02', type: 'Root Canal', chair: 'Chair 2', status: 'In Progress', duration: 90, note: 'Tooth 26, session 2 of 3' },
    { id: 'A-5003', time: '01:00 PM', date: '2026-08-11', patient: 'P-1003', dentist: 'D-04', type: 'Dental Filling', chair: 'Chair 4', status: 'Confirmed', duration: 45, note: 'Composite filling tooth 36' },
    { id: 'A-5004', time: '03:30 PM', date: '2026-08-11', patient: 'P-1004', dentist: 'D-01', type: 'Teeth Whitening', chair: 'Chair 1', status: 'Upcoming', duration: 60, note: 'In-office bleaching' },
    { id: 'A-5005', time: '04:15 PM', date: '2026-08-11', patient: 'P-1007', dentist: 'D-03', type: 'Consultation', chair: 'Chair 3', status: 'Upcoming', duration: 20, note: 'First visit assessment' },
    { id: 'A-5006', time: '05:00 PM', date: '2026-08-11', patient: 'P-1009', dentist: 'D-02', type: 'Crown Fitting', chair: 'Chair 2', status: 'Upcoming', duration: 50, note: 'Zirconia crown, tooth 46' },
    { id: 'A-5007', time: '10:00 AM', date: '2026-08-12', patient: 'P-1006', dentist: 'D-05', type: 'Scaling', chair: 'Chair 5', status: 'Confirmed', duration: 40, note: 'Deep cleaning' },
    { id: 'A-5008', time: '12:15 PM', date: '2026-08-12', patient: 'P-1010', dentist: 'D-03', type: 'Extraction', chair: 'Chair 3', status: 'Confirmed', duration: 35, note: 'Wisdom tooth 48' },
    { id: 'A-5009', time: '02:00 PM', date: '2026-08-12', patient: 'P-1005', dentist: 'D-04', type: 'Implant Review', chair: 'Chair 4', status: 'Upcoming', duration: 30, note: 'Post-op check' },
    { id: 'A-5010', time: '09:00 AM', date: '2026-08-10', patient: 'P-1008', dentist: 'D-01', type: 'Braces Adjustment', chair: 'Chair 1', status: 'Completed', duration: 30, note: 'Wire change' },
    { id: 'A-5011', time: '03:00 PM', date: '2026-08-10', patient: 'P-1003', dentist: 'D-02', type: 'X-Ray', chair: 'Chair 2', status: 'Cancelled', duration: 15, note: 'Patient rescheduled' }
  ];

  const chairs = [
    { id: 'Chair 1', status: 'In Use', dentist: 'D-01', patient: 'P-1001', since: '09:30 AM', next: '11:00 AM' },
    { id: 'Chair 2', status: 'In Use', dentist: 'D-02', patient: 'P-1002', since: '11:00 AM', next: '01:00 PM' },
    { id: 'Chair 3', status: 'Available', dentist: 'D-03', patient: null, since: null, next: '04:15 PM' },
    { id: 'Chair 4', status: 'Available', dentist: 'D-04', patient: null, since: null, next: '01:00 PM' },
    { id: 'Chair 5', status: 'Maintenance', dentist: 'D-05', patient: null, since: '08:00 AM', next: 'Tomorrow' },
    { id: 'Chair 6', status: 'Available', dentist: null, patient: null, since: null, next: '—' }
  ];

  const treatments = [
    { id: 'T-9001', patient: 'P-1002', tooth: '26', name: 'Root Canal Therapy', dentist: 'D-02', started: '2026-07-20', sessions: '2/3', progress: 66, cost: 320, status: 'Ongoing' },
    { id: 'T-9002', patient: 'P-1009', tooth: '46', name: 'Zirconia Crown', dentist: 'D-02', started: '2026-08-01', sessions: '1/2', progress: 45, cost: 480, status: 'Ongoing' },
    { id: 'T-9003', patient: 'P-1001', tooth: '—', name: 'Scaling & Polishing', dentist: 'D-01', started: '2026-08-04', sessions: '1/1', progress: 100, cost: 60, status: 'Completed' },
    { id: 'T-9004', patient: 'P-1003', tooth: '36', name: 'Composite Filling', dentist: 'D-04', started: '2026-08-09', sessions: '1/1', progress: 100, cost: 95, status: 'Completed' },
    { id: 'T-9005', patient: 'P-1005', tooth: '15', name: 'Dental Implant', dentist: 'D-04', started: '2026-06-11', sessions: '3/4', progress: 78, cost: 1250, status: 'Ongoing' },
    { id: 'T-9006', patient: 'P-1008', tooth: 'Full', name: 'Orthodontic Braces', dentist: 'D-01', started: '2025-11-03', sessions: '9/18', progress: 50, cost: 2200, status: 'Ongoing' },
    { id: 'T-9007', patient: 'P-1004', tooth: '—', name: 'Teeth Whitening', dentist: 'D-01', started: '2026-08-11', sessions: '0/1', progress: 0, cost: 180, status: 'Upcoming' },
    { id: 'T-9008', patient: 'P-1010', tooth: '48', name: 'Wisdom Extraction', dentist: 'D-03', started: '2026-08-12', sessions: '0/1', progress: 0, cost: 210, status: 'Upcoming' },
    { id: 'T-9009', patient: 'P-1007', tooth: '11', name: 'Veneer', dentist: 'D-03', started: '2026-08-11', sessions: '0/2', progress: 0, cost: 390, status: 'Upcoming' },
    { id: 'T-9010', patient: 'P-1006', tooth: '—', name: 'Gum Treatment', dentist: 'D-05', started: '2026-08-02', sessions: '2/2', progress: 100, cost: 140, status: 'Completed' }
  ];

  // Odontogram: FDI numbering
  const toothStates = {
    '16': 'filled', '26': 'root-canal', '36': 'filled', '46': 'crown',
    '11': 'planned', '48': 'extract', '15': 'implant', '24': 'caries',
    '37': 'caries', '18': 'missing'
  };

  const xrays = [
    { id: 'X-301', patient: 'P-1002', type: 'Periapical', tooth: '26', date: '2026-07-20', dentist: 'D-02', note: 'Pre-treatment' },
    { id: 'X-302', patient: 'P-1002', type: 'Periapical', tooth: '26', date: '2026-08-06', dentist: 'D-02', note: 'Mid-treatment' },
    { id: 'X-303', patient: 'P-1005', type: 'Panoramic', tooth: 'Full', date: '2026-06-11', dentist: 'D-04', note: 'Implant planning' },
    { id: 'X-304', patient: 'P-1009', type: 'Bitewing', tooth: '46', date: '2026-08-01', dentist: 'D-02', note: 'Crown prep' },
    { id: 'X-305', patient: 'P-1010', type: 'Panoramic', tooth: 'Full', date: '2026-08-07', dentist: 'D-03', note: 'Wisdom tooth' },
    { id: 'X-306', patient: 'P-1003', type: 'Bitewing', tooth: '36', date: '2026-08-09', dentist: 'D-04', note: 'Caries check' }
  ];

  const prescriptions = [
    { id: 'RX-701', patient: 'P-1002', dentist: 'D-02', date: '2026-08-06', items: 'Amoxicillin 500mg · Ibuprofen 400mg', duration: '5 days', status: 'Active' },
    { id: 'RX-702', patient: 'P-1010', dentist: 'D-03', date: '2026-08-07', items: 'Paracetamol 1g · Chlorhexidine rinse', duration: '3 days', status: 'Active' },
    { id: 'RX-703', patient: 'P-1005', dentist: 'D-04', date: '2026-07-28', items: 'Metronidazole 400mg', duration: '7 days', status: 'Completed' },
    { id: 'RX-704', patient: 'P-1009', dentist: 'D-02', date: '2026-08-08', items: 'Ibuprofen 600mg', duration: '4 days', status: 'Active' },
    { id: 'RX-705', patient: 'P-1001', dentist: 'D-01', date: '2026-08-04', items: 'Fluoride gel', duration: '14 days', status: 'Completed' }
  ];

  const labs = [
    { id: 'LR-401', patient: 'P-1009', lab: 'Hargeisa Dental Lab', item: 'Zirconia Crown (46)', sent: '2026-08-02', due: '2026-08-13', status: 'In Progress', cost: 180 },
    { id: 'LR-402', patient: 'P-1008', lab: 'SmileWorks Lab', item: 'Retainer (Upper)', sent: '2026-07-29', due: '2026-08-09', status: 'Delivered', cost: 90 },
    { id: 'LR-403', patient: 'P-1005', lab: 'Hargeisa Dental Lab', item: 'Implant Abutment', sent: '2026-08-05', due: '2026-08-18', status: 'In Progress', cost: 260 },
    { id: 'LR-404', patient: 'P-1007', lab: 'SmileWorks Lab', item: 'Veneer Shells (11,21)', sent: '2026-08-11', due: '2026-08-22', status: 'Pending', cost: 210 },
    { id: 'LR-405', patient: 'P-1003', lab: 'ProDent Lab', item: 'Night Guard', sent: '2026-07-18', due: '2026-07-30', status: 'Delivered', cost: 120 }
  ];

  const invoices = [
    { id: 'INV-2401', patient: 'P-1002', date: '2026-08-06', due: '2026-08-20', items: 3, total: 420, paid: 300, method: 'Insurance', status: 'Partial' },
    { id: 'INV-2402', patient: 'P-1001', date: '2026-08-04', due: '2026-08-04', items: 2, total: 60, paid: 60, method: 'Cash', status: 'Paid' },
    { id: 'INV-2403', patient: 'P-1003', date: '2026-08-09', due: '2026-08-23', items: 4, total: 340, paid: 0, method: '—', status: 'Unpaid' },
    { id: 'INV-2404', patient: 'P-1009', date: '2026-08-08', due: '2026-08-22', items: 5, total: 860, paid: 300, method: 'Card', status: 'Partial' },
    { id: 'INV-2405', patient: 'P-1004', date: '2026-08-10', due: '2026-08-10', items: 1, total: 180, paid: 180, method: 'Mobile Money', status: 'Paid' },
    { id: 'INV-2406', patient: 'P-1007', date: '2026-08-11', due: '2026-08-25', items: 2, total: 210, paid: 0, method: '—', status: 'Unpaid' },
    { id: 'INV-2407', patient: 'P-1006', date: '2026-08-02', due: '2026-08-02', items: 2, total: 140, paid: 140, method: 'Cash', status: 'Paid' },
    { id: 'INV-2408', patient: 'P-1005', date: '2026-07-28', due: '2026-08-11', items: 3, total: 575, paid: 500, method: 'Insurance', status: 'Overdue' }
  ];

  const payments = [
    { id: 'PAY-8801', invoice: 'INV-2405', patient: 'P-1004', date: '2026-08-10', amount: 180, method: 'Mobile Money', ref: 'ZAAD-77341', status: 'Success' },
    { id: 'PAY-8802', invoice: 'INV-2404', patient: 'P-1009', date: '2026-08-08', amount: 300, method: 'Card', ref: 'VISA-2210', status: 'Success' },
    { id: 'PAY-8803', invoice: 'INV-2402', patient: 'P-1001', date: '2026-08-04', amount: 60, method: 'Cash', ref: 'CSH-0912', status: 'Success' },
    { id: 'PAY-8804', invoice: 'INV-2401', patient: 'P-1002', date: '2026-08-06', amount: 300, method: 'Insurance', ref: 'MEDPLUS-4417', status: 'Success' },
    { id: 'PAY-8805', invoice: 'INV-2408', patient: 'P-1005', date: '2026-07-28', amount: 500, method: 'Insurance', ref: 'TKF-8890', status: 'Success' },
    { id: 'PAY-8806', invoice: 'INV-2407', patient: 'P-1006', date: '2026-08-02', amount: 140, method: 'Cash', ref: 'CSH-0918', status: 'Success' },
    { id: 'PAY-8807', invoice: 'INV-2403', patient: 'P-1003', date: '2026-08-09', amount: 120, method: 'Card', ref: 'VISA-8123', status: 'Failed' }
  ];

  const inventory = [
    { id: 'ITM-01', name: 'Composite Resin A2', cat: 'Restorative', stock: 8, min: 15, unit: 'syringe', supplier: 'DentSupply', price: 22, expiry: '2027-03-01' },
    { id: 'ITM-02', name: 'Lidocaine 2%', cat: 'Anesthetic', stock: 46, min: 20, unit: 'cartridge', supplier: 'MediCore', price: 3, expiry: '2027-01-15' },
    { id: 'ITM-03', name: 'Latex Gloves (M)', cat: 'Disposable', stock: 12, min: 25, unit: 'box', supplier: 'SafeHands', price: 9, expiry: '2028-06-30' },
    { id: 'ITM-04', name: 'Dental Burs Set', cat: 'Instrument', stock: 30, min: 10, unit: 'set', supplier: 'DentSupply', price: 34, expiry: '—' },
    { id: 'ITM-05', name: 'X-Ray Film', cat: 'Imaging', stock: 4, min: 20, unit: 'pack', supplier: 'RadiCare', price: 41, expiry: '2026-12-01' },
    { id: 'ITM-06', name: 'Impression Material', cat: 'Prosthetic', stock: 19, min: 12, unit: 'kit', supplier: 'ProDent', price: 55, expiry: '2027-05-20' },
    { id: 'ITM-07', name: 'Fluoride Varnish', cat: 'Preventive', stock: 27, min: 15, unit: 'tube', supplier: 'MediCore', price: 17, expiry: '2027-02-10' },
    { id: 'ITM-08', name: 'Sterilization Pouch', cat: 'Disposable', stock: 6, min: 30, unit: 'box', supplier: 'SafeHands', price: 12, expiry: '2029-01-01' }
  ];

  const staff = [
    { id: 'S-01', name: 'Faisal Ahmed', role: 'Receptionist', shift: 'Morning', phone: '+252 61 1112223', status: 'On Duty', joined: '2024-01-08', initials: 'FA', color: '#3b82f6' },
    { id: 'S-02', name: 'Nasra Ibrahim', role: 'Dental Assistant', shift: 'Morning', phone: '+252 61 3334445', status: 'On Duty', joined: '2023-05-22', initials: 'NI', color: '#ec4899' },
    { id: 'S-03', name: 'Mohamed Sahal', role: 'Lab Technician', shift: 'Evening', phone: '+252 63 5556667', status: 'Off Duty', joined: '2022-10-14', initials: 'MS', color: '#14b8a6' },
    { id: 'S-04', name: 'Ubax Jibril', role: 'Accountant', shift: 'Full Day', phone: '+252 61 7778889', status: 'On Duty', joined: '2021-07-30', initials: 'UJ', color: '#8b5cf6' },
    { id: 'S-05', name: 'Kaltun Osman', role: 'Dental Assistant', shift: 'Evening', phone: '+252 63 9990001', status: 'Leave', joined: '2025-02-17', initials: 'KO', color: '#f59e0b' }
  ];

  const revenue = [
    { m: 'Jan', v: 31200, exp: 18400 }, { m: 'Feb', v: 27800, exp: 17100 },
    { m: 'Mar', v: 35400, exp: 19800 }, { m: 'Apr', v: 33100, exp: 18900 },
    { m: 'May', v: 41200, exp: 21400 }, { m: 'Jun', v: 38700, exp: 20100 },
    { m: 'Jul', v: 44900, exp: 22600 }, { m: 'Aug', v: 48750, exp: 23800 }
  ];

  const weekLoad = [
    { d: 'Mon', v: 26 }, { d: 'Tue', v: 31 }, { d: 'Wed', v: 24 },
    { d: 'Thu', v: 35 }, { d: 'Fri', v: 18 }, { d: 'Sat', v: 29 }, { d: 'Sun', v: 12 }
  ];

  const activity = [
    { icon: 'check', color: '#10b981', text: 'Sara Fatima — Teeth Cleaning completed', time: '12 min ago' },
    { icon: 'invoice', color: '#2563eb', text: 'Invoice INV-2406 generated for Ismail Abdi', time: '38 min ago' },
    { icon: 'alert', color: '#f59e0b', text: 'Low stock alert: X-Ray Film (4 packs left)', time: '1 hr ago' },
    { icon: 'user', color: '#8b5cf6', text: 'New patient registered: Ismail Abdi', time: '2 hrs ago' },
    { icon: 'xray', color: '#06b6d4', text: 'X-Ray uploaded for Ali Raza (tooth 26)', time: '3 hrs ago' },
    { icon: 'calendar', color: '#ec4899', text: 'Appointment rescheduled: Hamza Sheikh', time: '5 hrs ago' }
  ];

  const treatmentMix = [
    { label: 'Completed', value: 72, color: '#10b981' },
    { label: 'Ongoing', value: 28, color: '#2563eb' },
    { label: 'Upcoming', value: 18, color: '#f59e0b' },
    { label: 'Cancelled', value: 10, color: '#ef4444' }
  ];

  const topServices = [
    { name: 'Teeth Cleaning', count: 148, revenue: 8880 },
    { name: 'Composite Filling', count: 96, revenue: 9120 },
    { name: 'Root Canal', count: 54, revenue: 17280 },
    { name: 'Crown & Bridge', count: 38, revenue: 18240 },
    { name: 'Extraction', count: 61, revenue: 12810 },
    { name: 'Whitening', count: 44, revenue: 7920 }
  ];

  return { dentists, patients, appointments, chairs, treatments, toothStates, xrays,
           prescriptions, labs, invoices, payments, inventory, staff, revenue,
           weekLoad, activity, treatmentMix, topServices };
})();
