import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { can, type Permission } from '@/lib/permissions';
import type { Profile } from '@/types/database';

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  overrides: string[];
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [overrides, setOverrides] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile(userId: string) {
      const [{ data: prof, error: profErr }, { data: perms }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_permissions').select('permission, granted').eq('user_id', userId),
      ]);
      if (!active) return;
      if (profErr) setError(profErr.message);
      setProfile((prof ?? null) as Profile | null);
      setOverrides((perms ?? []).filter((p) => p.granted).map((p) => p.permission));
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      if (next?.user) {
        await loadProfile(next.user.id);
      } else {
        setProfile(null);
        setOverrides([]);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      overrides,
      loading,
      error,
      async signIn(email, password) {
        setError(null);
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      },
      async signOut() {
        await supabase.auth.signOut();
        setProfile(null);
        setOverrides([]);
      },
      async resetPassword(email) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (resetError) throw resetError;
      },
      can: (permission) => can(profile?.role, permission, overrides),
    }),
    [session, profile, overrides, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
