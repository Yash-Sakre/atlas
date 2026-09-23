import { source } from '@/lib/source';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import type { Metadata } from 'next';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import { basePath, docsSourceUrl, getPageImageUrl, getPageMarkdownUrl } from '@/lib/shared';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  // Fetched by the client as-is, so it needs the base path Next adds to routes.
  const markdownUrl = `${basePath}${getPageMarkdownUrl(page).url}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <div className="mb-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription className="mt-2 mb-0">{page.data.description}</DocsDescription>
        </div>
        <div className="flex shrink-0 flex-row gap-2 items-center">
          <MarkdownCopyButton markdownUrl={markdownUrl} />
          <ViewOptionsPopover markdownUrl={markdownUrl} githubUrl={docsSourceUrl(page.path)} />
        </div>
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: `${basePath}${getPageImageUrl(page).url}`,
    },
  };
}
