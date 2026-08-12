import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inviteStaff, listPermissionOverrides, listStaff, setPermissionOverride, updateStaff,
} from '@/services/admin';
import { readableError } from '@/lib/supabase';
import { dateOnly } from '@/lib/format';
import type { Profile, UserRole } from '@/types/database';
import {
  Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal,
  QueryBoundary, Select, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

const ROLES: UserRole[] = ['admin', 'dentist', 'receptionist', 'pharmacist'];

/** Extra capabilities an admin can grant on top of a role. */
const GRANTABLE = [
  { id: 'finance.write', key: 'staff.permFinanceWrite', hint: 'staff.permFinanceWriteHint' },
  { id: 'finance.read', key: 'staff.permFinanceRead' },
  { id: 'clinical.write', key: 'staff.permClinicalWrite', hint: 'staff.permClinicalWriteHint' },
  { id: 'pharmacy.write', key: 'staff.permPharmacyWrite' },
  { id: 'reports.read', key: 'staff.permReportsRead' },
] as const;

export default function Staff() {
  const { t, label } = useI18n();
  const [inviting, setInviting] = useState(false);
  const [permissionsFor, setPermissionsFor] = useState<Profile | null>(null);
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const staff = useQuery({ queryKey: ['staff'], queryFn: () => listStaff() });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) =>
      updateStaff(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      notify(t('staff.statusUpdated'));
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateStaff(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      notify(t('staff.roleUpdated'));
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('staff.title')}</h1>
          <p>{t('staff.subtitle')}</p>
        </div>
        <div className="page__actions">
          <Button variant="primary" onClick={() => setInviting(true)}>
            <Icon name="plus" /> {t('staff.add')}
          </Button>
        </div>
      </div>

      <Card padded={false}>
        <QueryBoundary
          query={staff}
          skeletonRows={6}
          empty={<EmptyState title={t('staff.empty')}
            description={t('staff.emptyHint')} />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>{t('common.name')}</th><th>{t('staff.role')}</th>
                    <th>{t('staff.specialty')}</th><th>{t('common.phone')}</th>
                    <th>{t('staff.joined')}</th><th>{t('common.status')}</th><th /></tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={s.full_name} />
                          <div>
                            <b>{s.full_name}</b>
                            <small>{s.email}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Select value={s.role} style={{ width: 150 }}
                          onChange={(e) => changeRole.mutate({ id: s.id, role: e.target.value as UserRole })}>
                          {ROLES.map((r) => <option key={r} value={r}>{label('role', r)}</option>)}
                        </Select>
                      </td>
                      <td>{s.specialty ?? '—'}</td>
                      <td>{s.phone ?? '—'}</td>
                      <td>{dateOnly(s.joined_date)}</td>
                      <td><Badge tone={s.status === 'active' ? 'ok' : 'muted'}>{label('status', s.status)}</Badge></td>
                      <td className="right">
                        <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                          <Button size="sm" onClick={() => setPermissionsFor(s)}>{t('staff.permissions')}</Button>
                          <Button size="sm"
                            onClick={() => toggleStatus.mutate({
                              id: s.id, status: s.status === 'active' ? 'inactive' : 'active',
                            })}>
                            {s.status === 'active' ? t('staff.deactivate') : t('staff.activate')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </QueryBoundary>
      </Card>

      <InviteModal open={inviting} onClose={() => setInviting(false)} />
      <PermissionsModal profile={permissionsFor} onClose={() => setPermissionsFor(null)} />
    </>
  );
}

function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t, label } = useI18n();
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'receptionist' as UserRole });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => inviteStaff(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      notify(t('staff.created'));
      setForm({ full_name: '', email: '', password: '', role: 'receptionist' });
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('staff.add')}
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" loading={create.isPending}
            onClick={() => {
              setError(null);
              if (form.full_name.trim().length < 2) { setError(t('staff.errName')); return; }
              if (!form.email.includes('@')) { setError(t('staff.errEmail')); return; }
              if (form.password.length < 8) { setError(t('staff.errPassword')); return; }
              create.mutate();
            }}>
            {t('staff.create')}
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label={t('register.fullName')} required>
          <Input value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
        </Field>
        <Field label={t('staff.role')} required>
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
            {ROLES.map((r) => <option key={r} value={r}>{label('role', r)}</option>)}
          </Select>
        </Field>
        <Field label={t('common.email')} required>
          <Input type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label={t('staff.tempPassword')} required hint={t('staff.tempPasswordHint')}>
          <Input type="text" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </Field>
      </div>
      <p className="text-2xs faint mt-12">{t('staff.createFootnote')}</p>
    </Modal>
  );
}

function PermissionsModal({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { t, label } = useI18n();
  const overrides = useQuery({
    queryKey: ['permissions', profile?.id],
    queryFn: () => listPermissionOverrides(profile!.id),
    enabled: Boolean(profile),
  });

  const toggle = useMutation({
    mutationFn: ({ permission, granted }: { permission: string; granted: boolean }) =>
      setPermissionOverride(profile!.id, permission, granted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', profile?.id] });
      notify(t('staff.permUpdated'));
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const granted = new Set((overrides.data ?? []).filter((o) => o.granted).map((o) => o.permission));

  return (
    <Modal open={profile !== null} onClose={onClose}
      title={`${t('staff.permissionsFor')} — ${profile?.full_name ?? ''}`}
      footer={<Button onClick={onClose}>{t('common.done')}</Button>}>
      <p className="text-sm muted mb-16">
        {t('staff.permissionsIntro', { role: profile ? label('role', profile.role) : '' })}
      </p>
      <div className="col" style={{ gap: 12 }}>
        {GRANTABLE.map((p) => (
          <div key={p.id} className="row">
            <div className="grow">
              <b className="text-sm">{t(p.key)}</b>
              {'hint' in p && <div className="text-2xs faint">{t(p.hint)}</div>}
            </div>
            <Checkbox
              label=""
              checked={granted.has(p.id)}
              onChange={(e) => toggle.mutate({ permission: p.id, granted: e.target.checked })}
            />
          </div>
        ))}
      </div>
    </Modal>
  );
}
