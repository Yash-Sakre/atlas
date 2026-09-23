import { createGetUrl } from 'fumadocs-core/source';

export const appName = 'Atlas';
export const docsRoute = '/docs';
export const docsImageRoute = '/og/docs';
export const docsContentRoute = '/llms.mdx/docs';

/**
 * Path prefix the site is served under. GitHub Pages hosts it at
 * `/<repo>/`, so the Pages workflow sets NEXT_PUBLIC_BASE_PATH=/atlas; locally
 * it is empty. Next applies it to routes and `<Link>`s on its own — this copy is
 * for the raw URLs Next doesn't rewrite (fetches, `<img>`, metadata).
 */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const siteUrl = 'https://yash-sakre.github.io/atlas';

export const gitConfig = {
  user: 'Yash-Sakre',
  repo: 'atlas',
  branch: 'main',
};

/** Credited in the docs' top-right corner. */
export const author = {
  name: 'Yash Sakre',
  url: 'https://github.com/Yash-Sakre',
};

export const GITHUB_URL = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
export const NPM_URL = 'https://www.npmjs.com/package/codebase-atlas';
export const ISSUES_URL = `${GITHUB_URL}/issues`;
export const LICENSE_URL = `${GITHUB_URL}/blob/${gitConfig.branch}/LICENSE`;
export const INSTALL_CMD = 'npx codebase-atlas serve';

/** Where a docs page's MDX lives in the repo, for "edit on GitHub" links. */
export function docsSourceUrl(pagePath: string): string {
  return `${GITHUB_URL}/blob/${gitConfig.branch}/apps/site/content/docs/${pagePath}`;
}

/**
 * CounterAPI v1 counter backing the footer visitor count. The v1 endpoints are
 * keyless, which also means the counter is public: anyone who knows this
 * namespace/name pair can read or bump it. Treat the number as a rough signal,
 * not as analytics. Rate limit is 30 requests/min per URL path.
 */
export const COUNTER_NAMESPACE = 'codebase-atlas';
export const COUNTER_NAME = 'site-visits';

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];

  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];

  return { segments, url: getImageUrl(segments, page.locale) };
}
