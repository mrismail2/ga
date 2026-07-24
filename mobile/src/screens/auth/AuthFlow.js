import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from './LoginScreen';
import RegisterSchoolScreen from './RegisterSchoolScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';

/* Signed-out auth navigator (no real navigator needed). In LIVE (configured)
   mode Kobciye is invite-only: there is NO public school self-registration, so
   the register route is never reachable. RegisterSchoolScreen is a safe
   informational screen that only exists in local demo mode (no backend).
   Real sign-in is handled inside LoginScreen via AuthContext; this component
   only shows when there is NO session and NO set-password flow. */
export default function AuthFlow() {
  const { configured } = useAuth();
  const [screen, setScreen] = useState('login');

  // register is only available in demo (unconfigured) mode
  if (screen === 'register' && !configured) return <RegisterSchoolScreen goLogin={() => setScreen('login')} />;
  if (screen === 'forgot') return <ForgotPasswordScreen goLogin={() => setScreen('login')} />;
  return <LoginScreen goForgot={() => setScreen('forgot')} />;
}
