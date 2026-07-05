import { FiArrowRight } from 'react-icons/fi';
import type { Asset, Description, Param, UsageRef } from '../types';
import { useData } from '../data';
import { EditorLink, SourceBadge, Tag, TypeBadge } from '../ui';

function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function ParamsTable({ rows, kind }: { rows?: Param[]; kind: string }) {
  if (!rows || !rows.length) return <p className="atlas-muted atlas-detail-none">No {kind}.</p>;
  return (
    <div className="atlas-table-wrap">
      <table className="atlas-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Req</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td className="mono" style={{ color: 'var(--t-component)' }}>{p.name}</td>
              <td className="mono" style={{ color: 'var(--t-utility)', wordBreak: 'break-all' }}>{p.type}</td>
              <td>
                {p.optional ? (
                  <span className="atlas-faint">opt</span>
                ) : (
                  <span style={{ color: 'var(--danger)' }}>req</span>
                )}
              </td>
              <td className="mono atlas-muted">{p.defaultValue || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="atlas-detail-section">
      <h3 className="atlas-detail-section-title">{title}</h3>
      {children}
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <Section title={title}>
      <ul className="atlas-detail-list">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </Section>
  );
}

function Note({ tone, label, children }: { tone: 'do' | 'dont'; label: string; children: React.ReactNode }) {
  return (
    <div className={`atlas-note atlas-note--${tone}`}>
      <span className="atlas-note-label">{label}</span>
      <p className="atlas-note-body">{children}</p>
    </div>
  );
}

function DescriptionBlock({ d }: { d?: Description }) {
  if (!d) return <p className="atlas-muted atlas-detail-none">No description available.</p>;
  const hasIO = d.inputs || d.outputs;
  const hasNotes = d.whenToUse || d.whenNotToUse;
  return (
    <>
      {d.purpose && <p className="atlas-desc-lead">{d.purpose}</p>}

      {hasIO && (
        <dl className="atlas-desc-io">
          {d.inputs && (
            <div>
              <dt>Inputs</dt>
              <dd>{d.inputs}</dd>
            </div>
          )}
          {d.outputs && (
            <div>
              <dt>Outputs</dt>
              <dd>{d.outputs}</dd>
            </div>
          )}
        </dl>
      )}

      {hasNotes && (
        <div className="atlas-notes">
          {d.whenToUse && <Note tone="do" label="When to use">{d.whenToUse}</Note>}
          {d.whenNotToUse && <Note tone="dont" label="When not to use">{d.whenNotToUse}</Note>}
        </div>
      )}

      <ListBlock title="Responsibilities" items={d.responsibilities} />
      <ListBlock title="Improvements" items={d.improvements} />
      {d.examples?.map((ex, i) => (
        <div key={i} className="atlas-detail-section">
          <h4 className="atlas-subhead">Example</h4>
          <pre className="atlas-code">{ex}</pre>
        </div>
      ))}
    </>
  );
}

/** Usage references as clickable "open in editor" rows, capped for length. */
function UsageList({ root, refs }: { root?: string; refs: UsageRef[] }) {
  const CAP = 40;
  const shown = refs.slice(0, CAP);
  return (
    <Section title={`Usage references (${refs.length})`}>
      <ul className="atlas-usagelist">
        {shown.map((u, i) => (
          <li key={i} className="atlas-usagerow">
            <EditorLink root={root} path={u.filePath} line={u.line} className="atlas-usagerow-loc">
              <span className="mono atlas-trunc">{u.filePath}</span>
              <span className="atlas-usagerow-line tnum">:{u.line}</span>
            </EditorLink>
            <span className="atlas-usagerow-kind">{u.kind}</span>
          </li>
        ))}
      </ul>
      {refs.length > CAP && (
        <p className="atlas-faint atlas-usagelist-more">+{refs.length - CAP} more…</p>
      )}
    </Section>
  );
}

export default function Detail({ asset }: { asset: Asset }) {
  const root = useData().meta.root;
  const usage = asset.usageCount || 0;
  return (
    <div className="atlas-detail-body">
      <header className="atlas-detail-hero">
        <div className="atlas-detail-eyebrow">
          <TypeBadge type={asset.type} />
          <EditorLink
            root={root}
            path={asset.path}
            line={asset.location?.line}
            column={asset.location?.column}
            className="atlas-detail-path"
          >
            <span className="atlas-faint mono atlas-trunc">{asset.path}</span>
          </EditorLink>
        </div>

        <h2 className="atlas-detail-name mono">{asset.name}</h2>

        <div className="atlas-detail-metastrip">
          <span className="atlas-detail-metastat">
            <b className="tnum">{usage}</b> {usage === 1 ? 'usage' : 'usages'}
          </span>
          {asset.description?.source && (
            <>
              <span className="atlas-detail-metasep" />
              <SourceBadge source={asset.description.source} />
            </>
          )}
        </div>

        {asset.signature && (
          <pre className="atlas-code atlas-detail-signature">{asset.signature}</pre>
        )}

        {asset.tags && asset.tags.length > 0 && (
          <div className="atlas-detail-tags">
            {asset.tags.map((t, i) => (
              <Tag key={i}>{t}</Tag>
            ))}
          </div>
        )}
      </header>

      {asset.props ? (
        <Section title="Props">
          <ParamsTable rows={asset.props} kind="props" />
        </Section>
      ) : asset.params ? (
        <Section title="Parameters">
          <ParamsTable rows={asset.params} kind="parameters" />
          {asset.returnType && (
            <p className="atlas-detail-returns">
              <span className="atlas-faint">Returns</span>{' '}
              <span className="mono" style={{ color: 'var(--t-utility)' }}>{asset.returnType}</span>
            </p>
          )}
        </Section>
      ) : null}

      {asset.stateShape && asset.stateShape.length > 0 && (
        <ListBlock title="State shape" items={asset.stateShape} />
      )}

      {asset.routePath && (
        <Section title="Route">
          <div className="atlas-route-line">
            <span className="mono" style={{ color: 'var(--t-route)' }}>{asset.routePath}</span>
            {asset.componentName && (
              <>
                <FiArrowRight size={13} className="atlas-faint" aria-hidden="true" />
                <span className="mono" style={{ color: 'var(--t-component)' }}>{asset.componentName}</span>
              </>
            )}
          </div>
        </Section>
      )}

      <Section title="Description">
        <div className="atlas-desc">
          <DescriptionBlock d={asset.description} />
        </div>
      </Section>

      <ListBlock title="Dependencies" items={asset.dependencies} />
      {asset.usedIn && asset.usedIn.length > 0 && (
        <UsageList root={root} refs={asset.usedIn} />
      )}
    </div>
  );
}
