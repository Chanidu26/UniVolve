import { Link } from 'react-router-dom';

export default function Welcome() {
  return (
    <div className="hero">
      <span className="logo-pill">🎓 UniVolve</span>
      <h1>Admin Portal</h1>
      <p>Manage campus events, define volunteer roles, and review applications for the Faculty of Engineering.</p>
      <div className="hero-actions">
        <Link to="/login"><button>Login</button></Link>
      </div>
    </div>
  );
}
