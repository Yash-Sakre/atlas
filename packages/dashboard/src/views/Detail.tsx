import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowSquareOut,
  CheckCircle,
  Article,
  LinkBreak,
  XCircle,
} from "@phosphor-icons/react";
import type { Asset, Description, Param, UsageRef } from "../types";
import { useData } from "../data";
import { EditorLink, SourceBadge, TABLE_CLASS, Tag, TypeBadge } from "../ui";
import { editorHref } from "../lib/editor";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const USAGE_CAP = 40;

/* ─────────────────────────── building blocks ─────────────────────────── */

function Section({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-7 first:mt-0", className)}>
      <h3 className="m-0 mb-2.5 flex items-center gap-2 text-[12px] font-medium text-ink-faint">
        {title}
        {aside}
      </h3>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.75 p-0 text-[13.5px] [&>li]:relative [&>li]:pl-4.5 [&>li]:leading-[1.55] [&>li]:text-ink-muted [&>li]:before:absolute [&>li]:before:top-2.25 [&>li]:before:left-1 [&>li]:before:h-1.25 [&>li]:before:w-1.25 [&>li]:before:rounded-full [&>li]:before:bg-ink-faint [&>li]:before:content-['']">
      {items.map((item, k) => (
        <li key={k}>{item}</li>
      ))}
    </ul>
  );
}

function ListBlock({ title, items }: { title: string; items?: string[] }) {
  if (!items || !items.length) return null;
  return (
    <Section title={title}>
      <BulletList items={items} />
    </Section>
  );
}

function CodeBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "m-0 overflow-x-auto rounded-md bg-canvas px-3.5 py-3 font-mono text-[12.5px] leading-[1.55] wrap-break-word whitespace-pre-wrap text-ink-muted shadow-[inset_0_0_0_1px_var(--color-hairline-soft)]",
        className,
      )}
    >
      {children}
    </pre>
  );
}

function Note({
  tone,
  label,
  children,
}: {
  tone: "do" | "dont";
  label: string;
  children: ReactNode;
}) {
  const isDo = tone === "do";
  const Icon = isDo ? CheckCircle : XCircle;
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-md px-3.5 py-3",
        isDo ? "bg-success-soft" : "bg-danger-soft",
      )}
    >
      <Icon
        size={16}
        weight="fill"
        aria-hidden="true"
        className={cn("mt-px shrink-0", isDo ? "text-success" : "text-danger")}
      />
      <div className="min-w-0">
        <span className="mb-0.5 block text-[12px] font-medium text-ink">
          {label}
        </span>
        <p className="m-0 text-[13.5px] leading-[1.55] text-ink-muted">
          {children}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── tab bodies ─────────────────────────── */

