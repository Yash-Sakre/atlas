import { Link } from 'react-router-dom';
import { OUTPUT_FILES } from '../../data/features';
import { Callout, CodeBlock, DefTable, H2, PageHeader, P } from '../ui';

const TREE = `.atlas/
├─ .cache/            incremental analysis cache
├─ analysis.json      full snapshot (everything below, combined)
├─ components.json    hooks.json  utils.json  contexts.json  routes.json
├─ graph.json         dead-code.json  architecture.json
└─ dependencies.json  search.json`;

const CI = `# fail the build if anything new goes unused
npx codebase-atlas dead-code --json > dead-code.json`;

export default function Outputs() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Analysis outputs"
        lead="Every command that analyzes writes this file set to --out-dir, which defaults to .atlas/ in the project root. It's plain JSON — diff it, gate CI on it, or feed it to your own tooling."
      />

      <H2 id="layout">Folder layout</H2>
      <CodeBlock caption=".atlas/">{TREE}</CodeBlock>
      <Callout kind="note" title="Commit it or ignore it">
        Add <code>.atlas/</code> to <code>.gitignore</code> for the normal case. Checking the snapshot in is
        a deliberate choice — it makes “what did this PR add to the codebase?” a reviewable diff.
      </Callout>

      <H2 id="files">Files</H2>
      <DefTable
        rows={OUTPUT_FILES.map((f) => ({
          term: f.file,
          accent: true,
          isNew: f.isNew,
          desc: f.desc,
        }))}
      />

      <H2 id="cache">Cache</H2>
      <P>
        The incremental cache lives in <code>.atlas/.cache/</code> and keys on file contents plus the Atlas
        version, so a tool upgrade invalidates it automatically. <code>--no-cache</code> skips it for one
        run; <code>--reanalyze</code> forces a genuinely fresh scan before serving or exporting.
      </P>

      <H2 id="ci">Using it in CI</H2>
      <P>
        <Link to="/docs/cli/analyze">
          <code>atlas analyze</code>
        </Link>{' '}
        serves nothing and opens nothing, which makes it the right command for automation. The reporting
        commands also take <code>--json</code>, so you can gate a pipeline on dead code or graph shape
        without parsing terminal output.
      </P>
      <CodeBlock caption="ci step">{CI}</CodeBlock>
    </>
  );
}
