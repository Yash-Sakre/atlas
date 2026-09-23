import Link from 'next/link';
import GitHubButton from './GitHubButton';
import AtlasMark from './AtlasMark';

export default function Nav() {
  return (
    <nav>
      <div className="wrap">
        <Link className="brand" href="/">
          <span className="logo"><AtlasMark size={30} /></span> Atlas
        </Link>
        <div className="nav-links">
          <a className="hide-sm" href="#showcase">Showcase</a>
          <a className="hide-sm" href="#dashboard">Dashboard</a>
          <a className="hide-sm" href="#ai">AI</a>
          <Link className="hide-sm" href="/docs">Docs</Link>
          <GitHubButton label="★ GitHub" />
        </div>
      </div>
    </nav>
  );
}
