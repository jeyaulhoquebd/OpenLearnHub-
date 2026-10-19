const rawApiUrl = import.meta.env.VITE_API_URL || '';
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code = 'api_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function apiRequest(path, { method = 'GET', body, token, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(
      'The OpenLearn API could not be reached. Please check your connection or try again later.',
      0,
      'network_error'
    );
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message || payload?.message || 'Something went wrong. Please try again.',
      response.status,
      payload?.error?.code || 'request_failed'
    );
  }

  return payload;
}

export function submitReport(payload, token) {
  return apiRequest('/api/reports', { method: 'POST', body: payload, token });
}

export function askLearnMate({ messages, locale, token, signal }) {
  return apiRequest('/api/ai/chat', {
    method: 'POST',
    body: { messages, locale },
    token,
    signal
  });
}

export function generateRoadmap({ goal, level, language, token, signal }) {
  return apiRequest('/api/ai/roadmap', {
    method: 'POST',
    body: { goal, level, language },
    token,
    signal
  });
}

export function getAiSettingsStatus(token) {
  return apiRequest('/api/admin/settings/ai/status', { token });
}

export function saveAiSettings({ apiKey, model }, token) {
  return apiRequest('/api/admin/settings/ai', {
    method: 'POST',
    body: { apiKey, model },
    token
  });
}

export function testAiKey({ apiKey, model }, token) {
  return apiRequest('/api/admin/settings/ai/test', {
    method: 'POST',
    body: { apiKey, model },
    token
  });
}

export function getApiHealth() {
  return apiRequest('/api/health');
}

/** GET /api/admin/me — confirms the admin claim server-side. */
export function getAdminMe(token, signal) {
  return apiRequest('/api/admin/me', { token, signal });
}
