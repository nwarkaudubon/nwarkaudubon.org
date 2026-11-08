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
  }),
});

export const collections = { conservation };
