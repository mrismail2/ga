import { Suspense, lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { I18nProvider, useI18n } from '@/i18n';
import { ToastProvider, Skeleton, EmptyState, Button } from '@/components/ui';
import type { Permission } from '@/lib/permissions';
import AppShell from '@/components/layout/AppShell';
import Login from '@/pages/Login';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const PatientList = lazy(() => import('@/pages/patients/PatientList'));
const PatientRegister = lazy(() => import('@/pages/patients/PatientRegister'));
const PatientProfile = lazy(() => import('@/pages/patients/PatientProfile'));
const Appointments = lazy(() => import('@/pages/Appointments'));
const Queue = lazy(() => import('@/pages/Queue'));
const Treatments = lazy(() => import('@/pages/Treatments'));
const Orthodontics = lazy(() => import('@/pages/Orthodontics'));
const OrthodonticCase = lazy(() => import('@/pages/OrthodonticCase'));
const Prescriptions = lazy(() => import('@/pages/Prescriptions'));
const Payments = lazy(() => import('@/pages/finance/Payments'));
const Outstanding = lazy(() => import('@/pages/finance/Outstanding'));
const Expenses = lazy(() => import('@/pages/finance/Expenses'));
const Dispensing = lazy(() => import('@/pages/pharmacy/Dispensing'));
const Medicines = lazy(() => import('@/pages/pharmacy/Medicines'));
const Sales = lazy(() => import('@/pages/pharmacy/Sales'));
const Purchases = lazy(() => import('@/pages/pharmacy/Purchases'));
const Reports = lazy(() => import('@/pages/Reports'));
const Staff = lazy(() => import('@/pages/Staff'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));
const Settings = lazy(() => import('@/pages/Settings'));
const Account = lazy(() => import('@/pages/Account'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        // Permission and constraint failures will never succeed on retry.
        const code = (error as { code?: string })?.code;
        if (code === '42501' || code === 'PGRST301') return false;
        return count < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

function RequireAuth({ permission, children }: { permission?: Permission; children: ReactNode }) {
  const { session, profile, loading, can } = useAuth();
  const { t } = useI18n();
  const location = useLocation();

  if (loading) return <div className="page"><Skeleton rows={6} /></div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (!profile) {
    return (
      <div className="page">
        <EmptyState
          title={t('access.noProfile')}
          description={t('access.noProfileHint')}
        />
      </div>
    );
  }
  if (profile.status !== 'active') {
    return (
      <div className="page">
        <EmptyState
          title={t('access.inactive')}
          description={t('access.inactiveHint')}
        />
      </div>
    );
  }
  if (permission && !can(permission)) {
    return (
      <div className="page">
        <EmptyState
          title={t('access.denied')}
          description={t('access.deniedHint')}
          action={<Button onClick={() => window.history.back()}>{t('common.goBack')}</Button>}
        />
      </div>
    );
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <I18nProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<div className="page"><Skeleton rows={6} /></div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route index element={<Dashboard />} />

                  <Route path="patients" element={<RequireAuth permission="patients.read"><PatientList /></RequireAuth>} />
                  <Route path="patients/new" element={<RequireAuth permission="patients.write"><PatientRegister /></RequireAuth>} />
                  <Route path="patients/:id" element={<RequireAuth permission="patients.read"><PatientProfile /></RequireAuth>} />

                  <Route path="appointments" element={<RequireAuth permission="appointments.read"><Appointments /></RequireAuth>} />
                  <Route path="queue" element={<RequireAuth permission="appointments.read"><Queue /></RequireAuth>} />

                  <Route path="treatments" element={<RequireAuth permission="clinical.read"><Treatments /></RequireAuth>} />
                  <Route path="orthodontics" element={<RequireAuth permission="clinical.read"><Orthodontics /></RequireAuth>} />
                  <Route path="orthodontics/:id" element={<RequireAuth permission="clinical.read"><OrthodonticCase /></RequireAuth>} />
                  <Route path="prescriptions" element={<RequireAuth permission="clinical.read"><Prescriptions /></RequireAuth>} />

                  <Route path="payments" element={<RequireAuth permission="finance.read"><Payments /></RequireAuth>} />
                  <Route path="outstanding" element={<RequireAuth permission="finance.read"><Outstanding /></RequireAuth>} />
                  <Route path="expenses" element={<RequireAuth permission="finance.read"><Expenses /></RequireAuth>} />

                  <Route path="pharmacy/prescriptions" element={<RequireAuth permission="pharmacy.read"><Dispensing /></RequireAuth>} />
                  <Route path="pharmacy/medicines" element={<RequireAuth permission="pharmacy.read"><Medicines /></RequireAuth>} />
                  <Route path="pharmacy/sales" element={<RequireAuth permission="pharmacy.read"><Sales /></RequireAuth>} />
                  <Route path="pharmacy/purchases" element={<RequireAuth permission="pharmacy.read"><Purchases /></RequireAuth>} />

                  <Route path="reports" element={<RequireAuth permission="reports.read"><Reports /></RequireAuth>} />
                  <Route path="staff" element={<RequireAuth permission="staff.manage"><Staff /></RequireAuth>} />
                  <Route path="audit" element={<RequireAuth permission="audit.read"><AuditLog /></RequireAuth>} />
                  <Route path="settings" element={<RequireAuth permission="settings.manage"><Settings /></RequireAuth>} />
                  {/* Every signed-in user can reach their own account. */}
                  <Route path="account" element={<Account />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
