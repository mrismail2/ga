#!/usr/bin/env node
/* Executes the shipped profile service and AuthProvider against deterministic
 * Supabase doubles. This keeps profile-read failures distinct from institution-
 * read failures and proves both remain behind the safe application-shell gate. */
const path = require('path');
const os = require('os');
const Module = require('module');
const { transpileSourceTree } = require('./transpile-test-source');

process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.invalid';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-test-key';

const ROOT = path.resolve(__dirname, '..');
const compiledSrc = transpileSourceTree(ROOT, path.join(os.tmpdir(), 'kobciye-institution-profile'));
const { SHELLS, resolveInstitutionShell } = require(path.join(ROOT, 'src', 'domain', 'institutionRouting.js'));
let failures = 0;
const ok = (name, condition) => {
  console.log(condition ? 'PASS' : 'FAIL', name);
  if (!condition) failures += 1;
};

let scenario = null;
let calls = [];
const session = { access_token: 'test-session', user: { id: 'user-1' } };

function responseFor(table) {
  if (table === 'profiles') return scenario.profile;
  if (table === 'schools') return scenario.institution;
  throw new Error(`Unexpected table: ${table}`);
}

function queryFor(table) {
  const call = { table, select: null, column: null, value: null };
  calls.push(call);
  return {
    select(fields) { call.select = fields; return this; },
    eq(column, value) { call.column = column; call.value = value; return this; },
    async maybeSingle() { return responseFor(table); },
  };
}

