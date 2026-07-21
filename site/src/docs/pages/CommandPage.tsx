import { Navigate, useParams } from 'react-router-dom';
import CommandBox from '../../components/CommandBox';
import { COMMANDS } from '../../data/commands';
import { DefTable, H2, PageHeader, P } from '../ui';

export default function CommandPage() {
  const { command } = useParams();
  const cmd = COMMANDS.find((c) => c.id === command);
  if (!cmd) return <Navigate to="/docs/cli/serve" replace />;

  return (
    <>
      <PageHeader eyebrow="CLI reference" title={cmd.name} signature={cmd.signature} lead={cmd.tagline} />

      <H2 id="overview">Overview</H2>
      <P>{cmd.description}</P>

      <H2 id="options">Options</H2>
      {cmd.options.length > 0 ? (
        <DefTable
          rows={cmd.options.map((o) => ({
            term: o.flag,
            accent: true,
            desc: (
              <>
                {o.desc}
                {o.default && (
                  <span className="def-default">
                    {' '}
                    Default: <code>{o.default}</code>
                  </span>
                )}
              </>
            ),
          }))}
        />
      ) : (
        <P>
          Takes the common <code>--root</code> and <code>--out-dir</code> options only.
        </P>
      )}

      <H2 id="examples">Examples</H2>
      <div className="examples">
        {cmd.examples.map((ex) => (
          <div className="example" key={ex.cmd}>
            <CommandBox command={ex.cmd} />
            {ex.note && <span className="example-note">{ex.note}</span>}
          </div>
        ))}
      </div>
    </>
  );
}
