/* DentalFlow Pro — English / Somali labels */

const I18N = {
  en: {
    // nav groups
    'nav.main': 'Main', 'nav.clinical': 'Clinical', 'nav.finance': 'Finance', 'nav.manage': 'Management',
    dashboard: 'Dashboard', patients: 'Patients', dentists: 'Dentists', appointments: 'Appointments',
    chairs: 'Dental Chairs', treatments: 'Treatments', odontogram: 'Odontogram', xray: 'X-Ray Center',
    prescriptions: 'Prescriptions', labs: 'Lab Requests', invoices: 'Invoices', payments: 'Payments',
    inventory: 'Inventory', staff: 'Staff', reports: 'Reports', settings: 'Settings',

    greeting: 'Good Morning', 'dash.sub': "Here's what's happening in your clinic today.",
    'stat.appts': 'Appointments Today', 'stat.patients': 'Patients Today',
    'stat.revenue': 'Revenue Today', 'stat.pending': 'Pending Treatments',
    'card.revenue': 'Monthly Revenue', 'card.mix': 'Treatments Overview',
    'card.upcoming': 'Upcoming Appointments', 'card.chairs': 'Chair Status',
    'card.week': 'Weekly Patient Load', 'card.activity': 'Recent Activity',
    'card.services': 'Top Services', 'card.stock': 'Low Stock Alerts',

    search: 'Search patients, appointments, treatments…', viewAll: 'View All',
    newPatient: 'New Patient', newAppt: 'New Appointment', export: 'Export', print: 'Print',
    filter: 'Filter', all: 'All', today: 'Today', week: 'This Week', month: 'This Month',
    save: 'Save', cancel: 'Cancel', vsYesterday: 'vs yesterday', noResults: 'No records found'
  },
  so: {
    'nav.main': 'Guud', 'nav.clinical': 'Caafimaad', 'nav.finance': 'Maaliyad', 'nav.manage': 'Maamul',
    dashboard: 'Shaxda Guud', patients: 'Bukaanka', dentists: 'Dhakhaatiirta', appointments: 'Ballamaha',
    chairs: 'Kuraasta Ilkaha', treatments: 'Daaweynta', odontogram: 'Shaxda Ilkaha', xray: 'Xarunta Raajada',
    prescriptions: 'Daawooyinka', labs: 'Codsiyada Shaybaarka', invoices: 'Qaansheegyada', payments: 'Lacag-bixinta',
    inventory: 'Alaabta', staff: 'Shaqaalaha', reports: 'Warbixinno', settings: 'Dejinta',

    greeting: 'Subax Wanaagsan', 'dash.sub': 'Waa waxa maanta ka socda rugtaada caafimaadka.',
    'stat.appts': 'Ballamaha Maanta', 'stat.patients': 'Bukaanka Maanta',
    'stat.revenue': 'Dakhliga Maanta', 'stat.pending': 'Daaweyn Sugaysa',
    'card.revenue': 'Dakhliga Bishii', 'card.mix': 'Guudmarka Daaweynta',
    'card.upcoming': 'Ballamaha Soo Socda', 'card.chairs': 'Xaaladda Kuraasta',
    'card.week': 'Bukaanka Toddobaadka', 'card.activity': 'Dhaqdhaqaaqii Dambe',
    'card.services': 'Adeegyada Ugu Badan', 'card.stock': 'Digniin Alaab Yaraatay',

    search: 'Raadi bukaan, ballan, daaweyn…', viewAll: 'Dhammaan',
    newPatient: 'Bukaan Cusub', newAppt: 'Ballan Cusub', export: 'Soo Saar', print: 'Daabac',
    filter: 'Kala Sooc', all: 'Dhammaan', today: 'Maanta', week: 'Toddobaadkan', month: 'Bishan',
    save: 'Kaydi', cancel: 'Jooji', vsYesterday: 'shalay marka la barbardhigo', noResults: 'Wax diiwaan ah lama helin'
  }
};

let LANG = localStorage.getItem('df_lang') || 'en';
const t = k => (I18N[LANG] && I18N[LANG][k]) || I18N.en[k] || k;
