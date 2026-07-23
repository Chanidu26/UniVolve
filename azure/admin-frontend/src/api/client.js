import axios from 'axios';
import { msalInstance, loginRequest } from '../auth/msalConfig.js';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: BASE });

async function getToken() {
  const account = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({ ...loginRequest, account });
    return result.accessToken;
  } catch {
    await msalInstance.acquireTokenRedirect({ ...loginRequest, account });
    return null;
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Helper for photo upload (multipart)
export const uploadPhoto = async (file) => {
  const form = new FormData();
  form.append('photo', file);
  const token = await getToken();
  const res = await fetch(`${BASE}/auth/upload-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};

// Resolve uploaded photo URLs (backend is on :4000, not :3000/:3001)
export const photoUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'}${url}`;
};

export default api;
