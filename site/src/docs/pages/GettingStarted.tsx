import { Link } from 'react-router-dom';
import CommandBox from '../../components/CommandBox';
import { INSTALL_CMD } from '../../data/site';
import { Callout, H2, PageHeader, P, Step } from '../ui';

export default function GettingStarted() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Quickstart"
        lead="Point Atlas at a frontend project and it maps every reusable asset, the dependency graph, your npm inventory and everything nothing uses any more — in one command, with nothing to configure."
      />

      <H2 id="run-it">Run it</H2>
      <P>
        Atlas needs Node 18 or newer and a React / Next.js / Vite / TypeScript project. There is nothing to
        install and nothing to sign up for — the whole analysis runs locally.
      </P>

      <div className="steps">
        <Step n={1} title="Scan and open the dashboard">
          <p>
            From your project root, run the one command that does everything: analyze, cache, serve, open.
          </p>
          <CommandBox command={INSTALL_CMD} />
        </Step>

        <Step n={2} title="Start with Overview">
          <p>
            The dashboard opens on <b>Overview</b>: asset counts, the framework and routers Atlas detected,
            and your most-reused assets. It's the fastest read on the shape of an unfamiliar codebase.
          </p>
        </Step>

        <Step n={3} title="Search before you build">
          <p>
            Hit the search field and type what you're about to write — <code>modal</code>, <code>debounce</code>,{' '}
            <code>formatCurrency</code>. Every component, hook, util, context, store and route is indexed by
            name, path and signature. From the terminal, the same index is one command away:
          </p>
          <CommandBox command="atlas search modal" />
        </Step>

        <Step n={4} title="Clean up what nothing uses">
          <p>
            <b>Dead code</b> lists exports nothing imports, files no one references, and likely duplicate
            implementations. It's the cheapest cleanup pass you'll run all quarter.
          </p>
          <CommandBox command="atlas dead-code" />
        </Step>

        <Step n={5} title="Share it with the team">
          <p>
            <code>atlas export</code> writes a self-contained static bundle — the dashboard plus a data
            snapshot — that you can host on GitHub Pages, Netlify, S3 or an internal box.
          </p>
          <CommandBox command="atlas export --out-dir ../atlas-site" />
        </Step>
      </div>

      <Callout kind="tip" title="Keep it fresh">
        Run <code>atlas watch</code> alongside your dev server and the analysis re-runs incrementally as you
        edit. The cache means later runs only touch files that actually changed.
      </Callout>

      <H2 id="what-you-get">What you get</H2>
      <P>
        Every run writes a plain-JSON snapshot to <code>.atlas/</code> — see the{' '}
        <Link to="/docs/outputs">output reference</Link>. Nothing is uploaded,
        no API keys are needed, and descriptions are generated offline from real AST facts. If you want
        richer prose, <Link to="/docs/cli/describe">hand the assets to a coding agent</Link> on purpose.
      </P>

      <H2 id="next">Where to go next</H2>
      <div className="next-grid">
        <Link className="next-card" to="/docs/cli/serve">
          <b>CLI reference</b>
          <span>Every command, flag and example.</span>
        </Link>
        <Link className="next-card" to="/docs/dashboard">
          <b>Dashboard views</b>
          <span>What each of the seven views is for.</span>
        </Link>
        <Link className="next-card" to="/docs/outputs">
          <b>Analysis outputs</b>
          <span>Every file written to .atlas/.</span>
        </Link>
        <Link className="next-card" to="/docs/configuration">
          <b>Configuration</b>
          <span>Only if the defaults don't fit.</span>
        </Link>
      </div>
    </>
  );
}
