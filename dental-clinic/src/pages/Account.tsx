import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { updateStaff } from '@/services/admin';
import { readableError } from '@/lib/supabase';
import { dateOnly } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { Button, Card, Field, Input, Skeleton, useToast } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useI18n } from '@/i18n';

/**
 * Everyone needs to be able to change their own password without asking the
 * admin, and the name here is the one printed on the receipts they issue.
 */
export default function Account() {
  const { profile, changePassword, refreshProfile } = useAuth();
  const { t, label } = useI18n();
  const { notify } = useToast();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!profile) return <Skeleton rows={6} />;
  if (!loaded) {
    setLoaded(true);
    setFullName(profile.full_name);
    setPhone(profile.phone ?? '');
  }

  const saveDetails = useMutation({
    mutationFn: () => updateStaff(profile.id, {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
    }),
    onSuccess: async () => {
      await refreshProfile();
      notify(t('account.saved'));
    },
    onError: (e) => setDetailsError(readableError(e)),
  });

  const savePassword = useMutation({
    mutationFn: () => changePassword(password),
    onSuccess: () => {
      notify(t('account.passwordChanged'));
      setPassword(''); setConfirm('');
    },
    onError: (e) => setPasswordError(readableError(e)),
  });

  return (
    <>
      <div className="page__head">
        <div>
          <h1>{t('account.title')}</h1>
          <p>{t('account.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid--wide">
        <Card title={t('account.details')} subtitle={t('account.detailsHint')}>
          {detailsError && <div className="login__error" role="alert">{detailsError}</div>}
          <div className="form-grid">
            <div className="full">
              <Field label={t('register.fullName')} required>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
            </div>
            <Field label={t('common.phone')}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label={t('common.email')}>
              <Input value={profile.email ?? ''} disabled />
            </Field>
            <Field label={t('account.role')} hint={t('account.roleHint')}>
              <Input value={label('role', profile.role)} disabled />
            </Field>
            <Field label={t('staff.joined')}>
              <Input value={dateOnly(profile.joined_date)} disabled />
            </Field>
          </div>
          <div className="row mt-16">
            <Button variant="primary" className="ml-auto" loading={saveDetails.isPending}
              onClick={() => {
                setDetailsError(null);
                if (fullName.trim().length < 2) { setDetailsError(t('account.errName')); return; }
                saveDetails.mutate();
              }}>
              <Icon name="check" /> {t('common.saveChanges')}
            </Button>
          </div>
        </Card>

        <Card title={t('account.password')} subtitle={t('account.passwordHint')}>
          {passwordError && <div className="login__error" role="alert">{passwordError}</div>}
          <div className="form-grid">
            <div className="full">
              <Field label={t('account.newPassword')} required>
                <Input type="password" value={password} autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)} />
              </Field>
            </div>
            <div className="full">
              <Field label={t('account.confirmPassword')} required>
                <Input type="password" value={confirm} autoComplete="new-password"
                  onChange={(e) => setConfirm(e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="row mt-16">
            <Button variant="primary" className="ml-auto" loading={savePassword.isPending}
              onClick={() => {
                setPasswordError(null);
                if (password.length < 8) { setPasswordError(t('account.errPasswordShort')); return; }
                if (password !== confirm) { setPasswordError(t('account.errPasswordMatch')); return; }
                savePassword.mutate();
              }}>
              {t('account.changePassword')}
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}