const client = {
  auth: {
    async getUser() {
      return scenario.userError
        ? { data: null, error: scenario.userError }
        : { data: { user: scenario.noUser ? null : session.user }, error: null };
    },
    async getSession() { return { data: { session }, error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
    async signOut() {},
  },
  from: queryFor,
};

class FunctionsFetchError extends Error {}
class FunctionsHttpError extends Error {}
class FunctionsRelayError extends Error {}
const supabaseSdkDouble = {
  createClient: () => client,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  isAuthRetryableFetchError: () => false,
};
const storageDouble = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };

const originalLoad = Module._load;
Module._load = function loadProfileServiceDependency(request, parent, isMain) {
  if (request === 'react-native-url-polyfill/auto') return {};
  if (request === '@react-native-async-storage/async-storage') return { ...storageDouble, default: storageDouble };
  if (request === '@supabase/supabase-js') return supabaseSdkDouble;
  return originalLoad.call(this, request, parent, isMain);
};

let profileService;
try {
  profileService = require(path.join(compiledSrc, 'services', 'supabase.js'));
} finally {
  Module._load = originalLoad;
}

const profile = (overrides = {}) => ({
  id: 'user-1', full_name: 'Admin', phone: null, avatar_url: null,
  role: 'school_admin', school_id: 'school-1', ...overrides,
});
const institution = (overrides = {}) => ({
  id: 'school-1', name: 'Kobciye', location: 'Hargeisa', student_id_prefix: 'KOB',
  next_student_sequence: 1, institution_type: 'school', school_stage: 'secondary', ...overrides,
});

async function rejectedCode(config) {
  scenario = config;
  calls = [];
  try {
    await profileService.getMyProfile();
    return null;
  } catch (error) {
    return error && error.code;
  }
}

async function loadedProfile(config) {
  scenario = config;
  calls = [];
  return profileService.getMyProfile();
}

async function verifyServiceBehavior() {
  const profileFailure = await rejectedCode({ profile: { data: null, error: { code: 'db_error' } } });
  ok('profile query failures use stable profile_load_failed', profileFailure === 'profile_load_failed');
  ok('profile failure never starts an institution query', calls.length === 1 && calls[0].table === 'profiles');

  const institutionFailure = await rejectedCode({
    profile: { data: profile(), error: null },
    institution: { data: null, error: { code: 'db_error' } },
  });
  ok('institution query failures use stable institution_load_failed', institutionFailure === 'institution_load_failed');
  ok('institution failure happens after separate profile and schools reads', calls.map((call) => call.table).join(',') === 'profiles,schools');

  const school = await loadedProfile({
    profile: { data: profile(), error: null },
    institution: { data: institution(), error: null },
  });
  ok('profile query requests profile fields only', calls[0]
    && calls[0].select === 'id, full_name, phone, avatar_url, role, school_id'
    && calls[0].column === 'id' && calls[0].value === 'user-1');
  ok('institution query requests the complete preserved school shape', calls[1]
    && calls[1].select === 'id, name, location, student_id_prefix, next_student_sequence, institution_type, school_stage'
    && calls[1].column === 'id' && calls[1].value === 'school-1');
  ok('valid school is annotated valid_school', school.institution_resolution === 'valid_school');
  ok('valid school preserves the expected school object fields', school.school
    && school.school.id === 'school-1'
    && school.school.name === 'Kobciye'
    && school.school.location === 'Hargeisa'
    && school.school.student_id_prefix === 'KOB'
    && school.school.next_student_sequence === 1
    && school.school.institution_type === 'school'
    && school.school.school_stage === 'secondary');
  ok('valid school profile routes to the shared School shell', resolveInstitutionShell({
    authStatus: 'signed_in', roleKey: 'schooladmin', profileStatus: 'ready', profile: school,
  }) === SHELLS.SCHOOL);

  const university = await loadedProfile({
    profile: { data: profile(), error: null },
    institution: { data: institution({ institution_type: 'university', school_stage: null }), error: null },
  });
  ok('valid university is annotated valid_university', university.institution_resolution === 'valid_university');
  ok('valid university profile routes only to the University shell', resolveInstitutionShell({
    authStatus: 'signed_in', roleKey: 'schooladmin', profileStatus: 'ready', profile: university,
  }) === SHELLS.UNIVERSITY);

  const legacy = await loadedProfile({
    profile: { data: profile(), error: null },
    institution: { data: institution({ institution_type: null, school_stage: null }), error: null },
  });
  ok('legacy institution is annotated unclassified', legacy.institution_resolution === 'unclassified');
  ok('legacy institution routes to the safe unclassified state', resolveInstitutionShell({
    authStatus: 'signed_in', roleKey: 'schooladmin', profileStatus: 'ready', profile: legacy,
  }) === SHELLS.UNCLASSIFIED);

  const platform = await loadedProfile({ profile: { data: profile({ role: 'super_admin', school_id: null }), error: null } });
  ok('super_admin profile is annotated platform without an institution read', platform.institution_resolution === 'platform'
    && platform.school === null && calls.length === 1);

  const pending = await loadedProfile({ profile: { data: profile({ role: 'pending', school_id: null }), error: null } });
  ok('pending profile is annotated pending without an institution read', pending.institution_resolution === 'pending'
    && pending.school === null && calls.length === 1);

  ok('missing authenticated user preserves no_authenticated_user', await rejectedCode({ noUser: true }) === 'no_authenticated_user');
  ok('missing profile preserves profile_not_found', await rejectedCode({ profile: { data: null, error: null } }) === 'profile_not_found');
  ok('auth user lookup failures use stable profile_load_failed', await rejectedCode({ userError: { code: 'network' } }) === 'profile_load_failed');
  ok('profile loading still selects no application shell', resolveInstitutionShell({
    authStatus: 'signed_in', profileStatus: 'loading', profile: null,
  }) === SHELLS.LOADING);
}

async function authErrorState(config, expectedCode) {
  scenario = config;
  calls = [];
  const states = [];
  const refs = [];
  const effects = [];
  let stateIndex = 0;
  let refIndex = 0;
  const ReactMock = {
    createContext: (value) => ({ _currentValue: value, Provider: 'Provider' }),
    createElement: (type, props, ...children) => ({
      type, props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
    }),
    useContext: (context) => context._currentValue,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect: (effect) => effects.push(effect),
    useCallback: (fn) => fn,
  };

  const authPath = path.join(compiledSrc, 'context', 'AuthContext.js');
  delete require.cache[authPath];
  Module._load = function loadAuthDependency(request, parent, isMain) {
    if (request === 'react') return ReactMock;
    if (request === 'react-native') {
      return { Platform: { OS: 'web' }, Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) } };
    }
    if (request === '@supabase/supabase-js') return supabaseSdkDouble;
    if (request === '../services/supabase') return profileService;
    if (request === '../services/liveMode') return { setLiveSupabaseMode() {} };
    if (request === '../data/roleMap') return { roleKeyForDbRole: (role) => role };
    return originalLoad.call(this, request, parent, isMain);
  };

  let AuthProvider;
  try {
    ({ AuthProvider } = require(authPath));
  } finally {
    Module._load = originalLoad;
  }

  global.window = {
    location: { href: 'https://app.example.com/', pathname: '/' },
    history: { replaceState() {} },
  };
  AuthProvider({ children: null });
  while (effects.length) effects.shift()();
  await new Promise((resolve) => setTimeout(resolve, 20));

  const status = states[0];
  const profileStatus = states[8];
  const profileError = states[9];
  ok(`AuthContext exposes ${expectedCode} through profileError`, profileStatus === 'error'
    && profileError && profileError.code === expectedCode);
  ok(`${expectedCode} remains behind the safe error shell`, status === 'signed_in'
    && resolveInstitutionShell({ authStatus: status, profileStatus, profile: states[7] }) === SHELLS.ERROR);
}

(async () => {
  await verifyServiceBehavior();
  await authErrorState({ profile: { data: null, error: { code: 'db_error' } } }, 'profile_load_failed');
  await authErrorState({
    profile: { data: profile(), error: null },
    institution: { data: null, error: { code: 'db_error' } },
  }, 'institution_load_failed');

  if (failures) {
    console.error(`institution profile behavior FAILED with ${failures} issue(s)`);
    process.exit(1);
  }
  console.log('institution profile behavior PASSED');
})().catch(() => {
  console.error('institution profile behavior FAILED unexpectedly');
  process.exit(1);
});
