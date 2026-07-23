import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RoleProvider, useRole } from './src/context/RoleContext';
import { PhotoProvider } from './src/context/PhotoContext';
import { SchoolProvider } from './src/context/SchoolContext';
import { ViewModeProvider } from './src/context/ViewModeContext';
import { AppDataProvider } from './src/context/AppDataContext';
import { LessonsProvider } from './src/context/LessonsContext';
import RootNavigator from './src/navigation/RootNavigator';
import SchoolAppShell from './src/navigation/SchoolAppShell';
import UniversityAppShell from './src/navigation/UniversityAppShell';
import LandingScreen from './src/screens/LandingScreen';
import LoadingScreen from './src/screens/LoadingScreen';
import { LoadingOverlay } from './src/components/LoadingDots';
import MinistryReviewScreen from './src/screens/MinistryReviewScreen';
import AuthFlow from './src/screens/auth/AuthFlow';
import SetPasswordScreen from './src/screens/auth/SetPasswordScreen';
import PendingScreen from './src/screens/auth/PendingScreen';
import InstitutionStateScreen from './src/screens/InstitutionStateScreen';
import { initializeAppData } from './src/services/appDataRepository';
const { SHELLS, resolveInstitutionShell } = require('./src/domain/institutionRouting');

/* Bridge: in LIVE mode, drive the RoleContext from the DATABASE profile role
   (never a UI picker) and inject the real identity so no demo name/school ever
   shows for an authenticated user. Clears the override in demo/signed-out. */
function useLiveRoleBridge() {
  const { isLive, roleKey, profile, schoolName } = useAuth();
  const { setRole, setLiveIdentity } = useRole();
  useEffect(() => {
    if (isLive && roleKey && roleKey !== 'pending') {
      setRole(roleKey);
      setLiveIdentity({
        name: (profile && profile.full_name) || 'Kobciye',
        school_id: profile ? profile.school_id : null,
        sub: schoolName || (roleKey === 'superadmin' ? 'Kobciye Platform · Maamulka Guud' : 'Kobciye'),
        profile_id: profile ? profile.id : null,
      });
    } else {
      setLiveIdentity(null);
    }
  }, [isLive, roleKey, profile, schoolName, setRole, setLiveIdentity]);
}

function NavWrapper() {
  const { c } = useTheme();
  const auth = useAuth();
  useLiveRoleBridge();

  const [loading, setLoading] = useState(true);         // splash animation
  const [entered, setEntered] = useState(false);        // passed the landing page
  const [ministry, setMinistry] = useState(false);      // ministry review portal (code-gated)

  // seed/migrate the ONE canonical demo store once on first launch (demo mode)
  useEffect(() => { initializeAppData(); }, []);

  // returning authenticated users (or an active invite/reset flow) skip the
  // marketing landing automatically
  useEffect(() => {
    if (auth.status === 'signed_in' || auth.flow === 'set_password') setEntered(true);
  }, [auth.status, auth.flow]);

  const navTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: c.bg, card: c.surface, text: c.ink, border: c.line, primary: c.blue,
    },
  };

  // 1) splash/loading screen (web kob-loader port)
  if (loading) {
    return (
      <>
        <StatusBar style="light" />
        <LoadingScreen onDone={() => setLoading(false)} />
      </>
    );
  }

  // 1b) still restoring the Supabase session
  if (auth.status === 'initializing') {
    return (<><StatusBar style="dark" /><LoadingOverlay /></>);
  }

  // 1c) ministry review portal — reached from the landing, gated by a code
  if (ministry) {
    return (
      <>
        <StatusBar style="dark" />
        <MinistryReviewScreen onBack={() => setMinistry(false)} />
      </>
    );
  }

  // 2) invite / password-reset link → set-your-own-password (highest priority)
  if (auth.flow === 'set_password') {
    return (<><StatusBar style="dark" /><SetPasswordScreen mode={auth.flowType} /></>);
  }

  // 3) real, authenticated session
  if (auth.status === 'signed_in') {
    if (auth.profileStatus === 'loading' || auth.profileStatus === 'idle') {
      return (<><StatusBar style="dark" /><LoadingOverlay /></>);
    }
    if (auth.profileStatus === 'error') {
      return (<><StatusBar style="dark" /><InstitutionStateScreen kind="error" onRetry={auth.refreshProfile} onSignOut={auth.signOut} /></>);
    }
    if (!auth.roleKey || auth.roleKey === 'pending') {
      return (<><StatusBar style="dark" /><PendingScreen /></>);
    }
    const shell = resolveInstitutionShell({
      authStatus: auth.status,
      roleKey: auth.roleKey,
      profileStatus: auth.profileStatus,
      profile: auth.profile,
    });
    if (shell === SHELLS.LOADING) return (<><StatusBar style="dark" /><LoadingOverlay /></>);
    if (shell === SHELLS.ERROR) {
      return (<><StatusBar style="dark" /><InstitutionStateScreen kind="error" onRetry={auth.refreshProfile} onSignOut={auth.signOut} /></>);
    }
    if (shell === SHELLS.UNCLASSIFIED) {
      return (<><StatusBar style="dark" /><InstitutionStateScreen kind="unclassified" onRetry={auth.refreshProfile} onSignOut={auth.signOut} /></>);
    }
    if (shell === SHELLS.UNIVERSITY) {
      return (<><StatusBar style="dark" /><UniversityAppShell /></>);
    }
    const Shell = shell === SHELLS.SCHOOL ? SchoolAppShell : RootNavigator;
    return (
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <Shell />
      </NavigationContainer>
    );
  }

  // 4) local demo/preview mode (explicitly chosen from the login screen)
  if (auth.demoActive) {
    return (
      <NavigationContainer theme={navTheme}>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    );
  }

  // 5) marketing landing → sign-in gate
  if (!entered) {
    return (
      <>
        <StatusBar style="dark" />
        <LandingScreen onEnter={() => setEntered(true)} onMinistry={() => setMinistry(true)} />
      </>
    );
  }

  return (<><StatusBar style="dark" /><AuthFlow /></>);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RoleProvider>
            <PhotoProvider>
              <SchoolProvider>
                <ViewModeProvider>
                  <AppDataProvider>
                    <LessonsProvider>
                      <NavWrapper />
                    </LessonsProvider>
                  </AppDataProvider>
                </ViewModeProvider>
              </SchoolProvider>
            </PhotoProvider>
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
