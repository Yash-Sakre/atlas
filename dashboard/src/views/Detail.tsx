import type { Asset, Description, Param } from '../types';
import { SourceBadge, Tag, TypeBadge } from '../ui';

function ParamsTable({ rows, kind }: { rows?: Param[]; kind: string }) {
  if (!rows || !rows.length) return <p className="atlas-muted" style={{ fontSize: 14 }}>No {kind}.</p>;
  return (
    <div style={{ overflowX: 'auto' }}>
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
              <td className="mono" style={{ color: '#7fc4ff' }}>{p.name}</td>
              <td className="mono" style={{ color: '#7be3a8', wordBreak: 'break-all' }}>{p.type}</td>
              <td>
                {p.optional ? (
                  <span className="atlas-faint">opt</span>
                ) : (
                  <span style={{ color: '#ff9bb0' }}>req</span>
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

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <div style={{ marginTop: 20 }}>
      <h4 className="atlas-subhead">{title}</h4>
      <ul style={{ listStyle: 'disc', paddingLeft: 18, margin: 0, fontSize: 14 }}>
        {items.map((i, k) => (
          <li key={k} style={{ color: 'var(--ink-muted)', margin: '2px 0' }}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function DescriptionBlock({ d }: { d?: Description }) {
  if (!d) return <p className="atlas-muted" style={{ fontSize: 14 }}>No description available.</p>;
  return (
    <>
      <div style={{ marginBottom: 10 }}>
        <SourceBadge source={d.source} />
      </div>
      {d.purpose && <p style={{ color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>{d.purpose}</p>}
      {d.inputs && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          <span className="atlas-faint">Inputs:</span> <span className="atlas-muted">{d.inputs}</span>
        </p>
      )}
      {d.outputs && (
        <p style={{ fontSize: 14 }}>
          <span className="atlas-faint">Outputs:</span> <span className="atlas-muted">{d.outputs}</span>
        </p>
      )}
      {d.whenToUse && (
        <p style={{ marginTop: 12, fontSize: 14 }}>
          <span style={{ color: 'var(--success)' }}>When to use:</span>{' '}
          <span className="atlas-muted">{d.whenToUse}</span>
        </p>
      )}
      {d.whenNotToUse && (
        <p style={{ fontSize: 14 }}>
          <span style={{ color: '#ff9bb0' }}>When not to use:</span>{' '}
          <span className="atlas-muted">{d.whenNotToUse}</span>
        </p>
      )}
      <ListBlock title="Responsibilities" items={d.responsibilities} />
      <ListBlock title="Improvements" items={d.improvements} />
      {d.examples?.map((ex, i) => (
        <div key={i} style={{ marginTop: 20 }}>
          <h4 className="atlas-subhead">Example</h4>
          <pre className="atlas-code">{ex}</pre>
        </div>
      ))}
    </>
  );
}

export default function Detail({ asset }: { asset: Asset }) {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TypeBadge type={asset.type} />
        <span className="atlas-faint mono" style={{ fontSize: 12 }}>{asset.path}</span>
      </div>
      <h2 className="atlas-display mono" style={{ fontSize: 30, letterSpacing: '-0.03em' }}>
        {asset.name}
      </h2>

      {asset.signature && (
        <pre className="atlas-code" style={{ marginTop: 14, color: '#9cd0ff' }}>{asset.signature}</pre>
      )}

      <p className="atlas-muted" style={{ marginTop: 14, fontSize: 14 }}>
        Used in <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{asset.usageCount || 0}</span>{' '}
        place(s).
      </p>

      {asset.tags && asset.tags.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {asset.tags.map((t, i) => (
            <Tag key={i}>{t}</Tag>
          ))}
        </div>
      )}

      {asset.props ? (
        <>
          <h3 className="atlas-section-title" style={{ fontSize: 16, margin: '24px 0 10px' }}>Props</h3>
          <ParamsTable rows={asset.props} kind="props" />
        </>
      ) : asset.params ? (
        <>
          <h3 className="atlas-section-title" style={{ fontSize: 16, margin: '24px 0 10px' }}>Parameters</h3>
          <ParamsTable rows={asset.params} kind="parameters" />
          {asset.returnType && (
            <p style={{ marginTop: 10, fontSize: 14 }}>
              <span className="atlas-faint">Returns:</span>{' '}
              <span className="mono" style={{ color: '#7be3a8' }}>{asset.returnType}</span>
            </p>
          )}
        </>
      ) : null}

      <ListBlock title="State shape" items={asset.stateShape} />

      {asset.routePath && (
        <div style={{ marginTop: 16, fontSize: 14 }}>
          <span className="atlas-faint">Route:</span>{' '}
          <span className="mono" style={{ color: '#e6a3ff' }}>{asset.routePath}</span>
          {asset.componentName && (
            <>
              {' '}
              <span className="atlas-faint">→</span>{' '}
              <span className="mono" style={{ color: '#7fc4ff' }}>{asset.componentName}</span>
            </>
          )}
        </div>
      )}

      <h3 className="atlas-section-title" style={{ fontSize: 16, margin: '26px 0 10px' }}>Description</h3>
      <div className="atlas-card" style={{ padding: 18, borderRadius: 'var(--r-lg)' }}>
        <DescriptionBlock d={asset.description} />
      </div>

      <ListBlock title="Dependencies" items={asset.dependencies} />
      {asset.usedIn && asset.usedIn.length > 0 && (
        <ListBlock
          title="Usage references"
          items={asset.usedIn.slice(0, 40).map((u) => `${u.filePath}:${u.line} (${u.kind})`)}
        />
      )}
    </div>
  );
}
