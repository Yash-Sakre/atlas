import { Link, NavLink } from 'react-router-dom';
import GitHubButton from './GitHubButton';

export default function Nav() {
  return (
    <nav>
      <div className="wrap">
        <Link className="brand" to="/">
          <span className="logo">🗺️</span> Atlas
        </Link>
        <div className="nav-links">
          <Link className="hide-sm" to={{ pathname: '/', hash: '#showcase' }}>Showcase</Link>
          <Link className="hide-sm" to={{ pathname: '/', hash: '#ai' }}>AI</Link>
          <NavLink className="hide-sm" to="/docs">Docs</NavLink>
          <GitHubButton label="★ GitHub" />
        </div>
      </div>
    </nav>
  );
}
