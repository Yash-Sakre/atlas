import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import AtlasMark from '@/components/landing/AtlasMark';
import { appName, GITHUB_URL, NPM_URL } from './shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <AtlasMark size={24} />
          <span className="font-semibold tracking-tight">{appName}</span>
        </>
      ),
    },
    githubUrl: GITHUB_URL,
    links: [{ text: 'npm', url: NPM_URL, external: true }],
  };
}
