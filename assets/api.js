/* API client — CIIDANKA BOOLISKA GOBOLKA GABILEY */
const API = (() => {
  'use strict';

  const BASE = 'api';
  let csrfToken = sessionStorage.getItem('police_csrf') || '';

  function rememberCsrf(payload) {
    if (payload?.csrf_token) { csrfToken = payload.csrf_token; sessionStorage.setItem('police_csrf', csrfToken); }
    return payload;
  }

  async function request(path, { method = 'GET', body = null, params = null } = {}) {
    let url = `${BASE}/${path}`;
    if (params) {
      const query = new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== null && value !== undefined && value !== '')
      ).toString();
      if (query) url += `?${query}`;
    }

    const options = { method, credentials: 'include', headers: {} };
    if (method !== 'GET' && csrfToken) options.headers['X-CSRF-Token'] = csrfToken;
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw new Error('Jawaab aan sax ahayn ayaa laga helay server-ka.');
    }

    if (!response.ok) {
      if (response.status === 401 && !path.startsWith('auth/')) {
        window.location.href = 'login.html';
      }
      throw new Error(payload.error || 'Khalad ayaa dhacay.');
    }
    return rememberCsrf(payload);
  }

  async function uploadProfilePhoto(targetType, targetId, file) {
    const form = new FormData();
    form.append('target_type', targetType);
    form.append('target_id', String(targetId));
    form.append('photo', file);
    const response = await fetch(`${BASE}/profile-photo.php`, {
      method: 'POST', credentials: 'include', body: form, headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    });
    let payload;
    try { payload = await response.json(); }
    catch (_) { throw new Error('Jawaab aan sax ahayn ayaa laga helay server-ka.'); }
    if (!response.ok) throw new Error(payload.error || 'Sawirka lama kaydin karin.');
    return rememberCsrf(payload);
  }


  async function uploadDocument(formData) {
    const response = await fetch(`${BASE}/documents.php`, {
      method: 'POST', credentials: 'include', body: formData, headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {}
    });
    let payload;
    try { payload = await response.json(); }
    catch (_) { throw new Error('Jawaab aan sax ahayn ayaa laga helay server-ka.'); }
    if (!response.ok) throw new Error(payload.error || 'Dukumentiga lama upload-gareyn karin.');
    return rememberCsrf(payload);
  }

  const crud = (resource) => ({
    list:   (params)     => request(`${resource}.php`, { params }),
    create: (data)       => request(`${resource}.php`, { method: 'POST', body: data }),
    update: (id, data)   => request(`${resource}.php`, { method: 'PUT', body: { id, ...data } }),
    remove: (id)         => request(`${resource}.php`, { method: 'DELETE', params: { id } }),
    search: (query)      => request(`${resource}.php`, { params: { search: query } }),
  });

  return {
    request,
    uploadProfilePhoto,
    uploadDocument,

    login:   (email, password) => request('auth/login.php', { method: 'POST', body: { email, password } }),
    logout:  ()                => request('auth/logout.php', { method: 'POST' }),
    session: ()                => request('auth/session.php'),
    changePassword: (data)     => request('auth/change-password.php', { method: 'POST', body: data }),

    officers:     crud('officers'),
    cases:        crud('cases'),
    operations:   crud('operations'),
    incidents:    crud('incidents'),
    citizens:     crud('citizens'),
    evidence:     crud('evidence'),
    prisoners:    crud('prisoners'),
    patrol:       crud('patrol'),
    fleet:        crud('fleet'),
    complaints:   crud('complaints'),
    intelligence: crud('intelligence'),
    contacts:     crud('contacts'),
    users:        crud('users'),
    invitations: {
      list:   () => request('invitations.php'),
      create: (data) => request('invitations.php', { method: 'POST', body: { action: 'create', ...data } }),
      resend: (invitation_id) => request('invitations.php', { method: 'POST', body: { action: 'resend', invitation_id } }),
      revoke: (invitation_id) => request('invitations.php', { method: 'POST', body: { action: 'revoke', invitation_id } }),
    },
    userPermissions: {
      catalog: () => request('user-permissions.php'),
      get: (user_id) => request('user-permissions.php', { params: { user_id } }),
      save: (data) => request('user-permissions.php', { method: 'PUT', body: data }),
    },
    finance:      crud('finance'),
    reports:      crud('reports'),
    dispatch:     crud('dispatch'),
    arrests:      crud('arrests'),
    custody:      crud('custody'),
    roster:       crud('roster'),
    tasks:        crud('tasks'),
    evidenceChain: crud('evidence-chain'),
    documents:     crud('documents'),

    dashboard:       ()      => request('dashboard.php'),
    financeSummary:  ()      => request('finance.php', { params: { view: 'summary' } }),
    getSettings:     ()      => request('settings.php'),
    saveSettings:    (data)  => request('settings.php', { method: 'PUT', body: data }),
    generateReport:  (data)  => request('reports.php', { method: 'POST', body: data }),
    globalSearch:    (query) => request('search.php', { params: { q: query } }),
    submitContact:   (data)  => request('contacts.php', { method: 'POST', body: data }),
  };
})();
