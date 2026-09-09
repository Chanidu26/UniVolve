import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

// There is no WebSocket layer in this architecture (Container Apps + Static Web
// Apps, no persistent connection), so the bell polls. 60s is a deliberate
// compromise: fast enough that an approval feels live, slow enough that an idle
// tab is one cheap indexed query a minute.
const POLL_MS = 60000;

const ICONS = {
  APPLICATION_APPROVED: '✅',
  APPLICATION_REJECTED: '❌',
  HOURS_VERIFIED: '⏱️',
  CERTIFICATE_ISSUED: '🎓',
};

const timeAgo = (ts) => {
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString();
};

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const load = () =>
    api.get('/notifications')
      .then(r => { setItems(r.data.notifications); setUnread(r.data.unread_count); })
      .catch(() => {});   // a failed poll is not worth interrupting the user for

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Close on outside click, otherwise the panel sits over the page forever.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();   // refresh on open rather than making the user wait for the tick
  };

  const markRead = async (n) => {
    if (n.is_read) return;
    setItems(list => list.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    setUnread(u => Math.max(0, u - 1));
    try { await api.put(`/notifications/${n.id}/read`); } catch { load(); }
  };

  const markAllRead = async () => {
    setItems(list => list.map(x => ({ ...x, is_read: true })));
    setUnread(0);
    try { await api.put('/notifications/read-all'); } catch { load(); }
  };

  return (
    <div className="bell-wrap" ref={wrapRef}>
      <button className="bell-btn" onClick={toggle} title="Notifications"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        🔔
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="bell-panel">
          <div className="bell-head">
            <b>Notifications</b>
            {unread > 0 && (
              <button className="bell-link" onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="bell-empty">Nothing yet. Apply to an event and updates will land here.</div>
          ) : (
            <ul className="bell-list">
              {items.map(n => (
                <li key={n.id}
                  className={`bell-item${n.is_read ? '' : ' unread'}`}
                  onClick={() => markRead(n)}>
                  <span className="bell-icon">{ICONS[n.type] || '🔔'}</span>
                  <div className="bell-body">
                    <div className="bell-title">{n.title}</div>
                    <div className="bell-msg">{n.message}</div>
                    <div className="bell-time">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.is_read && <span className="bell-dot" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
