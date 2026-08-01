import { FiArrowRight } from 'react-icons/fi';
import type { Asset, Description, Param, UsageRef } from '../types';
import { useData } from '../data';
import { EditorLink, SourceBadge, Tag, TypeBadge } from '../ui';

function pluralize(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function ParamsTable({ rows, kind }: { rows?: Param[]; kind: string }) {
  if (!rows || !rows.length) return <p className="text-sm text-ink-muted">No {kind}.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13.5px] [&_td]:border-b [&_td]:border-hairline-soft [&_td]:py-2.25 [&_td]:pr-4 [&_td]:text-ink-muted [&_td:first-child]:text-ink [&_th]:border-b [&_th]:border-hairline-soft [&_th]:py-2 [&_th]:pr-4 [&_th]:text-left [&_th]:text-[12.5px] [&_th]:font-medium [&_th]:text-ink-muted [&_tr:last-child_td]:border-b-0">
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
              <td className="font-mono tracking-normal text-t-component">{p.name}</td>
              <td className="font-mono tracking-normal break-all text-t-utility">{p.type}</td>
              <td>
                {p.optional ? (
                  <span className="text-ink-faint">opt</span>
                ) : (
                  <span className="text-danger">req</span>
                )}
              </td>
              <td className="font-mono tracking-normal text-ink-muted">{p.defaultValue || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6.5">
      <h3 className="m-0 mb-3 font-display text-[13px] font-semibold tracking-[0.05em] text-ink-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <Section title={title}>
      <ul className="m-0 flex list-none flex-col gap-1.75 p-0 text-sm [&>li]:relative [&>li]:pl-4.5 [&>li]:leading-[1.5] [&>li]:text-ink-muted [&>li]:before:absolute [&>li]:before:top-2.25 [&>li]:before:left-0.75 [&>li]:before:h-1.25 [&>li]:before:w-1.25 [&>li]:before:rounded-full [&>li]:before:bg-ink-faint [&>li]:before:content-['']">
        {items.map((i, k) => (
          <li key={k}>{i}</li>
        ))}
      </ul>
    </Section>
  );
}

function Note({
  tone,
  label,
  children,
}: {
  tone: 'do' | 'dont';
  label: string;
  children: React.ReactNode;
}) {
  const isDo = tone === 'do';
  return (
    <div
      className={`rounded-md border-l-2 px-3.5 py-2.75 ${
        isDo
          ? 'border-l-success bg-[color-mix(in_srgb,var(--color-success)_6%,transparent)]'
          : 'border-l-danger bg-[color-mix(in_srgb,var(--color-danger)_6%,transparent)]'
      }`}
    >
      <span
        className={`mb-1 block text-[11px] font-semibold tracking-[0.04em] uppercase ${
          isDo ? 'text-success' : 'text-danger'
        }`}
      >
        {label}
      </span>
      <p className="m-0 text-[13.5px] leading-[1.5] text-ink-muted">{children}</p>
    </div>
  );
}

