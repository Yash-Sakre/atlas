import { CONFIG_KEYS } from '../../data/features';
import { Callout, CodeBlock, DefTable, H2, PageHeader, P } from '../ui';

const CONFIG_EXAMPLE = `{
  "include": ["src/**/*.{ts,tsx}"],
  "exclude": ["**/*.stories.tsx"],
  "outDir": ".atlas",
  "sharedLayers": ["shared", "common", "ui"]
}`;

const PKG_EXAMPLE = `{
  "name": "my-app",
  "atlas": {
    "exclude": ["src/legacy/**"]
  }
}`;

export default function Configuration() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Configuration"
        lead="Atlas is zero-config by design — every key here is optional. Reach for a config file only when the defaults don't match your layout."
      />

      <H2 id="where">Where config lives</H2>
      <P>
        Atlas looks for the first of these in the project root: <code>atlas.config.json</code>,{' '}
        <code>.atlasrc</code>, <code>.atlasrc.json</code>, or an <code>"atlas"</code> key in{' '}
        <code>package.json</code>. CLI flags always win over the config file.
      </P>
      <CodeBlock caption="atlas.config.json">{CONFIG_EXAMPLE}</CodeBlock>
      <CodeBlock caption="package.json">{PKG_EXAMPLE}</CodeBlock>

      <H2 id="keys">Keys</H2>
      <DefTable
        rows={CONFIG_KEYS.map((k) => ({
          term: k.key,
          meta: k.type,
          accent: true,
          desc: (
            <>
              {k.desc}
              {k.default && (
                <span className="def-default">
                  {' '}
                  Default: <code>{k.default}</code>
                </span>
              )}
            </>
          ),
        }))}
      />

      <H2 id="defaults">What is scanned by default</H2>
      <P>
        Without an <code>include</code>, Atlas scans <code>**/*.{'{'}ts,tsx,js,jsx,mjs,cjs{'}'}</code>. The
        default excludes already cover <code>node_modules</code>, <code>dist</code>, <code>build</code>,{' '}
        <code>.next</code>, <code>out</code>, <code>coverage</code>, <code>.atlas</code>, declaration files,
        and <code>*.test.*</code> / <code>*.spec.*</code> / <code>*.stories.*</code>. Setting your own{' '}
        <code>exclude</code> replaces that list, so re-state anything you still want skipped.
      </P>

      <H2 id="monorepos">Monorepos</H2>
      <P>
        Nothing to configure. npm, yarn and pnpm workspaces, Turborepo and Nx are auto-detected from the
        workspace manifests, and each workspace's path aliases resolve on their own — including split{' '}
        <code>tsconfig</code> setups where a base config is extended by per-package files. Routers are
        resolved per workspace too, so two apps in one repo don't blur into a single route table.
      </P>
      <Callout kind="tip" title="Scoping a big repo">
        You can also just point Atlas at one package: <code>atlas serve ./apps/web</code>. That analyzes the
        app in isolation and keeps its output under <code>apps/web/.atlas/</code>.
      </Callout>

      <H2 id="layers">Shared layers &amp; architecture</H2>
      <P>
        <code>sharedLayers</code> tells the architecture pass which top-level folders are the common layer
        every module may import from. Anything else that reaches across module boundaries is reported as a
        violation, with a recommendation, in <code>architecture.json</code> and the dashboard.
      </P>

      <H2 id="cache">Cache</H2>
      <P>
        The incremental cache is on by default and lives in <code>.atlas/.cache/</code>. It keys on file
        contents and the Atlas version, so upgrading the tool invalidates it automatically. Disable it per
        run with <code>--no-cache</code>, force a clean scan with <code>--reanalyze</code>, or turn it off
        permanently with <code>"cache": false</code>.
      </P>
    </>
  );
}
