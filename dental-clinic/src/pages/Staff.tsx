import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inviteStaff, listPermissionOverrides, listStaff, setPermissionOverride, updateStaff,
} from '@/services/admin';
import { readableError } from '@/lib/supabase';
import { dateOnly, titleCase } from '@/lib/format';
import { ROLE_LABEL } from '@/lib/permissions';
import type { Profile, UserRole } from '@/types/database';
import {
  Avatar, Badge, Button, Card, Checkbox, EmptyState, Field, Input, Modal,
  QueryBoundary, Select, useToast,
} from '@/components/ui';
import { Icon } from '@/components/ui/Icon';

const ROLES: UserRole[] = ['admin', 'dentist', 'receptionist', 'pharmacist'];

/** Extra capabilities an admin can grant on top of a role. */
const GRANTABLE = [
  { id: 'finance.write', label: 'Record payments', hint: 'Normally reception only' },
  { id: 'finance.read', label: 'View financial records' },
  { id: 'clinical.write', label: 'Write clinical records', hint: 'Normally dentists only' },
  { id: 'pharmacy.write', label: 'Manage pharmacy stock' },
  { id: 'reports.read', label: 'View reports' },
];

export default function Staff() {
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
      notify('Staff status updated');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRole }) => updateStaff(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      notify('Role updated');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>Staff</h1>
          <p>Clinic team, their roles and what each person is allowed to do.</p>
        </div>
        <div className="page__actions">
          <Button variant="primary" onClick={() => setInviting(true)}>
            <Icon name="plus" /> Add staff account
          </Button>
        </div>
      </div>

      <Card padded={false}>
        <QueryBoundary
          query={staff}
          skeletonRows={6}
          empty={<EmptyState title="No staff accounts"
            description="Create accounts for the dentists, receptionists and pharmacist." />}
        >
          {(rows) => (
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Specialty</th><th>Phone</th>
                    <th>Joined</th><th>Status</th><th /></tr>
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
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </Select>
                      </td>
                      <td>{s.specialty ?? '—'}</td>
                      <td>{s.phone ?? '—'}</td>
                      <td>{dateOnly(s.joined_date)}</td>
                      <td><Badge tone={s.status === 'active' ? 'ok' : 'muted'}>{titleCase(s.status)}</Badge></td>
                      <td className="right">
                        <div className="row row--sm" style={{ justifyContent: 'flex-end' }}>
                          <Button size="sm" onClick={() => setPermissionsFor(s)}>Permissions</Button>
                          <Button size="sm"
                            onClick={() => toggleStatus.mutate({
                              id: s.id, status: s.status === 'active' ? 'inactive' : 'active',
                            })}>
                            {s.status === 'active' ? 'Deactivate' : 'Activate'}
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
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'receptionist' as UserRole });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => inviteStaff(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      notify('Staff account created — they can sign in with these details');
      setForm({ full_name: '', email: '', password: '', role: 'receptionist' });
      onClose();
    },
    onError: (e) => setError(readableError(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add staff account"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending}
            onClick={() => {
              setError(null);
              if (form.full_name.trim().length < 2) { setError('Enter the full name.'); return; }
              if (!form.email.includes('@')) { setError('Enter a valid email address.'); return; }
              if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
              create.mutate();
            }}>
            Create account
          </Button>
        </>
      }
    >
      {error && <div className="login__error" role="alert">{error}</div>}
      <div className="form-grid">
        <Field label="Full name" required>
          <Input value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
        </Field>
        <Field label="Role" required>
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </Select>
        </Field>
        <Field label="Email" required>
          <Input type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </Field>
        <Field label="Temporary password" required hint="Ask them to change it after first sign-in">
          <Input type="text" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
        </Field>
      </div>
      <p className="text-2xs faint mt-12">
        The account is created in Supabase Auth and linked to a staff profile automatically.
        Permissions are enforced in the database, not just in the menus.
      </p>
    </Modal>
  );
}

function PermissionsModal({ profile, onClose }: { profile: Profile | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
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
      notify('Permission updated');
    },
    onError: (e) => notify(readableError(e), 'danger'),
  });

  const granted = new Set((overrides.data ?? []).filter((o) => o.granted).map((o) => o.permission));

  return (
    <Modal open={profile !== null} onClose={onClose}
      title={`Permissions — ${profile?.full_name ?? ''}`}
      footer={<Button onClick={onClose}>Done</Button>}>
      <p className="text-sm muted mb-16">
        Role <b>{profile ? ROLE_LABEL[profile.role] : ''}</b> already grants the standard access.
        These switches add extra capabilities on top, and are checked by the database on every request.
      </p>
      <div className="col" style={{ gap: 12 }}>
        {GRANTABLE.map((p) => (
          <div key={p.id} className="row">
            <div className="grow">
              <b className="text-sm">{p.label}</b>
              {p.hint && <div className="text-2xs faint">{p.hint}</div>}
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
