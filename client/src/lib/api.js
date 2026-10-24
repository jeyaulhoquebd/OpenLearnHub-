const rawApiUrl = import.meta.env.VITE_API_URL || '';
export const API_BASE_URL = rawApiUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code = 'api_error', extras = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = extras.details;
    this.retryAfter = extras.retryAfter;
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
      signal,
      // Admin status, model lists and usage counters must never be served from
      // the browser's HTTP cache.
      cache: 'no-store'
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
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ApiError(
      payload?.error?.message || payload?.message || 'Something went wrong. Please try again.',
      response.status,
      payload?.error?.code || 'request_failed',
      {
        details: payload?.error?.details,
        retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined
      }
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

export function saveAiSettings({ apiKey, model, enabled, dailyLimitPerUser }, token) {
  return apiRequest('/api/admin/settings/ai', {
    method: 'POST',
    body: { apiKey, model, enabled, dailyLimitPerUser },
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

export function getAiModels(token, { signal } = {}) {
  return apiRequest('/api/admin/settings/ai/models', { token, signal });
}

export function deleteAiKey(token) {
  return apiRequest('/api/admin/settings/ai/key', { method: 'DELETE', token });
}

export function getAiUsage(token, { signal } = {}) {
  return apiRequest('/api/admin/settings/ai/usage', { token, signal });
}

export function getApiHealth() {
  return apiRequest('/api/health');
}

/** GET /api/admin/me — confirms the admin claim server-side. */
export function getAdminMe(token, signal) {
  return apiRequest('/api/admin/me', { token, signal });
}

/**
 * GET /api/admin/stats — aggregated dashboard numbers.
 * `refresh` bypasses the server's 60-second cache.
 */
export function getAdminStats(token, { refresh = false, signal } = {}) {
  const query = refresh ? '?refresh=1' : '';
  return apiRequest(`/api/admin/stats${query}`, { token, signal });
}

function toQueryString(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** GET /api/admin/resources — filtered, sorted, cursor-paginated list. */
export function listAdminResources(token, { signal, ...params } = {}) {
  return apiRequest(`/api/admin/resources${toQueryString(params)}`, { token, signal });
}

/** POST /api/admin/resources */
export function createAdminResource(payload, token) {
  return apiRequest('/api/admin/resources', { method: 'POST', body: payload, token });
}

/** PUT /api/admin/resources/:id */
export function updateAdminResource(id, payload, token) {
  return apiRequest(`/api/admin/resources/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
    token
  });
}

/** DELETE /api/admin/resources/:id */
export function deleteAdminResource(id, token) {
  return apiRequest(`/api/admin/resources/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token
  });
}

/** POST /api/admin/resources/bulk — publish | draft | flag | delete (max 100 ids). */
export function bulkAdminResources({ ids, action }, token) {
  return apiRequest('/api/admin/resources/bulk', {
    method: 'POST',
    body: { ids, action },
    token
  });
}

/** POST /api/admin/resources/test-link — SSRF-safe reachability check. */
export function testResourceLink(url, token) {
  return apiRequest('/api/admin/resources/test-link', {
    method: 'POST',
    body: { url },
    token
  });
}

/**
 * POST /api/admin/resources/youtube/preview
 * Loads a public playlist and every video in it through the server-side
 * YouTube API key. Video metadata is saved only when the resource is saved.
 */
export function previewYouTubePlaylist(url, token) {
  return apiRequest('/api/admin/resources/youtube/preview', {
    method: 'POST',
    body: { url },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — categories
// ---------------------------------------------------------------------------

/** GET /api/admin/categories — every category with its resource count. */
export function listAdminCategories(token, { signal } = {}) {
  return apiRequest('/api/admin/categories', { token, signal });
}

/** POST /api/admin/categories */
export function createAdminCategory(payload, token) {
  return apiRequest('/api/admin/categories', { method: 'POST', body: payload, token });
}

/** PUT /api/admin/categories/:id */
export function updateAdminCategory(id, payload, token) {
  return apiRequest(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
    token
  });
}

/** DELETE /api/admin/categories/:id — 409 when resources still use it. */
export function deleteAdminCategory(id, token) {
  return apiRequest(`/api/admin/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token
  });
}

/** POST /api/admin/categories/:id/move-resources { targetCategoryId } */
export function moveCategoryResources(id, targetCategoryId, token) {
  return apiRequest(`/api/admin/categories/${encodeURIComponent(id)}/move-resources`, {
    method: 'POST',
    body: { targetCategoryId },
    token
  });
}

/** POST /api/admin/categories/reorder { ids } */
export function reorderAdminCategories(ids, token) {
  return apiRequest('/api/admin/categories/reorder', {
    method: 'POST',
    body: { ids },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — free alternatives (paid → free software pairs)
// ---------------------------------------------------------------------------

/** GET /api/admin/alternatives — includes inactive rows and linked resources. */
export function listAdminAlternatives(token, { signal } = {}) {
  return apiRequest('/api/admin/alternatives', { token, signal });
}

/** POST /api/admin/alternatives */
export function createAdminAlternative(payload, token) {
  return apiRequest('/api/admin/alternatives', { method: 'POST', body: payload, token });
}

/** PUT /api/admin/alternatives/:id */
export function updateAdminAlternative(id, payload, token) {
  return apiRequest(`/api/admin/alternatives/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
    token
  });
}

/** DELETE /api/admin/alternatives/:id */
export function deleteAdminAlternative(id, token) {
  return apiRequest(`/api/admin/alternatives/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token
  });
}

/** POST /api/admin/alternatives/:id/active { active } */
export function setAdminAlternativeActive(id, active, token) {
  return apiRequest(`/api/admin/alternatives/${encodeURIComponent(id)}/active`, {
    method: 'POST',
    body: { active },
    token
  });
}

/** POST /api/admin/alternatives/reorder { ids } */
export function reorderAdminAlternatives(ids, token) {
  return apiRequest('/api/admin/alternatives/reorder', {
    method: 'POST',
    body: { ids },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — users
// ---------------------------------------------------------------------------

/** GET /api/admin/users — Auth users merged with Firestore profiles. */
export function listAdminUsers(token, { signal, ...params } = {}) {
  return apiRequest(`/api/admin/users${toQueryString(params)}`, { token, signal });
}

/** GET /api/admin/users/:uid — profile + activity counts. */
export function getAdminUser(uid, token, { signal } = {}) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}`, { token, signal });
}

/** POST /api/admin/users/:uid/disable */
export function disableAdminUser(uid, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}/disable`, {
    method: 'POST',
    token
  });
}

/** POST /api/admin/users/:uid/enable */
export function enableAdminUser(uid, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}/enable`, {
    method: 'POST',
    token
  });
}

/** POST /api/admin/users/:uid/make-admin */
export function makeAdminUser(uid, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}/make-admin`, {
    method: 'POST',
    token
  });
}

/** POST /api/admin/users/:uid/remove-admin */
export function removeAdminUser(uid, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}/remove-admin`, {
    method: 'POST',
    token
  });
}

/** POST /api/admin/users/:uid/revoke-sessions */
export function revokeAdminUserSessions(uid, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}/revoke-sessions`, {
    method: 'POST',
    token
  });
}

/** DELETE /api/admin/users/:uid — requires the account email as confirmation. */
export function deleteAdminUser(uid, confirmEmail, token) {
  return apiRequest(`/api/admin/users/${encodeURIComponent(uid)}`, {
    method: 'DELETE',
    body: { confirmEmail },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — reviews
// ---------------------------------------------------------------------------

/** GET /api/admin/reviews — filters q, resourceId, rating; cursor pagination. */
export function listAdminReviews(token, { signal, ...params } = {}) {
  return apiRequest(`/api/admin/reviews${toQueryString(params)}`, { token, signal });
}

/** POST /api/admin/reviews/:id/hide */
export function hideAdminReview(id, token) {
  return apiRequest(`/api/admin/reviews/${encodeURIComponent(id)}/hide`, {
    method: 'POST',
    token
  });
}

/** POST /api/admin/reviews/:id/show */
export function showAdminReview(id, token) {
  return apiRequest(`/api/admin/reviews/${encodeURIComponent(id)}/show`, {
    method: 'POST',
    token
  });
}

/** DELETE /api/admin/reviews/:id */
export function deleteAdminReview(id, token) {
  return apiRequest(`/api/admin/reviews/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    token
  });
}

