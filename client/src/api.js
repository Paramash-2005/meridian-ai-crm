// '' is a valid value (same-origin, behind a reverse proxy) — only fall back when the var is unset entirely.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && path !== '/auth/login') {
    // The stored token is stale (expired, or signed by a JWT_SECRET the server no longer uses,
    // e.g. after a redeploy) — clear it and send the user back to a real login instead of
    // leaving every page stuck showing a raw "invalid token" error.
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token) => request('/auth/me', { token }),

  getUsers: (token) => request('/users', { token }),
  createUser: (body, token) => request('/users', { method: 'POST', body, token }),
  updateUser: (id, body, token) => request(`/users/${id}`, { method: 'PUT', body, token }),

  getLeads: (token, params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/leads${qs ? `?${qs}` : ''}`, { token });
  },
  getLead: (id, token) => request(`/leads/${id}`, { token }),
  createLead: (body, token) => request('/leads', { method: 'POST', body, token }),
  updateLead: (id, body, token) => request(`/leads/${id}`, { method: 'PUT', body, token }),
  addNote: (id, text, token) => request(`/leads/${id}/notes`, { method: 'POST', body: { text }, token }),
  generateAutoReply: (id, token) => request(`/leads/${id}/auto-reply`, { method: 'POST', token }),
  rescoreLead: (id, token) => request(`/leads/${id}/rescore`, { method: 'POST', token }),

  getDashboardSummary: (token) => request('/dashboard/summary', { token }),
};
