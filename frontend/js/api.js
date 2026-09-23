/**
 * Thin REST client.
 *
 * Unwraps the `{ success, data }` envelope and turns any failure into an
 * ApiError that carries the backend's status, code and per-field details, so
 * forms can show validation messages next to the offending input.
 */

const BASE_URL = (window.APP_CONFIG?.apiBaseUrl ?? '/api').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }

  /** `{ fieldName: 'message' }` for quick lookup while rendering a form. */
  get fieldErrors() {
    const map = {};
    for (const detail of this.details) {
      if (detail?.field && !map[detail.field]) map[detail.field] = detail.message;
    }
    return map;
  }
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function request(path, { method = 'GET', body, params } = {}) {
  const url = `${BASE_URL}${path}${buildQuery(params)}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError('Cannot reach the API. Is the backend running?', {
      status: 0,
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    const error = payload?.error ?? {};
    throw new ApiError(error.message ?? `Request failed with status ${response.status}`, {
      status: response.status,
      code: error.code ?? 'UNKNOWN_ERROR',
      details: error.details,
    });
  }

  return payload.data;
}

export const api = {
  health: () => request('/health'),

  itemTypes: {
    list: () => request('/item-types'),
    get: (id) => request(`/item-types/${id}`),
    create: (body) => request('/item-types', { method: 'POST', body }),
    update: (id, body) => request(`/item-types/${id}`, { method: 'PUT', body }),
    remove: (id) => request(`/item-types/${id}`, { method: 'DELETE' }),
  },

  items: {
    list: (params) => request('/items', { params }),
    get: (id) => request(`/items/${id}`),
    create: (body) => request('/items', { method: 'POST', body }),
    update: (id, body) => request(`/items/${id}`, { method: 'PUT', body }),
    setStatus: (id, active) => request(`/items/${id}/status`, { method: 'PATCH', body: { active } }),
    remove: (id) => request(`/items/${id}`, { method: 'DELETE' }),
  },

  purchases: {
    list: (params) => request('/purchases', { params }),
    get: (id) => request(`/purchases/${id}`),
    nextOrderId: () => request('/purchases/next-order-id'),
    create: (body) => request('/purchases', { method: 'POST', body }),
    update: (id, body) => request(`/purchases/${id}`, { method: 'PUT', body }),
    // No remove(): purchases cannot be deleted (assignment section 8).
  },

  stock: {
    overview: (params) => request('/stock', { params }),
  },
};
