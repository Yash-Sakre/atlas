import { Link } from 'react-router-dom';
import CommandBox from '../../components/CommandBox';
import { INSTALL_CMD } from '../../data/site';
import { Callout, H2, PageHeader, P } from '../ui';

export default function Installation() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Installation"
        lead="Atlas is a single CLI published to npm as codebase-atlas. Run it on demand with npx, or install it globally if you use it every day."
      />

      <H2 id="npx">Run without installing</H2>
      <P>
        The fastest path — <code>npx</code> fetches the package, analyzes the current project and opens the
        dashboard.
      </P>
      <CommandBox command={INSTALL_CMD} />

      <H2 id="global">Install globally</H2>
      <P>
        Installing globally gives you the <code>atlas</code> binary directly, which is worth it once you're
        running it across several repos.
      </P>
      <div className="cmd-stack">
        <CommandBox command="npm i -g codebase-atlas" />
        <CommandBox command="atlas serve" />
      </div>

      <H2 id="project">Add it to a project</H2>
      <P>
        You can also keep it as a dev dependency so the whole team runs the same version — useful when you
        wire <code>atlas analyze</code> into CI.
      </P>
      <div className="cmd-stack">
        <CommandBox command="npm i -D codebase-atlas" />
        <CommandBox command="npx atlas analyze" />
      </div>

      <H2 id="requirements">Requirements</H2>
      <ul className="doc-bullets">
        <li>
          <b>Node 18 or newer.</b> Atlas relaunches itself with a larger V8 heap on big repos, so full
          type-aware scans don't run out of memory.
        </li>
        <li>
          <b>A TypeScript or JavaScript frontend.</b> React, Next.js (app or pages router), Vite, React
          Router and TanStack Router are all detected automatically.
        </li>
        <li>
          <b>Nothing else.</b> No config file, no API key, no network access — see{' '}
          <Link to="/docs/configuration">Configuration</Link> only if the defaults don't fit your layout.
        </li>
      </ul>

      <Callout kind="note" title="What it writes">
        Analysis output and the incremental cache go to <code>.atlas/</code> in the project root. Add that
        folder to <code>.gitignore</code> unless you deliberately want to diff snapshots in version control.
      </Callout>
    </>
  );
}
