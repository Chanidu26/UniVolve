import { photoUrl } from '../api/client.js';

export default function Avatar({ name = '', url, size = 40, onClick }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colours = ['#5c6bc0','#e53935','#00897b','#f4511e','#8e24aa','#1e88e5','#43a047'];
  const bg = colours[(name.charCodeAt(0) || 0) % colours.length];
  const style = { width: size, height: size, fontSize: size * 0.38, cursor: onClick ? 'pointer' : 'default' };
  const resolved = photoUrl(url);
  if (resolved) return (
    <img src={resolved} alt={name} onClick={onClick}
      style={{ ...style, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e8eaf0', flexShrink: 0 }} />
  );
  return (
    <div onClick={onClick} style={{ ...style, borderRadius: '50%', background: bg, color: '#fff',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}
