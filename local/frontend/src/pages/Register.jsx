import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

export default function Register({ onLogin }) {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [error, setError] = useState(''); const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/register', form);
      localStorage.setItem('vms_token', data.token);
      onLogin(data.user); navigate('/');
    } catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: '48px auto' }}>
      <h2>Register as Volunteer</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={submit}>
        <input placeholder="Full name" value={form.full_name} onChange={set('full_name')} />
        <input placeholder="Email" value={form.email} onChange={set('email')} />
        <input type="password" placeholder="Password" value={form.password} onChange={set('password')} />
        <button type="submit">Register</button>
      </form>
    </div>
  );
}
