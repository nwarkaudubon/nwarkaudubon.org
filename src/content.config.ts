import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/*
  Conservation topic pages. Each Markdown file in src/content/conservation/ becomes a page at
  /conservation/<filename>/ and is listed on the Conservation hub.

  Frontmatter:
    title        page title (required)
    description  one line shown on the hub (required)
    order        sort position on the hub, lowest first (optional)
    externalUrl  if set, the hub links straight to this URL and no page is built
*/
const conservation = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/conservation' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number().default(100),
    externalUrl: z.string().url().optional(),
    // Optional featured image (a file in public/, e.g. /images/conservation/x.jpg)
    image: z.string().optional(),
    imageAlt: z.string().default(''),
    imageCredit: z.string().optional(),
  }),
});

/*
  Archive: content we keep but don't promote. Each Markdown file in src/content/archive/
  becomes a page at /archive/<filename>/ and is listed on /archive/ (linked from the footer
  only, never the main nav or the Conservation hub). Archived pages show a banner and are
  hidden from search engines.

  To archive a page: move its Markdown file into src/content/archive/ and add the fields below.

  Frontmatter:
    title        page title (required)
    summary      one line shown on the archive list (required)
    category     groups items on the archive list, e.g. "Programs", "Photos" (default "Other")
    year         year the content is from, used for sorting (optional)
    archivedOn   date it was archived, YYYY-MM-DD (required)
    reason       why it was archived, for future volunteers (required)
    originalUrl  its old address on the previous site, e.g. /binocular-project.htm (optional;
                 used to build redirects at cutover)
    indexable    set true to allow search engines to list it (default false)
*/
const archive = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/archive' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.string().default('Other'),
    year: z.number().optional(),
    archivedOn: z.coerce.date(),
    reason: z.string(),
    originalUrl: z.string().optional(),
    indexable: z.boolean().default(false),
  }),
});

export const collections = { conservation, archive };
