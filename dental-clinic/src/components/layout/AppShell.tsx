import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABEL, type Permission } from '@/lib/permissions';
import { getDashboardSummary, getSettings } from '@/services/admin';
import { quickSearchPatients } from '@/services/patients';
import { setCurrencySymbol } from '@/lib/format';
import { Avatar, IconButton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  permission: Permission;
  badge?: number;
  alert?: boolean;
  end?: boolean;
}

export default function AppShell() {
  const { profile, signOut, can } = useAuth();
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('dc_theme') ?? 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dc_theme', theme);
  }, [theme]);

  useEffect(() => {
    document.body.classList.toggle('drawer-open', drawer);
  }, [drawer]);

  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings, staleTime: 300_000 });
  useEffect(() => {
    if (settings.data?.currency_symbol) setCurrencySymbol(settings.data.currency_symbol);
  }, [settings.data]);

  // Badge counts come from the same summary the dashboard uses.
  const summary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: getDashboardSummary,
    refetchInterval: 60_000,
  });

  const groups = useMemo<{ label: string; items: NavItem[] }[]>(() => [
    {
      label: 'Clinic',
      items: [
        { to: '/', label: 'Dashboard', icon: 'dashboard', permission: 'patients.read', end: true },
        { to: '/patients', label: 'Patients', icon: 'patients', permission: 'patients.read' },
        { to: '/appointments', label: 'Appointments', icon: 'calendar', permission: 'appointments.read',
          badge: summary.data?.appointments_today },
        { to: '/queue', label: 'Patient queue', icon: 'queue', permission: 'appointments.read',
          badge: summary.data?.waiting_now },
      ],
    },
    {
      label: 'Clinical',
      items: [
        { to: '/treatments', label: 'Dental treatments', icon: 'tooth', permission: 'clinical.read' },
        { to: '/orthodontics', label: 'Braces / orthodontics', icon: 'braces', permission: 'clinical.read' },
        { to: '/prescriptions', label: 'Prescriptions', icon: 'rx', permission: 'clinical.read' },
      ],
    },
    {
      label: 'Finance',
      items: [
        { to: '/payments', label: 'Payments', icon: 'payment', permission: 'finance.read' },
        { to: '/outstanding', label: 'Outstanding', icon: 'balance', permission: 'finance.read',
          badge: summary.data?.outstanding_patients, alert: (summary.data?.outstanding_patients ?? 0) > 0 },
        { to: '/expenses', label: 'Expenses', icon: 'expense', permission: 'finance.read' },
      ],
    },
    {
      label: 'Pharmacy',
      items: [
        { to: '/pharmacy/prescriptions', label: 'Dispensing', icon: 'rx', permission: 'pharmacy.read' },
        { to: '/pharmacy/medicines', label: 'Medicines & stock', icon: 'inventory', permission: 'pharmacy.read',
          badge: summary.data?.low_stock, alert: (summary.data?.low_stock ?? 0) > 0 },
        { to: '/pharmacy/sales', label: 'Sales', icon: 'payment', permission: 'pharmacy.read' },
        { to: '/pharmacy/purchases', label: 'Purchases & suppliers', icon: 'pharmacy', permission: 'pharmacy.read' },
      ],
    },
    {
      label: 'Administration',
      items: [
        { to: '/reports', label: 'Reports', icon: 'reports', permission: 'reports.read' },
        { to: '/staff', label: 'Staff', icon: 'staff', permission: 'staff.manage' },
        { to: '/audit', label: 'Audit log', icon: 'audit', permission: 'audit.read' },
        { to: '/settings', label: 'Settings', icon: 'settings', permission: 'settings.manage' },
      ],
    },
  ], [summary.data]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><Icon name="tooth" size={16} /></span>
          <div className="grow truncate">
            <div className="brand__name truncate">{settings.data?.clinic_name ?? 'Dental Clinic'}</div>
            <div className="brand__sub">Management system</div>
          </div>
        </div>

        <nav className="nav">
          {groups.map((group) => {
            const visible = group.items.filter((item) => can(item.permission));
            if (!visible.length) return null;
            return (
              <div key={group.label}>
                <div className="nav__group eyebrow">{group.label}</div>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
                    onClick={() => setDrawer(false)}
                  >
                    <Icon name={item.icon} />
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <span className={`nav__badge${item.alert ? ' nav__badge--alert' : ''}`}>{item.badge}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__user">
            <Avatar name={profile?.full_name ?? '?'} size="sm" />
            <div className="grow truncate">
              <b className="truncate">{profile?.full_name}</b>
              <small>{profile ? ROLE_LABEL[profile.role] : ''}</small>
            </div>
            <IconButton
              label="Sign out"
              onClick={async () => { await signOut(); navigate('/login'); }}
            >
              <Icon name="logout" />
            </IconButton>
          </div>
        </div>
      </aside>

      {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

      <div className="main">
        <header className="topbar">
          <IconButton label="Menu" className="menu-toggle" onClick={() => setDrawer((v) => !v)}>
            <Icon name="menu" />
          </IconButton>
          <GlobalSearch />
          <div className="ml-auto row row--sm">
            <IconButton
              label="Toggle theme"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </IconButton>
            <Link to="/patients/new" className="btn btn--primary btn--sm">
              <Icon name="plus" /> New patient
            </Link>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Replaces flipping through the registration book: code, name or phone. */
function GlobalSearch() {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 180);
    return () => clearTimeout(id);
  }, [term]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const results = useQuery({
    queryKey: ['quick-search', debounced],
    queryFn: () => quickSearchPatients(debounced),
    enabled: debounced.trim().length >= 2,
  });

  return (
    <div className="gsearch" ref={boxRef}>
      <input
        value={term}
        placeholder="Search patient name, ID or phone…"
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label="Search patients"
      />
      {open && debounced.trim().length >= 2 && (
        <div className="gsearch__results">
          {results.isPending && <div className="gsearch__empty">Searching…</div>}
          {results.isError && <div className="gsearch__empty">Search failed. Try again.</div>}
          {results.data?.length === 0 && (
            <div className="gsearch__empty">
              No patient matches “{debounced}”.
              <div className="mt-8">
                <Link className="btn btn--sm btn--primary" to="/patients/new" onClick={() => setOpen(false)}>
                  Register new patient
                </Link>
              </div>
            </div>
          )}
          {results.data?.map((p) => (
            <div
              key={p.id}
              className="gsearch__item"
              onClick={() => { setOpen(false); setTerm(''); navigate(`/patients/${p.id}`); }}
            >
              <Avatar name={p.full_name} size="sm" />
              <div className="grow truncate">
                <b className="text-sm">{p.full_name}</b>
                <div className="text-2xs faint">{p.patient_code} · {p.phone}</div>
              </div>
              <Icon name="chevronRight" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
