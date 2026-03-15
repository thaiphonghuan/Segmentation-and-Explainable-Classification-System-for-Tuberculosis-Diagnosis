const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const AI_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || 'http://localhost:8000';

async function request(path, { method = 'GET', body, token, headers = {}, credentials = 'include' } = {}) {
  const options = {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    credentials
  };

  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, options);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.message || 'Yêu cầu thất bại';
    throw new Error(message);
  }

  return data;
}

async function requestForm(path, formData, { baseUrl = API_BASE_URL } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    body: formData
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message = data?.detail || data?.message || 'Yêu cầu thất bại';
    throw new Error(message);
  }

  return data;
}

export const authApi = {
  login({ cccd, password }) {
    return request('/api/auth/login', { method: 'POST', body: { cccd, password } });
  },

  register(payload) {
    return request('/api/auth/register', { method: 'POST', body: payload });
  },

  logout(refreshToken) {
    return request('/api/auth/logout', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : undefined
    });
  },

  refresh(refreshToken) {
    return request('/api/auth/refresh', {
      method: 'POST',
      body: refreshToken ? { refreshToken } : undefined
    });
  },

  me(token) {
    return request('/api/auth/me', { token });
  }
};

export const userApi = {
  getProfile(token) {
    return request('/api/users/profile', { token });
  },

  updateProfile(token, payload) {
    return request('/api/users/profile', { method: 'PUT', token, body: payload });
  }
};

export const aiApi = {
  async segmentImage(file) {
    const formData = new FormData();
    formData.append('file', file);

    return requestForm('/predict', formData, { baseUrl: AI_BASE_URL });
  }
};