/** POST /api/admin/reviews/bulk { ids, action } — max 100 ids. */
export function bulkAdminReviews(ids, action, token) {
  return apiRequest('/api/admin/reviews/bulk', {
    method: 'POST',
    body: { ids, action },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — reports queue
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/reports — status/reason/resource filters plus free text.
 * Illegal (copyright/piracy) reports are returned first.
 */
export function listAdminReports(token, { signal, ...params } = {}) {
  return apiRequest(`/api/admin/reports${toQueryString(params)}`, { token, signal });
}

/** PATCH /api/admin/reports/:id { status?, adminNote? } */
export function updateAdminReport(id, payload, token) {
  return apiRequest(`/api/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: payload,
    token
  });
}

/** POST /api/admin/reports/:id/unpublish-resource */
export function unpublishReportedResource(id, token) {
  return apiRequest(`/api/admin/reports/${encodeURIComponent(id)}/unpublish-resource`, {
    method: 'POST',
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — link checker
// ---------------------------------------------------------------------------

/** GET /api/admin/check-links/results — saved results + running job summary. */
export function getAdminLinkCheckResults(token, { signal } = {}) {
  return apiRequest('/api/admin/check-links/results', { token, signal });
}

/** POST /api/admin/check-links { ids? } — starts a background job. */
export function startAdminLinkCheck(ids, token) {
  return apiRequest('/api/admin/check-links', {
    method: 'POST',
    body: ids?.length ? { ids } : {},
    token
  });
}

/** GET /api/admin/check-links/:jobId — live job progress. */
export function getAdminLinkCheckJob(jobId, token, { signal } = {}) {
  return apiRequest(`/api/admin/check-links/${encodeURIComponent(jobId)}`, { token, signal });
}

/** POST /api/admin/check-links/recheck { id } */
export function recheckAdminResourceLink(id, token) {
  return apiRequest('/api/admin/check-links/recheck', {
    method: 'POST',
    body: { id },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — import / export
// ---------------------------------------------------------------------------

/** GET /api/admin/import-export/export/:kind — returns a Blob + filename. */
export async function downloadAdminExport(kind, format, token) {
  return apiDownload(
    `/api/admin/import-export/export/${encodeURIComponent(kind)}?format=${encodeURIComponent(format)}`,
    token,
    `openlearn-${kind}.${format}`
  );
}

/** GET /api/admin/import-export/template?format=json|csv */
export async function downloadAdminImportTemplate(format, token) {
  return apiDownload(
    `/api/admin/import-export/template?format=${encodeURIComponent(format)}`,
    token,
    `openlearn-resources-template.${format}`
  );
}

/** POST /api/admin/import/duplicates { sourceUrls } — max 400 per request. */
export function checkAdminImportDuplicates(sourceUrls, token) {
  return apiRequest('/api/admin/import/duplicates', {
    method: 'POST',
    body: { sourceUrls },
    token
  });
}

/**
 * POST /api/admin/import { mode, rows } — max 400 rows per request.
 * `rows` is `[{ index, resource }]`; the server re-validates every resource.
 */
export function importAdminResources({ rows, mode }, token) {
  return apiRequest('/api/admin/import', {
    method: 'POST',
    body: { rows, mode },
    token
  });
}

// ---------------------------------------------------------------------------
// Admin — audit log
// ---------------------------------------------------------------------------

/** GET /api/admin/audit-logs — filters + opaque cursor pagination. */
export function listAdminAuditLogs(token, { signal, ...params } = {}) {
  return apiRequest(`/api/admin/audit-logs${toQueryString(params)}`, { token, signal });
}

// ---------------------------------------------------------------------------
// Admin — site settings
// ---------------------------------------------------------------------------

/** GET /api/admin/settings/site */
export function getAdminSiteSettings(token, { signal } = {}) {
  return apiRequest('/api/admin/settings/site', { token, signal });
}

/** POST /api/admin/settings/site */
export function saveAdminSiteSettings(payload, token) {
  return apiRequest('/api/admin/settings/site', {
    method: 'POST',
    body: payload,
    token
  });
}

/**
 * Authenticated binary download used by the import/export screen. CORS may not
 * expose Content-Disposition, so `fallbackName` keeps the file named sensibly.
 */
async function apiDownload(path, token, fallbackName) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: '*/*', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    });
  } catch {
    throw new ApiError('The download could not be reached. Please try again.', 0, 'network_error');
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(
      payload?.error?.message || 'The download could not be created.',
      response.status,
      payload?.error?.code || 'download_failed'
    );
  }

  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const blob = await response.blob();
  return { blob, filename: match?.[1] || fallbackName };
}
