import { Link } from 'react-router-dom';
import { DASHBOARD_VIEWS } from '../../data/features';
import { Callout, H2, PageHeader, P } from '../ui';

export default function DashboardViews() {
  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="Views"
        lead="atlas serve opens a local React app over the analysis snapshot. Every view reads the same snapshot, so nothing is ever stale relative to anything else."
      />

      <H2 id="views">The eight views</H2>
      <div className="view-list">
        {DASHBOARD_VIEWS.map((v) => (
          <div className="view-row" key={v.id}>
            <span className="view-ico">{v.icon}</span>
            <div>
              <b>
                {v.name}
                {v.isNew && <span className="tag-new inline">New</span>}
              </b>
              <p>{v.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <H2 id="serving">Serving it</H2>
      <P>
        <Link to="/docs/cli/serve">
          <code>atlas serve</code>
        </Link>{' '}
        analyzes and opens the dashboard on port 4321, falling back to the next free port. Pass{' '}
        <code>--no-open</code> to skip the browser, or <code>--reanalyze</code> to ignore the cache.
      </P>
      <P>
        <Link to="/docs/cli/export">
          <code>atlas export</code>
        </Link>{' '}
        writes the same app as a static bundle — the dashboard plus a <code>data.json</code> snapshot — so
        you can host a read-only map of the codebase for the whole team.
      </P>

      <Callout kind="note" title="Static asset previews come from disk">
        The Static assets view renders each file from its real path: <code>serve</code> streams the original
        through the local server, so nothing is copied out of your project, inlined into the data payload or
        written to a temp folder. Only paths the scan actually discovered are readable, and each one must
        still resolve inside the project root. A hosted <Link to="/docs/cli/export">
          <code>export</code>
        </Link>{' '}
        has no filesystem behind it, so previews there fall back to typed placeholders.
      </Callout>

      <Callout kind="note" title="Live data, one exception">
        Everything is computed offline from your code. The only network call is optional: the Dependencies
        view asks the npm registry for package descriptions and latest versions so it can flag updates.
        Packages installed from <code>file:</code>, <code>workspace:</code>, git or a URL are labelled as
        such and never looked up.
      </Callout>
    </>
  );
}
