import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button, Field, Input, useToast } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { isSupabaseConfigured, readableError } from '@/lib/supabase';

export default function Login() {
  const { session, signIn, resetPassword, loading } = useAuth();
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
      setError('Enter your email address first, then choose "Forgot password".');
      return;
    }
    try {
      await resetPassword(email.trim());
      notify('Password reset link sent. Check your email.');
    } catch (err) {
      setError(readableError(err));
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={onSubmit}>
        <div className="login__brand">
          <span className="brand__mark"><Icon name="tooth" size={16} /></span>
          <div>
            <div className="login__title">Dental Clinic</div>
            <div className="text-2xs faint">Management system</div>
          </div>
        </div>

        <h1 className="login__title">Sign in</h1>
        <p className="login__sub">Use the account your clinic administrator created for you.</p>

        {!isSupabaseConfigured && (
          <div className="login__error">
            Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and
            add your project URL and anon key.
          </div>
        )}
        {error && <div className="login__error" role="alert">{error}</div>}

        <div className="col" style={{ gap: 14 }}>
          <Field label="Email" required>
            <Input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@clinic.com"
            />
          </Field>

          <Field label="Password" required>
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
                {showPassword ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </Field>

          <Button type="submit" variant="primary" loading={busy} disabled={!isSupabaseConfigured}>
            Sign in
          </Button>

          <button type="button" className="text-xs muted" onClick={onForgot} style={{ fontWeight: 600 }}>
            Forgot password?
          </button>
        </div>
      </form>
    </div>
  );
}
