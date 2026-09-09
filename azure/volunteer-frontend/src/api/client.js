import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Helper for photo upload (multipart)
export const uploadPhoto = async (file) => {
  const form = new FormData();
  form.append('photo', file);
  const token = localStorage.getItem('vms_token');
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
