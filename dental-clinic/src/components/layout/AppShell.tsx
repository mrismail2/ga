import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { type Permission } from '@/lib/permissions';
import { useI18n } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { getDashboardSummary, getSettings } from '@/services/admin';
import { quickSearchPatients } from '@/services/patients';
import { setCurrencySymbol } from '@/lib/format';
import { Avatar, IconButton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

interface NavItem {
  to: string;
  label: TranslationKey;
  icon: string;
  permission: Permission;
  badge?: number;
  alert?: boolean;
  end?: boolean;
}

export default function AppShell() {
  const { profile, signOut, can } = useAuth();
  const { t, label: enumLabel, lang, setLang } = useI18n();
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

  const groups = useMemo<{ label: TranslationKey; items: NavItem[] }[]>(() => [
    {
      label: 'nav.group.clinic',
      items: [
        { to: '/', label: 'nav.dashboard', icon: 'dashboard', permission: 'patients.read', end: true },
        { to: '/patients', label: 'nav.patients', icon: 'patients', permission: 'patients.read' },
        { to: '/appointments', label: 'nav.appointments', icon: 'calendar', permission: 'appointments.read',
          badge: summary.data?.appointments_today },
        { to: '/queue', label: 'nav.queue', icon: 'queue', permission: 'appointments.read',
          badge: summary.data?.waiting_now },
      ],
    },
    {
      label: 'nav.group.clinical',
      items: [
        { to: '/treatments', label: 'nav.treatments', icon: 'tooth', permission: 'clinical.read' },
        { to: '/orthodontics', label: 'nav.orthodontics', icon: 'braces', permission: 'clinical.read' },
        { to: '/prescriptions', label: 'nav.prescriptions', icon: 'rx', permission: 'clinical.read' },
      ],
    },
    {
      label: 'nav.group.finance',
      items: [
        { to: '/payments', label: 'nav.payments', icon: 'payment', permission: 'finance.read' },
        { to: '/outstanding', label: 'nav.outstanding', icon: 'balance', permission: 'finance.read',
          badge: summary.data?.outstanding_patients, alert: (summary.data?.outstanding_patients ?? 0) > 0 },
        { to: '/expenses', label: 'nav.expenses', icon: 'expense', permission: 'finance.read' },
      ],
    },
    {
      label: 'nav.group.pharmacy',
      items: [
        { to: '/pharmacy/prescriptions', label: 'nav.dispensing', icon: 'rx', permission: 'pharmacy.read' },
        { to: '/pharmacy/medicines', label: 'nav.medicines', icon: 'inventory', permission: 'pharmacy.read',
          badge: summary.data?.low_stock, alert: (summary.data?.low_stock ?? 0) > 0 },
        { to: '/pharmacy/sales', label: 'nav.sales', icon: 'payment', permission: 'pharmacy.read' },
        { to: '/pharmacy/purchases', label: 'nav.purchases', icon: 'pharmacy', permission: 'pharmacy.read' },
      ],
    },
    {
      label: 'nav.group.admin',
      items: [
        { to: '/reports', label: 'nav.reports', icon: 'reports', permission: 'reports.read' },
        { to: '/staff', label: 'nav.staff', icon: 'staff', permission: 'staff.manage' },
        { to: '/audit', label: 'nav.audit', icon: 'audit', permission: 'audit.read' },
        { to: '/settings', label: 'nav.settings', icon: 'settings', permission: 'settings.manage' },
      ],
    },
  ], [summary.data]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark"><Icon name="tooth" size={16} /></span>
          <div className="grow truncate">
            <div className="brand__name truncate">{settings.data?.clinic_name ?? t('app.name')}</div>
            <div className="brand__sub">{t('app.subtitle')}</div>
          </div>
        </div>

        <nav className="nav">
          {groups.map((group) => {
            const visible = group.items.filter((item) => can(item.permission));
            if (!visible.length) return null;
            return (
              <div key={group.label}>
                <div className="nav__group eyebrow">{t(group.label)}</div>
                {visible.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `nav__link${isActive ? ' is-active' : ''}`}
                    onClick={() => setDrawer(false)}
                  >
                    <Icon name={item.icon} />
                    <span className="truncate">{t(item.label)}</span>
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
            <NavLink to="/account" className="sidebar__me" title={t('nav.account')}>
              <Avatar name={profile?.full_name ?? '?'} size="sm" />
              <div className="grow truncate">
                <b className="truncate">{profile?.full_name}</b>
                <small>{profile ? enumLabel('role', profile.role) : ''}</small>
              </div>
            </NavLink>
            <IconButton
              label={t('nav.signOut')}
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
          <IconButton label={t('nav.menu')} className="menu-toggle" onClick={() => setDrawer((v) => !v)}>
            <Icon name="menu" />
          </IconButton>
          <GlobalSearch />
          <div className="ml-auto row row--sm">
            <div className="seg-toggle" title={t('nav.language')}>
              <button className={lang === 'so' ? 'on' : ''} onClick={() => setLang('so')}>SO</button>
              <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
            </div>
            <IconButton
              label={t('nav.toggleTheme')}
              onClick={() => setTheme((value) => (value === 'dark' ? 'light' : 'dark'))}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </IconButton>
            <Link to="/patients/new" className="btn btn--primary btn--sm">
              <Icon name="plus" /> {t('nav.newPatient')}
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
  const { t } = useI18n();
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
        placeholder={t('nav.searchPlaceholder')}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        aria-label={t('common.search')}
      />
      {open && debounced.trim().length >= 2 && (
        <div className="gsearch__results">
          {results.isPending && <div className="gsearch__empty">{t('common.searching')}</div>}
          {results.isError && <div className="gsearch__empty">{t('nav.searchFailed')}</div>}
          {results.data?.length === 0 && (
            <div className="gsearch__empty">
              {t('nav.searchNoResult')} “{debounced}”.
              <div className="mt-8">
                <Link className="btn btn--sm btn--primary" to="/patients/new" onClick={() => setOpen(false)}>
                  {t('nav.registerNew')}
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
