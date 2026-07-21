import { Link } from 'react-router-dom';
import CommandBox from '../../components/CommandBox';
import { GLOBAL_OPTIONS } from '../../data/commands';
import { DefTable, H2, PageHeader, P } from '../ui';

export default function GlobalOptions() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Global options"
        lead="Flags accepted by the root command and every subcommand, plus the two options nearly every analysis command shares."
      />

      <H2 id="global">Global flags</H2>
      <DefTable rows={GLOBAL_OPTIONS.map((o) => ({ term: o.flag, accent: true, desc: o.desc }))} />

      <H2 id="common">Common analysis options</H2>
      <P>Most analysis commands accept these two on top of their own flags.</P>
      <DefTable
        rows={[
          {
            term: '-r, --root <dir>',
            accent: true,
            desc: (
              <>
                Project root to analyze. May also be passed positionally, so{' '}
                <code>atlas serve ./apps/web</code> and <code>atlas serve --root ./apps/web</code> are
                equivalent.
                <span className="def-default">
                  {' '}
                  Default: <code>cwd</code>
                </span>
              </>
            ),
          },
          {
            term: '-o, --out-dir <dir>',
            accent: true,
            desc: (
              <>
                Directory for analysis output and the cache, relative to the root.
                <span className="def-default">
                  {' '}
                  Default: <code>.atlas</code>
                </span>
              </>
            ),
          },
        ]}
      />

      <H2 id="help">Getting help in the terminal</H2>
      <P>
        Every subcommand documents itself. If you'd rather stay in the shell than in these pages, the CLI
        will tell you the same thing.
      </P>
      <div className="cmd-stack">
        <CommandBox command="atlas --help" />
        <CommandBox command="atlas serve --help" />
      </div>
      <P>
        Prefer a written reference? Head back to the{' '}
        <Link to="/docs/cli/serve">command pages</Link>, or set defaults once in{' '}
        <Link to="/docs/configuration">a config file</Link>.
      </P>
    </>
  );
}
