import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('vms_token', data.token);
      onLogin(data.user); navigate('/');
    } catch (err) { setError(err.response?.data?.error || 'Login failed'); }
  };

  return (
    <div className="card" style={{ maxWidth: 400, margin: '48px auto' }}>
      <h2>Admin Login</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
