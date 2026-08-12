import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button, Field, Input, useToast } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { isSupabaseConfigured, readableError } from '@/lib/supabase';
import { useI18n } from '@/i18n';

export default function Login() {
  const { session, signIn, resetPassword, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const { notify } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session && !loading) {
    const from = (location.state as { from?: string })?.from ?? '/';
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    if (!email.trim()) {
      setError(t('login.forgotFirst'));
      return;
    }
    try {
      await resetPassword(email.trim());
      notify(t('login.resetSent'));
    } catch (err) {
      setError(readableError(err));
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={onSubmit}>
        <div className="login__brand">
          <span className="brand__mark"><Icon name="tooth" size={16} /></span>
          <div className="grow">
            <div className="login__title">{t('app.name')}</div>
            <div className="text-2xs faint">{t('app.subtitle')}</div>
          </div>
          <div className="seg-toggle">
            <button type="button" className={lang === 'so' ? 'on' : ''} onClick={() => setLang('so')}>SO</button>
            <button type="button" className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
          </div>
        </div>

        <h1 className="login__title">{t('login.title')}</h1>
        <p className="login__sub">{t('login.subtitle')}</p>

        {!isSupabaseConfigured && (
          <div className="login__error">{t('login.notConfigured')}</div>
        )}
        {error && <div className="login__error" role="alert">{error}</div>}

        <div className="col" style={{ gap: 14 }}>
          <Field label={t('common.email')} required>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@clinic.com"
            />
          </Field>

          <Field label={t('login.password')} required>
            <div className="login__pw">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)}>
                {showPassword ? t('login.hide') : t('login.show')}
              </button>
            </div>
          </Field>

          <Button type="submit" variant="primary" loading={busy} disabled={!isSupabaseConfigured}>
            {t('login.title')}
          </Button>

          <button type="button" className="text-xs muted" onClick={onForgot} style={{ fontWeight: 600 }}>
            {t('login.forgot')}
          </button>
        </div>
      </form>
    </div>
  );
}
