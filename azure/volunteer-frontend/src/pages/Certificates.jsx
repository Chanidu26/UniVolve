import { useEffect, useState } from 'react';
import api from '../api/client.js';

// Thresholds are on VERIFIED hours only — the same number the profile page shows,
// so a volunteer can always see why they are one tier below where they expected.
const TIERS = [
  { name: 'Bronze', hours: 10, icon: '🥉', cls: 'bronze' },
  { name: 'Silver', hours: 25, icon: '🥈', cls: 'silver' },
  { name: 'Gold',   hours: 50, icon: '🥇', cls: 'gold' },
];

const fmtHours = (h) => Number(h || 0).toFixed(2);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined,
  { year: 'numeric', month: 'long', day: 'numeric' }) : '');

export default function Certificates() {
  const [certs, setCerts] = useState(null);
  const [hours, setHours] = useState(null);
  const [printId, setPrintId] = useState(null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // /certificates/mine issues any newly-earned certificate as a side effect,
    // so simply opening this page is what awards them.
    api.get('/certificates/mine').then(r => setCerts(r.data)).catch(() => setCerts([]));
    api.get('/users/me/hours').then(r => setHours(r.data)).catch(() => setHours(null));
  }, []);

  // The print stylesheet keys off .cert-print, so mark the card first, let React
  // paint, then open the dialog.
  useEffect(() => {
    if (!printId) return;
    const t = setTimeout(() => { window.print(); setPrintId(null); }, 50);
    return () => clearTimeout(t);
  }, [printId]);

  // Deliberately a bare fetch with no Authorization header: this is the public
  // verification endpoint, and sending a token here would hide the fact that it
  // works for someone who has never logged in.
  const verify = async (e) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await fetch(`${api.defaults.baseURL}/certificates/verify/${encodeURIComponent(c)}`);
      setResult(await res.json());
    } catch {
      setResult({ valid: false, error: true });
    } finally { setChecking(false); }
  };

  const total = Number(hours?.total_hours || 0);
  const nextTier = TIERS.find(t => total < t.hours);

  if (certs === null) return <div style={{ padding: 32 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 16 }}>Certificates & Badges</h2>

      {/* ── Badges ── */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>My Badges</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Earned on verified volunteering hours — you have {fmtHours(total)}.
        </p>
        <div className="badge-tiers">
          {TIERS.map(t => {
            const earned = total >= t.hours;
            return (
              <div key={t.name} className={`tier ${t.cls}${earned ? ' earned' : ''}`}>
                <div className="tier-icon">{t.icon}</div>
                <div className="tier-name">{t.name}</div>
                <div className="tier-req">{t.hours} hrs</div>
                <div className="tier-state">{earned ? 'Earned' : 'Locked'}</div>
              </div>
            );
          })}
        </div>
        {nextTier && (
          <p className="muted" style={{ marginTop: 12 }}>
            {fmtHours(nextTier.hours - total)} more verified hours to reach {nextTier.name}.
          </p>
        )}
      </div>

      {/* ── Certificates ── */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>My Certificates</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Issued automatically once an event closes and your hours are verified.
        </p>

        {certs.length === 0 ? (
          <p className="muted">
            No certificates yet. Once an event you attended is closed and an organizer has
            verified your hours, your certificate appears here.
          </p>
        ) : certs.map(c => (
          <div key={c.id} className={`cert-card${printId === c.id ? ' cert-print' : ''}`}>
            <div className="cert-ribbon">Certificate of Volunteering</div>
            <div className="cert-body">
              <p className="cert-lead">This certifies that</p>
              <h3 className="cert-name">{c.volunteer_name}</h3>
              <p className="cert-lead">contributed</p>
              <div className="cert-hours">{fmtHours(c.total_hours)} hours</div>
              <p className="cert-lead">of volunteering service at</p>
              <h4 className="cert-event">{c.event_title}</h4>
              <p className="cert-meta">
                {fmtDate(c.event_date)}{c.location ? ` · ${c.location}` : ''}
              </p>
            </div>
            <div className="cert-foot">
              <div>
                <div className="cert-code-lbl">Verification code</div>
                <code className="cert-code">{c.certificate_code}</code>
                <div className="cert-code-lbl" style={{ marginTop: 4 }}>
                  Issued {fmtDate(c.issued_at)}
                </div>
              </div>
              <button className="ghost cert-print-btn" onClick={() => setPrintId(c.id)}>
                🖨️ Print
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Public verification ── */}
      <div className="card">
        <h3 style={{ marginBottom: 4 }}>Verify a Certificate</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Anyone — an employer, another university — can check a code here without an account.
        </p>
        <form onSubmit={verify} style={{ display: 'flex', gap: 8 }}>
          <input placeholder="UV-XXXXXXXXXXXXXXXX" value={code}
            onChange={e => setCode(e.target.value)} style={{ margin: 0, flex: 1 }} />
          <button type="submit" disabled={checking} style={{ flexShrink: 0 }}>
            {checking ? 'Checking…' : 'Verify'}
          </button>
        </form>

        {result && (result.valid ? (
          <div className="msg ok" style={{ marginTop: 12 }}>
            ✅ Valid — <b>{result.volunteer_name}</b> completed {fmtHours(result.total_hours)} verified
            hours at <b>{result.event_title}</b>. Issued {fmtDate(result.issued_at)}.
          </div>
        ) : (
          <div className="msg err" style={{ marginTop: 12 }}>
            ❌ {result.error ? 'Could not reach the verification service.' : 'No certificate found for that code.'}
          </div>
        ))}
      </div>
    </div>
  );
}
