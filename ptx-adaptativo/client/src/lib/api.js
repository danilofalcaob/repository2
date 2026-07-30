async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  generate: (body) => request('/generate', { method: 'POST', body }),
  feedback: (body) => request('/feedback', { method: 'POST', body }),
  dashboard: () => request('/dashboard'),
  rules: () => request('/rules'),
  createRule: (body) => request('/rules', { method: 'POST', body }),
  updateRule: (id, body) => request(`/rules/${id}`, { method: 'PATCH', body }),
  deleteRule: (id) => request(`/rules/${id}`, { method: 'DELETE' }),
  purge: (body) => request('/admin/purge', { method: 'POST', body }),
};
