import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://nwarkaudubon.org',
  // Astro's HTML compression drops the space when a line break comes right before an inline
  // element (e.g. "email\n<a href>" renders as "email<a href>"). Turning it off lets us wrap
  // source lines freely. The size cost is negligible.
  compressHTML: false,
});
