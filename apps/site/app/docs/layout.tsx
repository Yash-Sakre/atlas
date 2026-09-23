import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import { DocsCorner } from '@/components/docs/corner';
import { gitConfig } from '@/lib/shared';
import cliPackage from '../../../../packages/cli/package.json';

/** Star count at build time; the corner refreshes it in the browser. */
async function getStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${gitConfig.user}/${gitConfig.repo}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

export default async function Layout({ children }: LayoutProps<'/docs'>) {
  const base = baseOptions();
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...base}
      // Both live in the corner tab instead of the sidebar footer.
      githubUrl={undefined}
      // npm lives in the corner tab too.
      links={[]}
      themeSwitch={{ enabled: false }}
      sidebar={{ collapsible: false }}
      containerProps={{ className: 'atlas-docs' }}
    >
      <DocsCorner initialStars={await getStars()} version={cliPackage.version} />
      {children}
    </DocsLayout>
  );
}
