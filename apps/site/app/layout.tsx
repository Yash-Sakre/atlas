import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/provider';
import { appName, basePath, siteUrl } from '@/lib/shared';
import './global.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const description =
  'Atlas scans a React / Next.js / Vite / TypeScript codebase and auto-discovers every reusable asset — components, hooks, utilities, contexts, stores and routes — by AST semantics, never by folder names, then maps your dependency graph, npm inventory and architecture.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: appName, template: `%s | ${appName}` },
  description,
  icons: { icon: `${basePath}/atlas-mark.svg` },
  openGraph: {
    siteName: appName,
    type: 'website',
    title: 'Atlas — map your frontend codebase',
    description:
      'See what already exists before you write new code. AST-powered discovery of components, hooks, utils, contexts, stores & routes — plus dependencies, architecture and dead code.',
  },
  twitter: { card: 'summary' },
};

export const viewport: Viewport = {
  themeColor: '#0a0908',
};

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.className} ${inter.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
