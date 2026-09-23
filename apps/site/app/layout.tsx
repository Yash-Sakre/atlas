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
  'Atlas is a free, open-source CLI that maps every component, hook, utility, context, store and route in your React, Next.js or Vite codebase — plus dead code, npm dependencies and architecture. One command, zero config.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: appName, template: `%s | ${appName}` },
  description,
  applicationName: appName,
  icons: { icon: `${basePath}/atlas-mark.svg` },
  openGraph: {
    siteName: appName,
    type: 'website',
    title: 'Atlas — stop rebuilding what you already built',
    description:
      'Find every reusable React component, hook and util in your codebase — plus dead code, dependencies and architecture. Free, open source, zero config.',
  },
  twitter: { card: 'summary_large_image' },
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
