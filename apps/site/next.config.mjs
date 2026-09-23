import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Empty locally; `/atlas` on GitHub Pages (set by .github/workflows/pages.yml).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const config = {
  // Fully static: `next build` writes the whole site to out/.
  output: 'export',
  basePath,
  // Emit docs/cli/serve/index.html rather than docs/cli/serve.html, so static
  // hosts resolve `/docs/cli/serve/` without rewrite rules.
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default withMDX(config);
