import Link from 'next/link';
import GitHubButton from './GitHubButton';
import AtlasMark from './AtlasMark';
import NavLinks from './NavLinks';
import ThemeToggle from './ThemeToggle';
import { LINE, MUTED } from './ui';
import { version } from '../../../../packages/cli/package.json';

/** A floating glass capsule, detached from the top edge. */
export default function Nav() {
  return (
    <nav className="pointer-events-none sticky top-0 z-50 px-4 pt-3">
      <div
        className={`scroll-lift pointer-events-auto relative mx-auto grid h-13 max-w-5xl grid-cols-[1fr_auto] items-center rounded-full border ${LINE} bg-white/70 pr-2 pl-4 backdrop-blur-xl backdrop-saturate-180 lg:grid-cols-[1fr_auto_1fr] dark:bg-stone-950/70`}
      >
        {/* hairline gradient sheen along the top edge */}
        <span
          aria-hidden
          className="absolute inset-x-[18%] -top-px h-px bg-linear-to-r from-transparent via-blue-500/60 to-transparent"
        />
        <Link className="group inline-flex items-center gap-2 justify-self-start" href="/" aria-label="Atlas home">
          <span className="inline-flex rounded-lg shadow-md shadow-black/30 transition-transform duration-400 group-hover:scale-106 group-hover:-rotate-8">
            <AtlasMark size={30} />
          </span>
          <span className="text-lg font-extrabold tracking-tighter">Atlas</span>
          <span className={`hidden rounded-full border ${LINE} px-1.5 py-px font-mono text-[10.5px] min-[400px]:inline ${MUTED}`}>
            v{version}
          </span>
        </Link>
        <NavLinks />
        <div className="flex items-center gap-1.5 justify-self-end">
          <ThemeToggle />
          <GitHubButton variant="compact" label="GitHub" />
        </div>
      </div>
    </nav>
  );
}
