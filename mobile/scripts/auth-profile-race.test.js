#!/usr/bin/env node
/* Executes the real AuthProvider and proves that an in-flight profile load
 * cannot resurrect a session after a newer SIGNED_OUT event. */
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

const ROOT = path.resolve(__dirname, '..');
const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-auth-profile-race'));
const authContextPath = path.join(compiledSrc, 'context', 'AuthContext.js');
let failures = 0;
const ok = (name, condition) => {
  console.log(condition ? 'PASS' : 'FAIL', name);
  if (!condition) failures += 1;
};

const states = [];
const refs = [];
const effects = [];
const statusTransitions = [];
let stateIndex = 0;
let refIndex = 0;
const STATUS = 0;
const PROFILE = 7;
const PROFILE_STATUS = 8;

function useState(initial) {
  const index = stateIndex++;
  if (!(index in states)) states[index] = initial;
  return [states[index], (next) => {
    states[index] = typeof next === 'function' ? next(states[index]) : next;
    if (index === STATUS) statusTransitions.push(states[index]);
  }];
}
function useRef(initial) {
  const index = refIndex++;
  if (!(index in refs)) refs[index] = { current: initial };
  return refs[index];
}
function createContext(value) { return { _currentValue: value, Provider: 'Provider' }; }
const ReactMock = {
  createContext,
  createElement: (type, props, ...children) => ({ type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children } }),
  useContext: (context) => context._currentValue,
  useEffect: (effect) => effects.push(effect),
  useState,
  useRef,
  useCallback: (fn) => fn,
};

const timeline = [];
const session = { access_token: 'old-token', user: { id: 'user-1' } };
const service = {
  supabase: {},
  isSupabaseConfigured: () => true,
  restoreSession: async () => { timeline.push('restore'); return session; },
  getMyProfile: async () => {
    timeline.push('profile:start');
    await new Promise((resolve) => setTimeout(resolve, 40));
    timeline.push('profile:resolved');
    return { id: 'user-1', role: 'school_admin', school_id: 'school-1', school: { institution_type: 'school', school_stage: 'secondary' } };
  },
  onAuthStateChange: (callback) => {
    setTimeout(() => { timeline.push('SIGNED_OUT'); callback('SIGNED_OUT', null); }, 5);
    return () => {};
  },
  signInWithEmail: async () => {}, signOut: async () => {},
  requestPasswordResetSecure: async () => {}, updatePassword: async () => {},
  setSessionFromTokens: async () => {}, exchangeCodeForSession: async () => {},
  verifyTokenHash: async () => {}, acceptSchoolInvite: async () => {},
};

const originalLoad = Module._load;
Module._load = function loadAuthDependency(request, parent, isMain) {
  if (request === 'react') return ReactMock;
  if (request === 'react-native') {
    return { Platform: { OS: 'web' }, Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove: () => {} }) } };
  }
  if (request === '@supabase/supabase-js') return { isAuthRetryableFetchError: () => false };
  if (request === '../services/supabase') return service;
  if (request === '../services/liveMode') return { setLiveSupabaseMode: () => {} };
  if (request === '../data/roleMap') return { roleKeyForDbRole: (role) => role };
  return originalLoad.call(this, request, parent, isMain);
};

global.window = {
  location: { href: 'https://app.example.com/', pathname: '/' },
  history: { replaceState: () => {} },
};

let AuthProvider;
try {
  ({ AuthProvider } = require(authContextPath));
} finally {
  Module._load = originalLoad;
}

(async () => {
  const element = AuthProvider({ children: null });
  ok('real AuthProvider mounts for the profile/sign-out race', !!element && element.type === 'Provider');
  while (effects.length) effects.shift()();
  await new Promise((resolve) => setTimeout(resolve, 100));

  const signOutIndex = timeline.indexOf('SIGNED_OUT');
  const profileResolvedIndex = timeline.indexOf('profile:resolved');
  ok('the SIGNED_OUT event actually wins the in-flight profile race', signOutIndex !== -1
    && profileResolvedIndex !== -1 && signOutIndex < profileResolvedIndex);
  ok('a stale profile response never changes status back to signed_in', states[STATUS] === 'signed_out'
    && statusTransitions[statusTransitions.length - 1] === 'signed_out'
    && !statusTransitions.slice(statusTransitions.lastIndexOf('signed_out') + 1).includes('signed_in'));
  ok('the stale profile is not committed after sign-out', states[PROFILE] === null);
  ok('profile state remains safely idle after sign-out', states[PROFILE_STATUS] === 'idle');

  if (failures) {
    console.error(`auth profile race FAILED with ${failures} issue(s)`);
    process.exit(1);
  }
  console.log('auth profile race PASSED');
})().catch((error) => { console.error(error); process.exit(1); });
