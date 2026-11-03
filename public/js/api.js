/**
 * Unified API Client
 */

let inMemoryToken = null;

const API = {
  baseUrl: '/api',

  getToken() {
    try {
      return localStorage.getItem('agency_token') || inMemoryToken;
    } catch {
      return inMemoryToken;
    }
  },

  setToken(token) {
    inMemoryToken = token;
    try {
      if (token) localStorage.setItem('agency_token', token);
      else localStorage.removeItem('agency_token');
    } catch {}
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      },
      credentials: 'include'
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.message || `Request failed (${response.status})`;
        
        // Background session checks or silent requests must never pop up error toasts
        if (options.silent || endpoint.includes('/auth/me')) {
          throw new Error(errorMsg);
        }

        if (response.status === 401 && !endpoint.includes('/auth/login')) {
          this.setToken(null);
          Toast.error('Session expired. Please sign in again.');
          window.location.hash = '#login';
        } else if (response.status === 403) {
          Toast.error(errorMsg || 'Privacy boundary violation: Access forbidden.');
        } else {
          Toast.error(errorMsg);
        }
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body) {
    return this.request(endpoint, { method: 'POST', body });
  },

  put(endpoint, body) {
    return this.request(endpoint, { method: 'PUT', body });
  },

  patch(endpoint, body) {
    return this.request(endpoint, { method: 'PATCH', body });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
};

window.API = API;

