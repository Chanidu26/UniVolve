import { Link } from 'react-router-dom';

export default function Welcome() {
  return (
    <div className="hero">
      <span className="logo-pill">🎓 UniVolve</span>
      <h1>University Volunteering<br />&amp; Event Management</h1>
      <p>Faculty-wide volunteering platform. Discover campus events, apply for volunteer roles, and build a verifiable portfolio.</p>
      <div className="hero-actions">
        <Link to="/login"><button>Login</button></Link>
        <Link to="/register"><button className="secondary">Sign Up</button></Link>
      </div>
    </div>
  );
}
