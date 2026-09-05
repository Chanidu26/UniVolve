import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { photoUrl } from '../api/client.js';

const CATEGORIES = ['Community Service', 'Environmental', 'Health', 'Education', 'Other'];

const catClass = (cat) => {
  if (!cat) return '';
  return 'cat-' + cat.toLowerCase().replace(/\s+/g, '-');
};

export default function Events({ user }) {
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState('');

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState('date_asc');

  // Debounce search input (~300ms)
  const debounceRef = useRef(null);
  const handleSearch = useCallback((val) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(val), 300);
  }, []);

  // Load events with filters
  const load = useCallback(() => {
    const params = {};
    if (debouncedSearch) params.search = debouncedSearch;
    if (category) params.category = category;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (sort) params.sort = sort;
    api.get('/events', { params }).then(r => setEvents(r.data));
  }, [debouncedSearch, category, startDate, endDate, sort]);

  useEffect(() => { load(); }, [load]);

  const apply = async (roleId) => {
    try { await api.post('/applications', { event_role_id: roleId }); setMsg('Application submitted!'); }
    catch (e) { setMsg(e.response?.data?.error || 'Failed'); }
  };

  // Compute slots summary for an event
  const slotsSummary = (roles) => {
    let total = 0, filled = 0;
    roles.forEach(r => { total += r.total_slots; filled += r.filled_slots; });
    return { total, filled, remaining: total - filled };
  };

  return (
    <>
      <h2>Volunteering Events</h2>
      {msg && <p className="msg ok">{msg}</p>}

      {/* ── Filter Bar ── */}
      <div className="filter-bar">
        <input
          type="text"
          placeholder="🔍 Search events..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} title="Start date" />
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} title="End date" />
        <select value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date_asc">Nearest First</option>
          <option value="date_desc">Furthest First</option>
        </select>
      </div>

      {/* ── Category Chips ── */}
      <div className="chip-group">
        <span className={`chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>All</span>
        {CATEGORIES.map(c => (
          <span key={c} className={`chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</span>
        ))}
      </div>

      {/* ── Event Cards ── */}
      {events.length === 0 && <p style={{ color: '#888' }}>No events found.</p>}
      {events.map(e => {
        const slots = slotsSummary(e.roles);
        const pct = slots.total > 0 ? Math.round((slots.filled / slots.total) * 100) : 0;
        const bannerSrc = e.banner_image_url ? photoUrl(e.banner_image_url) : null;

        return (
          <div key={e.id} className="card">
            {bannerSrc && <img className="card-banner" src={bannerSrc} alt={`${e.title} banner`} />}
            <h3>
              {e.title} <small>({e.status})</small>
              {e.category && <span className={`badge category ${catClass(e.category)}`}>{e.category}</span>}
            </h3>
            <p>{e.description}</p>
            <p>📅 {new Date(e.event_date).toLocaleString()} — 📍 {e.location}</p>
            {e.organizer_name && <p>Organizer: {e.organizer_name}</p>}
            {user?.id === e.organizer_id && <Link to={`/manage/${e.id}`}><button>Manage Event</button></Link>}

            {/* ── Slots Progress Bar ── */}
            {slots.total > 0 && (
              <div className="slots-bar">
                <div className="slots-bar-label">{slots.remaining} of {slots.total} slots remaining</div>
                <div className="slots-bar-track">
                  <div className={`slots-bar-fill ${pct >= 100 ? 'full' : ''}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            <table>
              <thead><tr><th>Role</th><th>Slots</th><th></th></tr></thead>
              <tbody>
                {e.roles.map(r => (
                  <tr key={r.id}>
                    <td>{r.role_name}{r.description && <div><small>{r.description}</small></div>}</td>
                    <td>{r.filled_slots}/{r.total_slots}</td>
                    <td><button disabled={r.filled_slots >= r.total_slots} onClick={() => apply(r.id)}>
                      {r.filled_slots >= r.total_slots ? 'Full' : 'Apply'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