function DescriptionBlock({ d }: { d?: Description }) {
  if (!d) return <p className="text-sm text-ink-muted">No description available.</p>;
  const hasIO = d.inputs || d.outputs;
  const hasNotes = d.whenToUse || d.whenNotToUse;
  return (
    <>
      {d.purpose && <p className="m-0 text-[14.5px] leading-[1.6] text-ink">{d.purpose}</p>}

      {hasIO && (
        <dl className="mt-4.5 flex flex-col gap-3 border-t border-hairline-soft pt-4 text-[13.5px] [&>div]:grid [&>div]:grid-cols-[84px_minmax(0,1fr)] [&>div]:items-start [&>div]:gap-4 [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:leading-[1.5] [&_dd]:text-ink-muted [&_dd]:[overflow-wrap:anywhere] [&_dt]:pt-0.5 [&_dt]:text-[11px] [&_dt]:font-medium [&_dt]:tracking-[0.04em] [&_dt]:text-ink-faint [&_dt]:uppercase">
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
        <div className="mt-4.5 flex flex-col gap-2.5">
          {d.whenToUse && (
            <Note tone="do" label="When to use">
              {d.whenToUse}
            </Note>
          )}
          {d.whenNotToUse && (
            <Note tone="dont" label="When not to use">
              {d.whenNotToUse}
            </Note>
          )}
        </div>
      )}

      <ListBlock title="Responsibilities" items={d.responsibilities} />
      <ListBlock title="Improvements" items={d.improvements} />
      {d.examples?.map((ex, i) => (
        <div key={i} className="mt-6.5">
          <h4 className="m-0 mb-2.25 text-[11px] font-semibold tracking-[0.05em] text-ink-faint uppercase">
            Example
          </h4>
          <pre className="overflow-x-auto rounded-md bg-canvas px-3.5 py-3.25 font-mono text-[12.5px] leading-[1.55] tracking-normal wrap-break-word whitespace-pre-wrap text-ink-muted">
            {ex}
          </pre>
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
      <ul className="flex flex-col gap-px">
        {shown.map((u, i) => (
          <li
            key={i}
            className="flex min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 hover:bg-surface-2"
          >
            <EditorLink
              root={root}
              path={u.filePath}
              line={u.line}
              className="min-w-0 flex-1 text-[12.5px] text-ink-muted"
            >
              <span className="min-w-0 truncate font-mono tracking-normal">{u.filePath}</span>
              <span className="shrink-0 text-[12.5px] tabular-nums text-ink-faint">:{u.line}</span>
            </EditorLink>
            <span className="shrink-0 rounded-sm bg-surface-2 px-1.5 py-px font-mono text-[10.5px] tracking-normal text-ink-faint">
              {u.kind}
            </span>
          </li>
        ))}
      </ul>
      {refs.length > CAP && (
        <p className="mt-2 pl-2 text-xs text-ink-faint">+{refs.length - CAP} more…</p>
      )}
    </Section>
  );
}

export default function Detail({ asset }: { asset: Asset }) {
  const root = useData().meta.root;
  const usage = asset.usageCount || 0;
  return (
    <div className="px-[clamp(20px,3vw,34px)] py-7.5">
      <header className="border-b border-hairline-soft pb-5.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <TypeBadge type={asset.type} />
          <EditorLink
            root={root}
            path={asset.path}
            line={asset.location?.line}
            column={asset.location?.column}
            className="min-w-0 flex-1 text-xs"
          >
            <span className="min-w-0 truncate font-mono tracking-normal text-ink-faint">
              {asset.path}
            </span>
          </EditorLink>
        </div>

        <h2 className="mt-3 font-display text-[27px] leading-[1.08] font-semibold tracking-[-0.035em] wrap-break-word text-ink">
          {asset.name}
        </h2>

        <div className="mt-3.5 flex flex-wrap items-center gap-3">
          <span className="text-[13px] text-ink-muted">
            <b className="font-semibold tabular-nums text-ink">{usage}</b>{' '}
            {usage === 1 ? 'usage' : 'usages'}
          </span>
          {asset.description?.source && (
            <>
              <span className="h-[13px] w-px bg-hairline" />
              <SourceBadge source={asset.description.source} />
            </>
          )}
        </div>

        {asset.signature && (
          <pre className="mt-4 overflow-x-auto rounded-md bg-canvas px-3.5 py-3.25 font-mono text-[12.5px] leading-[1.55] tracking-normal wrap-break-word whitespace-pre-wrap text-[#9cd0ff]">
            {asset.signature}
          </pre>
        )}

        {asset.tags && asset.tags.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
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
            <p className="mt-3 text-sm">
              <span className="text-ink-faint">Returns</span>{' '}
              <span className="font-mono tracking-normal text-t-utility">{asset.returnType}</span>
            </p>
          )}
        </Section>
      ) : null}

      {asset.stateShape && asset.stateShape.length > 0 && (
        <ListBlock title="State shape" items={asset.stateShape} />
      )}

      {asset.routePath && (
        <Section title="Route">
          <div className="flex items-center gap-2 text-[13.5px]">
            <span className="font-mono tracking-normal text-t-route">{asset.routePath}</span>
            {asset.componentName && (
              <>
                <FiArrowRight size={13} className="text-ink-faint" aria-hidden="true" />
                <span className="font-mono tracking-normal text-t-component">
                  {asset.componentName}
                </span>
              </>
            )}
          </div>
        </Section>
      )}

      <Section title="Description">
        <div className="rounded-lg bg-surface-1 p-5 shadow-card">
          <DescriptionBlock d={asset.description} />
        </div>
      </Section>

      <ListBlock title="Dependencies" items={asset.dependencies} />
      {asset.usedIn && asset.usedIn.length > 0 && <UsageList root={root} refs={asset.usedIn} />}
    </div>
  );
}