function OverviewTab({ asset }: { asset: Asset }) {
  const d: Description | undefined = asset.description;
  const hasTags = Boolean(asset.tags && asset.tags.length);
  if (!d && !hasTags) {
    return (
      <EmptyState icon={<Article size={20} />} title="No description yet">
        Run the analyzer with AI descriptions enabled to document this asset.
      </EmptyState>
    );
  }
  const hasIO = d?.inputs || d?.outputs;
  const hasNotes = d?.whenToUse || d?.whenNotToUse;
  return (
    <>
      {d?.purpose && (
        <p className="m-0 max-w-[68ch] text-[14.5px] leading-[1.6] text-pretty text-ink">
          {d.purpose}
        </p>
      )}

      {hasTags && (
        <div className={cn("flex flex-wrap gap-1.5", d?.purpose && "mt-3.5")}>
          {asset.tags!.map((t, i) => (
            <Tag key={i}>{t}</Tag>
          ))}
        </div>
      )}

      {hasIO && (
        <dl className="mt-5 flex flex-col gap-3 border-t border-hairline-soft pt-4 text-[13.5px] [&>div]:grid [&>div]:grid-cols-[84px_minmax(0,1fr)] [&>div]:items-start [&>div]:gap-4 [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:leading-[1.55] [&_dd]:text-ink-muted [&_dd]:wrap-anywhere [&_dt]:pt-0.5 [&_dt]:text-[12px] [&_dt]:font-medium [&_dt]:text-ink-faint">
          {d?.inputs && (
            <div>
              <dt>Inputs</dt>
              <dd>{d.inputs}</dd>
            </div>
          )}
          {d?.outputs && (
            <div>
              <dt>Outputs</dt>
              <dd>{d.outputs}</dd>
            </div>
          )}
        </dl>
      )}

      {hasNotes && (
        <div className="mt-5 grid grid-cols-2 gap-2.5 max-[1100px]:grid-cols-1">
          {d?.whenToUse && (
            <Note tone="do" label="When to use">
              {d.whenToUse}
            </Note>
          )}
          {d?.whenNotToUse && (
            <Note tone="dont" label="When not to use">
              {d.whenNotToUse}
            </Note>
          )}
        </div>
      )}

      <ListBlock title="Responsibilities" items={d?.responsibilities} />
      <ListBlock title="Improvements" items={d?.improvements} />
      {d?.examples && d.examples.length > 0 && (
        <Section title={d.examples.length > 1 ? "Examples" : "Example"}>
          <div className="flex flex-col gap-2.5">
            {d.examples.map((ex, i) => (
              <CodeBlock key={i}>{ex}</CodeBlock>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function ParamsTable({ rows }: { rows: Param[] }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className={TABLE_CLASS}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Required</th>
            <th>Default</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}>
              <td className="font-mono text-[12.5px] whitespace-nowrap text-ink!">
                {p.name}
              </td>
              <td className="font-mono text-[12.5px] break-all">
                {p.type || "—"}
              </td>
              <td>
                {p.optional ? (
                  <span className="text-ink-faint">Optional</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-ink">
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-warn"
                      aria-hidden="true"
                    />
                    Required
                  </span>
                )}
              </td>
              <td className="font-mono text-[12.5px]">
                {p.defaultValue || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hasApi(asset: Asset) {
  return Boolean(
    asset.props?.length ||
    asset.params?.length ||
    asset.returnType ||
    asset.stateShape?.length ||
    asset.routePath,
  );
}

function ApiTab({ asset }: { asset: Asset }) {
  const rows = asset.props?.length ? asset.props : asset.params;
  return (
    <>
      {rows && rows.length > 0 && (
        <Section
          title={asset.props?.length ? "Props" : "Parameters"}
          aside={
            <span className="text-ink-faint tabular-nums">{rows.length}</span>
          }
        >
          <ParamsTable rows={rows} />
        </Section>
      )}

      {asset.returnType && (
        <Section title="Returns">
          <CodeBlock>{asset.returnType}</CodeBlock>
        </Section>
      )}

      <ListBlock title="State shape" items={asset.stateShape} />

      {asset.routePath && (
        <Section title="Route">
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-mono text-ink">{asset.routePath}</span>
            {asset.segmentKind && <Tag>{asset.segmentKind}</Tag>}
            {asset.componentName && (
              <>
                <ArrowRight
                  size={13}
                  weight="bold"
                  className="text-ink-faint"
                  aria-hidden="true"
                />
                <span className="font-mono text-ink-muted">
                  {asset.componentName}
                </span>
              </>
            )}
          </div>
          {asset.childRoutes && asset.childRoutes.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[12px] text-ink-faint">Children</span>
              {asset.childRoutes.map((c) => (
                <Tag key={c}>{c}</Tag>
              ))}
            </div>
          )}
        </Section>
      )}
    </>
  );
}

function UsageTab({
  root,
  refs,
  deps,
}: {
  root?: string;
  refs: UsageRef[];
  deps?: string[];
}) {
  const shown = refs.slice(0, USAGE_CAP);
  if (!refs.length && !deps?.length) {
    return (
      <EmptyState
        icon={<LinkBreak size={20} />}
        title="Not referenced anywhere"
      >
        No other file imports this asset, and it has no recorded dependencies.
      </EmptyState>
    );
  }
  return (
    <>
      {refs.length > 0 && (
        <Section
          title="Referenced from"
          aside={<span className="tabular-nums">{refs.length}</span>}
        >
          <ul className="-mx-2 m-0 flex list-none flex-col gap-px p-0">
            {shown.map((u, i) => (
              <li
                key={i}
                className="flex h-8 min-w-0 items-center gap-2.5 rounded-sm px-2 transition-colors duration-150 hover:bg-surface-2"
              >
                <EditorLink
                  root={root}
                  path={u.filePath}
                  line={u.line}
                  className="min-w-0 flex-1 text-[12.5px] text-ink-muted"
                >
                  <span className="min-w-0 truncate font-mono">
                    {u.filePath}
                  </span>
                  <span className="shrink-0 font-mono text-ink-faint tabular-nums">
                    :{u.line}
                  </span>
                </EditorLink>
                <Tag>{u.kind}</Tag>
              </li>
            ))}
          </ul>
          {refs.length > USAGE_CAP && (
            <p className="mt-2 mb-0 text-[12px] text-ink-faint tabular-nums">
              +{refs.length - USAGE_CAP} more
            </p>
          )}
        </Section>
      )}

      {deps && deps.length > 0 && (
        <Section
          title="Dependencies"
          aside={<span className="tabular-nums">{deps.length}</span>}
        >
          <div className="flex flex-wrap gap-1.5">
            {deps.map((d, i) => (
              <Tag key={i}>{d}</Tag>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

/* ─────────────────────────── detail ─────────────────────────── */

function MetaSep() {
  return <span className="h-3 w-px bg-hairline" aria-hidden="true" />;
}

/**
 * Asset detail pane. The parent renders it inside a Card sized to the pane;
 * the header stays put while the tab body scrolls.
 */
export default function Detail({ asset }: { asset: Asset }) {
  const root = useData().meta.root;
  const usage = asset.usageCount || 0;
  const refs = asset.usedIn || [];
  const apiRows = asset.props?.length ? asset.props : asset.params;
  const api = hasApi(asset);
  const href = editorHref(
    root,
    asset.path,
    asset.location?.line,
    asset.location?.column,
  );

  return (
    <motion.div
      key={asset.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex h-full min-h-0 flex-col max-[900px]:h-auto"
    >
      {/* ── Header ── */}
      <header className="shrink-0 px-5 pt-5 pb-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <TypeBadge type={asset.type} />
          <EditorLink
            root={root}
            path={asset.path}
            line={asset.location?.line}
            column={asset.location?.column}
            className="min-w-0 text-[12px] text-ink-faint"
          >
            <span className="min-w-0 truncate font-mono">{asset.path}</span>
          </EditorLink>
        </div>

        <div className="mt-2.5 flex items-start justify-between gap-4">
          <h2 className="m-0 min-w-0 font-display text-[22px] leading-tight font-semibold tracking-[-0.02em] wrap-break-word text-ink">
            {asset.name}
          </h2>
          {href && (
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={href}>
                <ArrowSquareOut size={14} />
                Open in editor
              </a>
            </Button>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-ink-muted">
          <span>
            <b className="font-medium text-ink tabular-nums">{usage}</b>{" "}
            {usage === 1 ? "usage" : "usages"}
          </span>
          {apiRows && apiRows.length > 0 && (
            <>
              <MetaSep />
              <span>
                <b className="font-medium text-ink tabular-nums">
                  {apiRows.length}
                </b>{" "}
                {asset.props?.length
                  ? apiRows.length === 1
                    ? "prop"
                    : "props"
                  : apiRows.length === 1
                    ? "param"
                    : "params"}
              </span>
            </>
          )}
          {asset.workspace && (
            <>
              <MetaSep />
              <span className="font-mono text-[12px]">{asset.workspace}</span>
            </>
          )}
          {asset.description?.source && (
            <>
              <MetaSep />
              <SourceBadge source={asset.description.source} />
            </>
          )}
        </div>

        {asset.signature && (
          <CodeBlock className="mt-4 max-h-36 overflow-y-auto">
            {asset.signature}
          </CodeBlock>
        )}
      </header>

      {/* ── Tabs ── */}
      <Tabs
        key={asset.id}
        defaultValue="overview"
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList
          variant="underline"
          className="shrink-0 px-3 [&>button]:flex-none"
        >
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {api && <TabsTrigger value="api">API</TabsTrigger>}
          <TabsTrigger value="usage">
            Usage
            <span className="text-ink-faint tabular-nums">{refs.length}</span>
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-8 max-[900px]:overflow-visible">
          <TabsContent value="overview" className="outline-none">
            <OverviewTab asset={asset} />
          </TabsContent>
          {api && (
            <TabsContent value="api" className="outline-none">
              <ApiTab asset={asset} />
            </TabsContent>
          )}
          <TabsContent value="usage" className="outline-none">
            <UsageTab root={root} refs={refs} deps={asset.dependencies} />
          </TabsContent>
        </div>
      </Tabs>
    </motion.div>
  );
}
